/**
 * NHTSA Registered Manufacturers Connector
 *
 * Fetches manufacturer data from NHTSA's vPIC (Vehicle Product Information Catalog)
 * API. Includes vehicle, equipment, and parts manufacturers registered with DOT.
 *
 * API: https://vpic.nhtsa.dot.gov/api/
 * Endpoint: GetAllManufacturers (paginated, JSON)
 * No API key required. Public data. ~3K+ US manufacturers.
 */

import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { updateProgress } from '../orchestrator.js';
import { isAddressStub } from '../../../shared/addressStubFilter.js';

const NHTSA_API_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const PAGE_SIZE = 100;

interface NhtsaManufacturer {
  Mfr_ID: number;
  Mfr_Name: string;
  Mfr_CommonName: string | null;
  Country: string;
  StateProvince: string | null;
  City: string | null;
  PostalCode: string | null;
  Address: string | null;
  Address2: string | null;
  ContactEmail: string | null;
  ContactPhone: string | null;
  VehicleTypes: { IsPrimary: boolean; Name: string }[];
}

interface NhtsaApiResponse {
  Count: number;
  Message: string;
  SearchCriteria: string;
  Results: NhtsaManufacturer[];
}

export interface NhtsaFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

/**
 * Fetch a page of manufacturers from the vPIC API
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pillar-Data-Pipeline/1.0)' },
    });

    if (res.status === 403 || res.status === 429) {
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        console.log(`[NHTSA] Rate limited (${res.status}), retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }

    return res;
  }

  // Shouldn't reach here, but TypeScript needs a return
  throw new Error('NHTSA API: max retries exceeded');
}

async function fetchNhtsaPage(page: number): Promise<NhtsaManufacturer[]> {
  const url = `${NHTSA_API_BASE}/getallmanufacturers?ManufacturerType=&format=json&page=${page}`;

  const res = await fetchWithRetry(url);

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`NHTSA API error: ${res.status} ${res.statusText}`);
  }

  const data: NhtsaApiResponse = await res.json();
  return data.Results || [];
}

/**
 * Fetch manufacturer details by ID (includes address data)
 */
async function fetchManufacturerDetails(mfrId: number): Promise<NhtsaManufacturer | null> {
  const url = `${NHTSA_API_BASE}/getmanufacturerdetails/${mfrId}?format=json`;

  try {
    const res = await fetchWithRetry(url, 2);

    if (!res.ok) return null;

    const data = await res.json();
    const result = data.Results?.[0];
    if (!result) return null;

    return {
      Mfr_ID: result.Mfr_ID,
      Mfr_Name: result.Mfr_Name,
      Mfr_CommonName: result.Mfr_CommonName,
      Country: result.Country,
      StateProvince: result.StateProvince,
      City: result.City,
      PostalCode: result.PostalCode,
      Address: result.Address,
      Address2: result.Address2,
      ContactEmail: result.ContactEmail,
      ContactPhone: result.ContactPhone,
      VehicleTypes: result.VehicleTypes || result.ManufacturerTypes || [],
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all US manufacturers from NHTSA.
 * Step 1: Get IDs from list endpoint (fast, no address data)
 * Step 2: Fetch details for US manufacturers (address, city, state, zip)
 */
async function fetchAllNhtsaManufacturers(): Promise<NhtsaManufacturer[]> {
  const allRows: NhtsaManufacturer[] = [];
  let page = 1;
  let hasMore = true;
  let emptyPages = 0;

  console.log('[NHTSA] Step 1: Fetching manufacturer list...');

  // Step 1: Get all manufacturer IDs (fast)
  while (hasMore) {
    updateProgress('fetching', 2 + Math.min(15, Math.round(page / 10)), `Fetching NHTSA list page ${page}...`);

    const rows = await fetchNhtsaPage(page);

    if (rows.length === 0) {
      emptyPages++;
      if (emptyPages >= 3) hasMore = false;
    } else {
      emptyPages = 0;
      allRows.push(...rows);

      if (rows.length < PAGE_SIZE) hasMore = false;
    }

    page++;
    await new Promise(r => setTimeout(r, 200));

    if (page > 200) {
      console.log('[NHTSA] Reached page limit, stopping');
      hasMore = false;
    }

    if (page % 50 === 0) {
      console.log(`[NHTSA] List: ${allRows.length} manufacturers so far...`);
    }
  }

  console.log(`[NHTSA] List complete: ${allRows.length} total manufacturers`);

  // Step 2: Filter to US, then fetch details for address data
  const usManufacturers = filterUsManufacturers(allRows);
  console.log(`[NHTSA] ${usManufacturers.length} US manufacturers, fetching details...`);

  // Fetch details in parallel batches of 10 for address data
  const DETAIL_BATCH = 10;
  let detailsFetched = 0;
  let consecutiveFailures = 0;
  const detailed: NhtsaManufacturer[] = [];

  for (let i = 0; i < usManufacturers.length; i += DETAIL_BATCH) {
    // If too many consecutive failures, skip detail phase entirely
    if (consecutiveFailures >= 30) {
      console.log(`[NHTSA] Too many detail failures (rate limited?). Using list data for remaining ${usManufacturers.length - i} manufacturers.`);
      for (let k = i; k < usManufacturers.length; k++) {
        detailed.push(usManufacturers[k]);
      }
      break;
    }

    const batch = usManufacturers.slice(i, i + DETAIL_BATCH);
    const promises = batch.map(m => fetchManufacturerDetails(m.Mfr_ID));
    const results = await Promise.all(promises);

    let batchFailures = 0;
    for (let j = 0; j < batch.length; j++) {
      const detail = results[j];
      if (detail) {
        detailed.push(detail);
        consecutiveFailures = 0;
      } else {
        // Fallback to list data if detail fetch fails
        detailed.push(batch[j]);
        batchFailures++;
        consecutiveFailures++;
      }
    }

    detailsFetched += batch.length;
    if (detailsFetched % 500 === 0 || detailsFetched === usManufacturers.length) {
      const pct = Math.round((detailsFetched / usManufacturers.length) * 100);
      updateProgress('fetching', 20 + Math.round(pct * 0.5), `Fetching NHTSA details... ${detailsFetched.toLocaleString()} / ${usManufacturers.length.toLocaleString()}`);
      console.log(`[NHTSA] Details: ${detailsFetched.toLocaleString()} / ${usManufacturers.length.toLocaleString()} (${pct}%)`);
    }

    // Adaptive rate limiting: back off more if we're hitting failures
    const delay = batchFailures > 0 ? 500 : 100;
    await new Promise(r => setTimeout(r, delay));
  }

  console.log(`[NHTSA] Details complete: ${detailed.length} with address data`);
  return detailed;
}

/**
 * Filter to US-based manufacturers and those likely to be manufacturing facilities
 */
function filterUsManufacturers(rows: NhtsaManufacturer[]): NhtsaManufacturer[] {
  return rows.filter(row => {
    // Filter to US-based
    const country = (row.Country || '').toUpperCase();
    if (country && country !== 'UNITED STATES (USA)' && country !== 'USA' && country !== 'US' && country !== 'UNITED STATES') {
      return false;
    }

    // Must have a name
    if (!row.Mfr_Name && !row.Mfr_CommonName) return false;

    return true;
  });
}

/**
 * Map NHTSA vehicle types to NAICS codes
 */
function nhtsaTypeToNaics(vehicleTypes: { IsPrimary: boolean; Name: string }[]): string {
  if (!vehicleTypes || vehicleTypes.length === 0) return '336110'; // Motor Vehicle Mfg

  const types = vehicleTypes.map(vt => vt.Name.toLowerCase());

  // Map specific vehicle types to NAICS
  if (types.some(t => t.includes('motorcycle'))) return '336991'; // Motorcycle Manufacturing
  if (types.some(t => t.includes('trailer'))) return '336212'; // Truck Trailer Manufacturing
  if (types.some(t => t.includes('bus'))) return '336120'; // Heavy Duty Truck Manufacturing
  if (types.some(t => t.includes('truck') || t.includes('heavy'))) return '336120';
  if (types.some(t => t.includes('passenger'))) return '336111'; // Automobile Manufacturing
  if (types.some(t => t.includes('low speed'))) return '336999'; // Other Transportation Equipment
  if (types.some(t => t.includes('multipurpose'))) return '336112'; // Light Truck and Utility Vehicle
  if (types.some(t => t.includes('equipment') || t.includes('component'))) return '336390'; // Other Motor Vehicle Parts

  return '336110'; // Motor Vehicle Manufacturing (general)
}

/**
 * Extract US state code from NHTSA state field
 */
function normalizeState(stateField: string | null): string | null {
  if (!stateField) return null;
  const state = stateField.trim().toUpperCase();
  // Already a 2-letter code
  if (state.length === 2) return state;

  // Common state name to code mappings
  const STATE_MAP: Record<string, string> = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC', 'PUERTO RICO': 'PR',
  };

  return STATE_MAP[state] || (state.length <= 2 ? state : null);
}

/**
 * Insert NHTSA records into raw_records
 */
async function insertNhtsaRecords(records: NhtsaManufacturer[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  const filtered = records.filter(row => !isAddressStub(row.Mfr_CommonName || row.Mfr_Name));
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE).map(row => {
      const name = row.Mfr_CommonName || row.Mfr_Name;
      const vehicleTypeNames = (row.VehicleTypes || []).map(vt => vt.Name);

      return {
        source: 'nhtsa' as const,
        sourceRunId: runId,
        sourceRecordId: `nhtsa_${row.Mfr_ID}`,
        rawName: name || null,
        rawAddress: [row.Address, row.Address2].filter(Boolean).join(', ') || null,
        rawCity: row.City || null,
        rawState: normalizeState(row.StateProvince),
        rawZip: row.PostalCode || null,
        rawNaicsCode: nhtsaTypeToNaics(row.VehicleTypes || []),
        rawNaicsDescription: 'Motor Vehicle Manufacturing',
        nhtsaMfrId: String(row.Mfr_ID),
        nhtsaVehicleTypes: vehicleTypeNames.length > 0 ? JSON.stringify(vehicleTypeNames) : null,
        rawJson: null,
      };
    });

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      errors.push(`Batch insert error at offset ${i}: ${err}`);
    }

    updateProgress('fetching', 40 + Math.round((i / records.length) * 30),
      `Inserting NHTSA records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full NHTSA fetch pipeline
 */
export async function fetchNhtsa(runId: string): Promise<NhtsaFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    // Fetch all pages
    const allRows = await fetchAllNhtsaManufacturers();

    // Filter to US manufacturers
    const usRows = filterUsManufacturers(allRows);
    console.log(`[NHTSA] ${allRows.length} total → ${usRows.length} US manufacturers`);

    // Deduplicate by manufacturer ID
    const seen = new Map<number, NhtsaManufacturer>();
    for (const row of usRows) {
      if (!seen.has(row.Mfr_ID)) seen.set(row.Mfr_ID, row);
    }
    const unique = Array.from(seen.values());
    console.log(`[NHTSA] ${usRows.length} → ${unique.length} unique`);

    // Insert
    const { inserted, errors } = await insertNhtsaRecords(unique, runId);

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

    console.log(`[NHTSA] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted} inserted`);
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
