/**
 * SEC EDGAR Connector
 *
 * Fetches publicly traded manufacturer data from SEC's EDGAR system.
 * Uses the company tickers list + individual submissions to identify
 * manufacturers (SIC 2000-3999) and extract company info.
 *
 * API: https://www.sec.gov/files/company_tickers.json (all public companies)
 * API: https://data.sec.gov/submissions/CIK{padded}.json (company detail)
 * No API key required. Must set User-Agent header.
 * Rate limit: 10 requests/second.
 */

import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { updateProgress } from '../orchestrator.js';

const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_SUBMISSIONS_BASE = 'https://data.sec.gov/submissions';
const USER_AGENT = 'Pillar-Data-Pipeline/1.0 (contact@o-10.com)';

/** Batch size for concurrent submissions requests (stay well under 10 req/s) */
const CONCURRENT_BATCH = 3;
/** Delay between batches in ms — 3 concurrent + 400ms ≈ 7.5 req/s, safely under SEC limit */
const BATCH_DELAY_MS = 400;

interface SecTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecSubmission {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  stateOfIncorporation: string;
  addresses: {
    mailing: SecAddress;
    business: SecAddress;
  };
  filings?: {
    recent?: {
      form: string[];
    };
  };
}

interface SecAddress {
  street1: string | null;
  street2: string | null;
  city: string | null;
  stateOrCountry: string | null;
  zipCode: string | null;
  stateOrCountryDescription: string | null;
}

export interface SecFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

/**
 * Map SIC code (2000-3999) to NAICS 3-digit sector code.
 */
function sicToNaics(sic: string): string {
  const s = parseInt(sic, 10);
  if (s >= 2000 && s < 2100) return '311'; // Food
  if (s >= 2100 && s < 2200) return '312'; // Beverage/Tobacco
  if (s >= 2200 && s < 2400) return '313'; // Textile
  if (s >= 2400 && s < 2600) return '321'; // Wood
  if (s >= 2600 && s < 2700) return '322'; // Paper
  if (s >= 2700 && s < 2800) return '323'; // Printing
  if (s >= 2800 && s < 3000) return '325'; // Chemical
  if (s >= 3000 && s < 3100) return '326'; // Plastics/Rubber
  if (s >= 3100 && s < 3200) return '316'; // Leather
  if (s >= 3200 && s < 3300) return '327'; // Nonmetallic Mineral
  if (s >= 3300 && s < 3400) return '331'; // Primary Metal
  if (s >= 3400 && s < 3500) return '332'; // Fabricated Metal
  if (s >= 3500 && s < 3600) return '333'; // Machinery
  if (s >= 3600 && s < 3700) return '334'; // Computer/Electronic
  if (s >= 3700 && s < 3800) return '336'; // Transportation Equipment
  if (s >= 3800 && s < 3900) return '339'; // Miscellaneous Manufacturing
  if (s >= 3900 && s < 4000) return '339'; // Miscellaneous Manufacturing
  return '31'; // General manufacturing
}

/**
 * Map SIC code to a human-readable NAICS description.
 */
function sicToNaicsDescription(sic: string): string {
  const s = parseInt(sic, 10);
  if (s >= 2000 && s < 2100) return 'Food Manufacturing';
  if (s >= 2100 && s < 2200) return 'Beverage and Tobacco Product Manufacturing';
  if (s >= 2200 && s < 2400) return 'Textile Mills';
  if (s >= 2400 && s < 2600) return 'Wood Product Manufacturing';
  if (s >= 2600 && s < 2700) return 'Paper Manufacturing';
  if (s >= 2700 && s < 2800) return 'Printing and Related Support Activities';
  if (s >= 2800 && s < 3000) return 'Chemical Manufacturing';
  if (s >= 3000 && s < 3100) return 'Plastics and Rubber Products Manufacturing';
  if (s >= 3100 && s < 3200) return 'Leather and Allied Product Manufacturing';
  if (s >= 3200 && s < 3300) return 'Nonmetallic Mineral Product Manufacturing';
  if (s >= 3300 && s < 3400) return 'Primary Metal Manufacturing';
  if (s >= 3400 && s < 3500) return 'Fabricated Metal Product Manufacturing';
  if (s >= 3500 && s < 3600) return 'Machinery Manufacturing';
  if (s >= 3600 && s < 3700) return 'Computer and Electronic Product Manufacturing';
  if (s >= 3700 && s < 3800) return 'Transportation Equipment Manufacturing';
  if (s >= 3800 && s < 4000) return 'Miscellaneous Manufacturing';
  return 'Manufacturing';
}

/**
 * Pad CIK to 10 digits with leading zeros.
 */
function padCik(cik: number | string): string {
  return String(cik).padStart(10, '0');
}

/**
 * Check if a state code is a US state (2-letter code).
 * SEC uses ISO country codes for non-US entities (e.g., "A2" for non-US).
 */
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'PR',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY',
]);

function isUsState(code: string | null): boolean {
  if (!code) return false;
  return US_STATES.has(code.toUpperCase());
}

/**
 * Fetch with retry and proper SEC User-Agent header.
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Encoding': 'gzip, deflate',
        'Accept': 'application/json',
      },
    });

    if (res.status === 403 || res.status === 429) {
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        console.log(`[SEC] Rate limited (${res.status}), retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }

    return res;
  }

  throw new Error('SEC API: max retries exceeded');
}

/**
 * Fetch the full company tickers list from SEC.
 * Returns array of {cik, ticker, title}.
 */
async function fetchTickersList(): Promise<SecTickerEntry[]> {
  console.log('[SEC] Fetching company tickers list...');
  const res = await fetchWithRetry(SEC_TICKERS_URL);

  if (!res.ok) {
    throw new Error(`SEC tickers API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as Record<string, SecTickerEntry>;
  const entries = Object.values(data);
  console.log(`[SEC] Tickers list: ${entries.length} companies`);
  return entries;
}

/**
 * Fetch submission data for a single company by CIK.
 * Returns null if the request fails.
 */
async function fetchSubmission(cik: number): Promise<SecSubmission | null> {
  const paddedCik = padCik(cik);
  const url = `${SEC_SUBMISSIONS_BASE}/CIK${paddedCik}.json`;

  try {
    const res = await fetchWithRetry(url, 2);
    if (!res.ok) return null;

    const data = await res.json() as SecSubmission;
    return data;
  } catch {
    return null;
  }
}

/**
 * Check if a SIC code falls in the manufacturing range (2000-3999).
 */
function isManufacturingSic(sic: string | null | undefined): boolean {
  if (!sic) return false;
  const code = parseInt(sic, 10);
  return code >= 2000 && code < 4000;
}

interface SecManufacturer {
  cik: number;
  ticker: string;
  name: string;
  sic: string;
  sicDescription: string;
  stateOfIncorporation: string;
  address: SecAddress;
}

/**
 * Fetch submissions for all companies in batches, filter to manufacturers.
 * Uses parallel batching to stay under SEC's 10 req/s rate limit.
 */
async function fetchAndFilterManufacturers(tickers: SecTickerEntry[]): Promise<SecManufacturer[]> {
  const manufacturers: SecManufacturer[] = [];
  let processed = 0;
  let consecutiveFailures = 0;

  console.log(`[SEC] Fetching submissions for ${tickers.length} companies to identify manufacturers...`);

  for (let i = 0; i < tickers.length; i += CONCURRENT_BATCH) {
    // If too many consecutive failures, back off harder
    if (consecutiveFailures >= 50) {
      console.log(`[SEC] Too many consecutive failures (${consecutiveFailures}). Pausing 10s...`);
      await new Promise(r => setTimeout(r, 10000));
      consecutiveFailures = 0;
    }

    const batch = tickers.slice(i, i + CONCURRENT_BATCH);
    const promises = batch.map(t => fetchSubmission(t.cik_str));
    const results = await Promise.all(promises);

    let batchFailures = 0;

    for (let j = 0; j < batch.length; j++) {
      const submission = results[j];
      if (!submission) {
        batchFailures++;
        consecutiveFailures++;
        continue;
      }

      consecutiveFailures = 0;

      // Check if this company is a manufacturer
      if (isManufacturingSic(submission.sic)) {
        // Prefer business address, fall back to mailing
        const addr = submission.addresses?.business?.city
          ? submission.addresses.business
          : submission.addresses?.mailing ?? { street1: null, street2: null, city: null, stateOrCountry: null, zipCode: null, stateOrCountryDescription: null };

        manufacturers.push({
          cik: batch[j].cik_str,
          ticker: batch[j].ticker,
          name: submission.name || batch[j].title,
          sic: submission.sic,
          sicDescription: submission.sicDescription || '',
          stateOfIncorporation: submission.stateOfIncorporation || '',
          address: addr,
        });
      }
    }

    processed += batch.length;

    // Progress reporting
    if (processed % 500 === 0 || processed === tickers.length) {
      const pct = Math.round((processed / tickers.length) * 100);
      updateProgress('fetching', 5 + Math.round(pct * 0.65), `Scanning SEC companies... ${processed.toLocaleString()} / ${tickers.length.toLocaleString()} (${manufacturers.length} manufacturers)`);
      console.log(`[SEC] Scanned ${processed.toLocaleString()} / ${tickers.length.toLocaleString()} — ${manufacturers.length} manufacturers found`);
    }

    // Adaptive rate limiting
    const delay = batchFailures > 2 ? BATCH_DELAY_MS * 3 : BATCH_DELAY_MS;
    await new Promise(r => setTimeout(r, delay));
  }

  console.log(`[SEC] Scan complete: ${manufacturers.length} manufacturers out of ${tickers.length} companies`);
  return manufacturers;
}

/**
 * Insert SEC manufacturer records into raw_records in batches.
 */
async function insertSecRecords(records: SecManufacturer[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(row => {
      const stateCode = row.address.stateOrCountry?.toUpperCase() ?? null;
      const normalizedState = stateCode && isUsState(stateCode) ? stateCode : null;

      return {
        source: 'sec_edgar' as const,
        sourceRunId: runId,
        sourceRecordId: `sec_${padCik(row.cik)}`,
        rawName: row.name || null,
        rawAddress: [row.address.street1, row.address.street2].filter(Boolean).join(', ') || null,
        rawCity: row.address.city || null,
        rawState: normalizedState,
        rawZip: row.address.zipCode || null,
        rawNaicsCode: sicToNaics(row.sic),
        rawNaicsDescription: sicToNaicsDescription(row.sic),
        rawSicCode: row.sic || null,
        secCik: padCik(row.cik),
        secTicker: row.ticker || null,
        secSicCode: row.sic || null,
        rawJson: null,
      };
    });

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      errors.push(`Batch insert error at offset ${i}: ${err}`);
    }

    updateProgress('fetching', 70 + Math.round((i / records.length) * 25),
      `Inserting SEC records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full SEC EDGAR fetch pipeline:
 * 1. Fetch company tickers list
 * 2. Scan each company's submissions for SIC code
 * 3. Filter to manufacturing (SIC 2000-3999)
 * 4. Insert matching companies as raw records
 */
export async function fetchSec(runId: string): Promise<SecFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    // Step 1: Get all company tickers
    updateProgress('fetching', 2, 'Downloading SEC company list...');
    const tickers = await fetchTickersList();

    // Step 2 & 3: Fetch submissions and filter to manufacturers
    const manufacturers = await fetchAndFilterManufacturers(tickers);

    // Deduplicate by CIK
    const seen = new Map<number, SecManufacturer>();
    for (const mfr of manufacturers) {
      if (!seen.has(mfr.cik)) seen.set(mfr.cik, mfr);
    }
    const unique = Array.from(seen.values());
    console.log(`[SEC] ${manufacturers.length} -> ${unique.length} unique manufacturers`);

    // Step 4: Insert
    const { inserted, errors } = await insertSecRecords(unique, runId);

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

    console.log(`[SEC] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted} inserted`);
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
