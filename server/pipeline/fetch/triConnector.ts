/**
 * EPA TRI Connector
 *
 * Fetches facility data from the Toxics Release Inventory via the
 * Envirofacts REST API. The key differentiator is the PARENT_CO_NAME
 * field — TRI is the only federal source that cleanly identifies
 * which company owns each facility.
 *
 * API: https://data.epa.gov/efservice/
 * Table: TRI_FACILITY
 * No API key required. ~19K manufacturing facilities.
 */

import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const TRI_API_BASE = 'https://data.epa.gov/efservice';
const PAGE_SIZE = 10000;

interface TriFacilityRow {
  tri_facility_id: string;
  facility_name: string;
  street_address: string;
  city_name: string;
  state_abbr: string;
  zip_code: string;
  county_name: string;
  pref_latitude: number | null;
  pref_longitude: number | null;
  parent_co_name: string;
  parent_co_db_num: string;
  epa_registry_id: string | null;
  fac_closed_ind: string | null;
  [key: string]: string | number | null;
}

export interface TriFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

/**
 * Fetch a page of TRI facility data for a NAICS prefix.
 * TRI API uses row ranges: rows/{start}:{end}
 */
async function fetchTriPage(naicsPrefix: string, start: number, end: number): Promise<TriFacilityRow[]> {
  const url = `${TRI_API_BASE}/TRI_FACILITY/NAICS_CODE/BEGINNING/${naicsPrefix}/rows/${start}:${end}/JSON`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return []; // No more rows
    throw new Error(`TRI API error: ${res.status} ${res.statusText} for ${url}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

/**
 * Fetch all TRI manufacturing facilities across NAICS 31-33.
 * Paginates through each prefix separately.
 */
async function fetchAllTriFacilities(): Promise<TriFacilityRow[]> {
  const allRows: TriFacilityRow[] = [];
  const naicsPrefixes = ['31', '32', '33'];

  for (const prefix of naicsPrefixes) {
    let start = 0;
    let hasMore = true;

    console.log(`[TRI] Fetching NAICS ${prefix}xxxx facilities...`);

    while (hasMore) {
      const end = start + PAGE_SIZE - 1;
      const rows = await fetchTriPage(prefix, start, end);

      if (rows.length === 0) {
        hasMore = false;
      } else {
        allRows.push(...rows);
        console.log(`[TRI] NAICS ${prefix}: fetched ${allRows.length} total so far`);

        if (rows.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          start += PAGE_SIZE;
        }
      }

      // Rate limiting: small delay between requests
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`[TRI] Total facilities fetched: ${allRows.length}`);
  return allRows;
}

/**
 * Deduplicate TRI rows by TRI_FACILITY_ID (a facility may report
 * multiple years, but the facility info is the same).
 */
function deduplicateByFacilityId(rows: TriFacilityRow[]): TriFacilityRow[] {
  const seen = new Map<string, TriFacilityRow>();
  for (const row of rows) {
    const id = row.tri_facility_id;
    if (id && !seen.has(id)) {
      seen.set(id, row);
    }
  }
  return Array.from(seen.values());
}

/**
 * Insert TRI records into raw_records table in batches.
 */
async function insertTriRecords(rows: TriFacilityRow[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
      source: 'epa_tri' as const,
      sourceRunId: runId,
      sourceRecordId: row.tri_facility_id || null,
      rawName: row.facility_name || null,
      rawAddress: row.street_address || null,
      rawCity: row.city_name || null,
      rawState: row.state_abbr || null,
      rawZip: row.zip_code || null,
      rawCounty: row.county_name || null,
      rawLatitude: row.pref_latitude != null ? String(row.pref_latitude) : null,
      // TRI returns positive longitudes for US — negate if positive and in plausible US range
      rawLongitude: row.pref_longitude != null
        ? String(row.pref_longitude > 0 && row.pref_longitude > 60 ? -row.pref_longitude : row.pref_longitude)
        : null,
      rawNaicsCode: null, // NAICS used for filtering but not returned in TRI_FACILITY response
      rawSicCode: null,
      registryId: row.epa_registry_id ? String(row.epa_registry_id) : null,
      triParentCompanyName: row.parent_co_name || null,
      triParentDuns: row.parent_co_db_num || null,
      triFacilityId: row.tri_facility_id || null,
      rawJson: null, // Skip raw JSON storage to save DB space
    }));

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      errors.push(`Batch insert error at offset ${i}: ${err}`);
    }

    if ((i + BATCH_SIZE) % 5000 === 0) {
      console.log(`[TRI] Inserted ${inserted.toLocaleString()} / ${rows.length.toLocaleString()}`);
    }
  }

  return { inserted, errors };
}

/**
 * Full TRI fetch pipeline: fetch all pages -> deduplicate -> insert
 */
export async function fetchTri(runId: string): Promise<TriFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    // Fetch all pages
    const allRows = await fetchAllTriFacilities();

    // Deduplicate by facility ID
    const unique = deduplicateByFacilityId(allRows);
    console.log(`[TRI] ${allRows.length} raw rows -> ${unique.length} unique facilities`);

    // Insert
    const { inserted, errors } = await insertTriRecords(unique, runId);

    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'completed',
      completedAt: new Date(),
      totalFetched: unique.length,
      newRecords: inserted,
      errorCount: errors.length,
      errorLog: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      durationMs,
    }).where(eq(sourceRuns.id, runId));

    console.log(`[TRI] Fetch complete in ${(durationMs / 1000).toFixed(1)}s`);
    return { totalFetched: unique.length, inserted, errors };
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
