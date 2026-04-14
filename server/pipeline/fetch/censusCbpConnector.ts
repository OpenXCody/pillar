/**
 * Census County Business Patterns (CBP) Connector
 *
 * Fetches aggregate manufacturing establishment data from the Census Bureau's
 * County Business Patterns API. Provides establishment counts, payroll, and
 * employment by county and NAICS code for all US counties.
 *
 * This data is useful for identifying undercovered areas — counties where
 * we have far fewer facilities in Pillar than the Census says exist.
 *
 * API: https://api.census.gov/data/2021/cbp
 * No API key required for basic access.
 * Rate limit: generous, but we self-limit to ~1 req/s to be polite.
 */

import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { updateProgress } from '../orchestrator.js';

const CBP_BASE_URL = 'https://api.census.gov/data/2021/cbp';
const USER_AGENT = 'Pillar-Data-Pipeline/1.0 (contact@o-10.com)';

/** Delay between API requests in ms (~1 req/s) */
const REQUEST_DELAY_MS = 1000;
/** Batch size for DB inserts */
const INSERT_BATCH_SIZE = 500;

/**
 * FIPS state codes (01-56) for all US states and territories.
 * We query one state at a time to keep response sizes manageable
 * and provide granular progress updates.
 */
const STATE_FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
};

export interface CensusCbpFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

interface CbpRecord {
  stateFips: string;
  countyFips: string;
  stateAbbr: string;
  naicsCode: string;
  naicsDescription: string;
  establishmentCount: number;
  annualPayroll: number;
  employees: number;
}

/**
 * Fetch with retry and exponential backoff.
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      });

      if (res.status === 429 || res.status === 503) {
        if (attempt < maxRetries) {
          const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
          console.log(`[Census CBP] Rate limited (${res.status}), retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      return res;
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        console.log(`[Census CBP] Network error, retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries}): ${err}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Census CBP API: max retries exceeded');
}

/**
 * Parse a numeric value from Census API response, returning 0 for
 * suppressed or unavailable values (marked as 'S', 'D', 'N', etc.).
 */
function parseNumeric(value: string | null | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Fetch CBP data for a single state.
 *
 * The Census API returns a JSON array of arrays. The first row is headers,
 * subsequent rows are data. Example:
 *   [["NAICS2017","NAICS2017_LABEL","ESTAB","PAYANN","EMP","state","county"],
 *    ["31-33","Manufacturing",42,12345,678,"01","001"],
 *    ...]
 */
async function fetchStateData(stateFips: string): Promise<CbpRecord[]> {
  const stateAbbr = STATE_FIPS[stateFips];
  if (!stateAbbr) return [];

  const params = new URLSearchParams({
    get: 'NAICS2017,NAICS2017_LABEL,ESTAB,PAYANN,EMP',
    for: 'county:*',
    in: `state:${stateFips}`,
    NAICS2017: '31-33',
  });

  const url = `${CBP_BASE_URL}?${params.toString()}`;
  const res = await fetchWithRetry(url);

  if (!res.ok) {
    // Some small states/territories may return 204 or errors — skip gracefully
    if (res.status === 204 || res.status === 404) {
      console.log(`[Census CBP] No data for state ${stateFips} (${stateAbbr}), skipping`);
      return [];
    }
    throw new Error(`Census CBP API error for state ${stateFips}: ${res.status} ${res.statusText}`);
  }

  const rawData = await res.json() as string[][];

  if (!Array.isArray(rawData) || rawData.length < 2) {
    return [];
  }

  // First row is headers — find column indices
  const headers = rawData[0];
  const naicsIdx = headers.indexOf('NAICS2017');
  const labelIdx = headers.indexOf('NAICS2017_LABEL');
  const estabIdx = headers.indexOf('ESTAB');
  const payannIdx = headers.indexOf('PAYANN');
  const empIdx = headers.indexOf('EMP');
  const stateIdx = headers.indexOf('state');
  const countyIdx = headers.indexOf('county');

  if (naicsIdx === -1 || estabIdx === -1 || countyIdx === -1) {
    console.warn(`[Census CBP] Unexpected header format for state ${stateFips}: ${headers.join(',')}`);
    return [];
  }

  const records: CbpRecord[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const estab = parseNumeric(row[estabIdx]);
    if (estab === 0) continue; // Skip counties with no establishments

    records.push({
      stateFips: row[stateIdx] ?? stateFips,
      countyFips: row[countyIdx] ?? '',
      stateAbbr,
      naicsCode: row[naicsIdx] ?? '31-33',
      naicsDescription: row[labelIdx] ?? 'Manufacturing',
      establishmentCount: estab,
      annualPayroll: parseNumeric(row[payannIdx]),
      employees: parseNumeric(row[empIdx]),
    });
  }

  return records;
}

/**
 * Insert Census CBP records into raw_records in batches.
 */
async function insertCbpRecords(records: CbpRecord[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += INSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + INSERT_BATCH_SIZE).map(row => {
      const countyFips = `${row.stateFips}${row.countyFips}`;

      return {
        source: 'census_cbp' as const,
        sourceRunId: runId,
        sourceRecordId: `cbp_${countyFips}_${row.naicsCode.replace('-', '')}`,
        rawName: null,
        rawAddress: null,
        rawCity: null,
        rawState: row.stateAbbr,
        rawZip: null,
        rawCounty: null,
        rawLatitude: null,
        rawLongitude: null,
        rawNaicsCode: row.naicsCode === '31-33' ? '31' : row.naicsCode.slice(0, 6),
        rawNaicsDescription: row.naicsDescription,
        rawSicCode: null,
        censusCountyFips: countyFips,
        censusEstablishmentCount: row.establishmentCount,
        censusAnnualPayroll: row.annualPayroll,
        censusEmployees: row.employees,
        rawJson: null,
      };
    });

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      errors.push(`Batch insert error at offset ${i}: ${err}`);
    }

    updateProgress('fetching', 70 + Math.round(((i + batch.length) / records.length) * 25),
      `Inserting Census CBP records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full Census CBP fetch pipeline:
 * 1. Query the Census API state-by-state for manufacturing NAICS 31-33
 * 2. Parse county-level establishment counts
 * 3. Insert into raw_records with source='census_cbp'
 */
export async function fetchCensusCbp(runId: string): Promise<CensusCbpFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    const stateFipsCodes = Object.keys(STATE_FIPS).sort();
    const allRecords: CbpRecord[] = [];
    const errors: string[] = [];

    updateProgress('fetching', 2, 'Fetching Census CBP manufacturing data...');
    console.log(`[Census CBP] Starting fetch for ${stateFipsCodes.length} states...`);

    // Fetch state-by-state for progress granularity
    for (let i = 0; i < stateFipsCodes.length; i++) {
      const fips = stateFipsCodes[i];
      const stateAbbr = STATE_FIPS[fips];

      try {
        const stateRecords = await fetchStateData(fips);
        allRecords.push(...stateRecords);

        const pct = Math.round(((i + 1) / stateFipsCodes.length) * 65);
        updateProgress('fetching', 5 + pct,
          `Fetched ${stateAbbr} (${stateRecords.length} county-NAICS rows) — ${allRecords.length.toLocaleString()} total`);

        if (stateRecords.length > 0) {
          console.log(`[Census CBP] ${stateAbbr}: ${stateRecords.length} county-NAICS records`);
        }
      } catch (err) {
        const msg = `Error fetching state ${fips} (${stateAbbr}): ${err}`;
        console.error(`[Census CBP] ${msg}`);
        errors.push(msg);
      }

      // Polite delay between state requests
      if (i < stateFipsCodes.length - 1) {
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
      }
    }

    console.log(`[Census CBP] Fetched ${allRecords.length.toLocaleString()} total records across ${stateFipsCodes.length} states`);

    // Insert records
    updateProgress('fetching', 70, `Inserting ${allRecords.length.toLocaleString()} Census CBP records...`);
    const { inserted, errors: insertErrors } = await insertCbpRecords(allRecords, runId);
    errors.push(...insertErrors);

    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'completed',
      completedAt: new Date(),
      totalFetched: allRecords.length,
      newRecords: inserted,
      errorCount: errors.length,
      errorLog: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      durationMs,
    }).where(eq(sourceRuns.id, runId));

    console.log(`[Census CBP] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted} inserted, ${errors.length} errors`);
    return { totalFetched: allRecords.length, inserted, errors };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'failed',
      completedAt: new Date(),
      errorLog: JSON.stringify([String(err)]),
      durationMs,
    }).where(eq(sourceRuns.id, runId));
    throw err;
  }
}
