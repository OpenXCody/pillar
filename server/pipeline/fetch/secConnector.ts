/**
 * SEC EDGAR Connector
 *
 * Fetches publicly traded manufacturer data from SEC's EDGAR system.
 *
 * Strategy: Uses SEC's company search (browse-edgar) to query by SIC code range.
 * Manufacturing SIC codes are 2000-3999. We query each 2-digit SIC prefix (20-39)
 * which returns all companies in that range. This is MUCH more efficient than
 * scanning all 10K+ tickers individually.
 *
 * API: https://efts.sec.gov/LATEST/search-index (EDGAR full-text search)
 * API: https://www.sec.gov/cgi-bin/browse-edgar (company search by SIC)
 * No API key required. Must set User-Agent header.
 * Rate limit: 10 requests/second.
 */

import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { updateProgress } from '../orchestrator.js';

const USER_AGENT = 'Pillar-Data-Pipeline/1.0 (contact@o-10.com)';

/** Delay between requests in ms — conservative to avoid rate limiting */
const REQUEST_DELAY_MS = 600;

interface SecCompanyEntry {
  cik: string;
  name: string;
  ticker: string;
  sic: string;
  stateOfIncorporation: string;
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
        // Aggressive backoff for SEC rate limits
        const delay = Math.min(10000 * Math.pow(2, attempt), 120000);
        console.log(`[SEC] Rate limited (${res.status}), backing off ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }

    return res;
  }

  throw new Error('SEC API: max retries exceeded');
}

/**
 * Fetch all companies for a given SIC code from SEC's EDGAR company search.
 * Uses the JSON output format from browse-edgar.
 */
async function fetchCompaniesBySic(sicCode: string): Promise<SecCompanyEntry[]> {
  const companies: SecCompanyEntry[] = [];
  let start = 0;
  const count = 100; // Max per page

  while (true) {
    const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&SIC=${sicCode}&owner=include&match=&start=${start}&count=${count}&hidefilings=1&output=atom`;

    try {
      const res = await fetchWithRetry(url, 2);
      if (!res.ok) {
        console.log(`[SEC] SIC ${sicCode} page ${start}: HTTP ${res.status}, skipping`);
        break;
      }

      const text = await res.text();

      // Parse Atom XML to extract company data
      // Each <entry> has <title>, <content> with CIK/SIC/State
      const entries = text.match(/<entry>[\s\S]*?<\/entry>/g) || [];

      if (entries.length === 0) break;

      for (const entry of entries) {
        const cikMatch = entry.match(/<CIK>([\d]+)<\/CIK>/i) || entry.match(/CIK=(\d+)/);
        const nameMatch = entry.match(/<company-name>([^<]+)<\/company-name>/i) || entry.match(/<title[^>]*>([^<]+)<\/title>/);
        const stateMatch = entry.match(/<State>([^<]+)<\/State>/i);

        if (cikMatch) {
          companies.push({
            cik: cikMatch[1],
            name: nameMatch ? nameMatch[1].trim() : 'Unknown',
            ticker: '', // Not available from browse-edgar
            sic: sicCode,
            stateOfIncorporation: stateMatch ? stateMatch[1] : '',
          });
        }
      }

      // If we got less than `count` entries, we've reached the end
      if (entries.length < count) break;
      start += count;

      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    } catch (err) {
      console.log(`[SEC] Error fetching SIC ${sicCode} at offset ${start}: ${err}`);
      break;
    }
  }

  return companies;
}

/**
 * Alternative approach: Use company_tickers.json + batch SIC lookup.
 * Downloads the full tickers list, then for each SIC code in manufacturing range,
 * fetches the list of companies from SEC's company search.
 */
async function fetchManufacturersBySicRange(): Promise<SecCompanyEntry[]> {
  const allManufacturers: SecCompanyEntry[] = [];
  const seen = new Set<string>();

  // Manufacturing SIC ranges: 2000-3999
  // Query each 4-digit SIC code would be 2000 requests.
  // Instead, query each 2-digit prefix (20-39) which covers the range in 20 requests.
  const sicPrefixes: string[] = [];
  for (let i = 20; i <= 39; i++) {
    sicPrefixes.push(String(i));
  }

  console.log(`[SEC] Querying ${sicPrefixes.length} SIC prefix ranges for manufacturers...`);

  for (let i = 0; i < sicPrefixes.length; i++) {
    const prefix = sicPrefixes[i];
    updateProgress('fetching', 5 + Math.round((i / sicPrefixes.length) * 70),
      `Scanning SEC SIC ${prefix}xx... (${allManufacturers.length} manufacturers found)`);

    const companies = await fetchCompaniesBySic(prefix);

    for (const co of companies) {
      if (!seen.has(co.cik)) {
        seen.add(co.cik);
        allManufacturers.push(co);
      }
    }

    console.log(`[SEC] SIC ${prefix}xx: ${companies.length} companies (${allManufacturers.length} total unique)`);
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  console.log(`[SEC] Total unique manufacturers found: ${allManufacturers.length}`);
  return allManufacturers;
}

/**
 * Insert SEC manufacturer records into raw_records in batches.
 */
async function insertSecRecords(records: SecCompanyEntry[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(row => ({
      source: 'sec_edgar' as const,
      sourceRunId: runId,
      sourceRecordId: `sec_${padCik(row.cik)}`,
      rawName: row.name || null,
      rawAddress: null,
      rawCity: null,
      rawState: row.stateOfIncorporation || null,
      rawZip: null,
      rawNaicsCode: sicToNaics(row.sic),
      rawNaicsDescription: sicToNaicsDescription(row.sic),
      rawSicCode: row.sic || null,
      secCik: padCik(row.cik),
      secTicker: row.ticker || null,
      secSicCode: row.sic || null,
      rawJson: null,
    }));

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      errors.push(`Batch insert error at offset ${i}: ${err}`);
    }

    updateProgress('fetching', 75 + Math.round((i / records.length) * 20),
      `Inserting SEC records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full SEC EDGAR fetch pipeline:
 * 1. Query SEC company search by SIC code range (20xx-39xx)
 * 2. Collect all unique manufacturers
 * 3. Insert as raw records
 */
export async function fetchSec(runId: string): Promise<SecFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    // Step 1: Fetch manufacturers by SIC range
    updateProgress('fetching', 2, 'Querying SEC for manufacturers by SIC code...');
    const manufacturers = await fetchManufacturersBySicRange();

    if (manufacturers.length === 0) {
      console.log('[SEC] No manufacturers found - this likely means rate limiting prevented data fetch');
    }

    // Step 2: Insert
    const { inserted, errors } = await insertSecRecords(manufacturers, runId);

    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'completed',
      completedAt: new Date(),
      totalFetched: manufacturers.length,
      newRecords: inserted,
      errorCount: errors.length,
      errorLog: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      durationMs,
    }).where(eq(sourceRuns.id, runId));

    console.log(`[SEC] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted} inserted`);
    return { totalFetched: manufacturers.length, inserted, errors };
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
