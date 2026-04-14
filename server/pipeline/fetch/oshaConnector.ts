/**
 * OSHA Establishment Connector
 *
 * Imports manufacturing establishments from OSHA inspection data.
 * OSHA inspections cover ~130K+ establishments with employee counts and SIC/NAICS codes.
 *
 * Data Source:
 * DOL Enforcement Data: https://enforcedata.dol.gov/
 * - Bulk inspection CSV available as ZIP download
 * - Also supports local CSV placed at downloads/osha_inspections.csv
 *
 * Key fields: establishment name, address, employee count, NAICS/SIC code, inspection date
 *
 * Deduplication: Multiple inspections per establishment — keeps most recent per unique location.
 * Manufacturing filter: NAICS 31-33 or SIC 20-39
 */

import { createReadStream } from 'fs';
import { stat, mkdir } from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';
import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { updateProgress } from '../orchestrator.js';

const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');
const OSHA_CSV_PATH = path.join(DOWNLOAD_DIR, 'osha_inspections.csv');
const OSHA_ZIP_PATH = path.join(DOWNLOAD_DIR, 'osha_inspection.csv.zip');

// DOL bulk data URL (the inspection CSV ZIP)
const OSHA_BULK_URLS = [
  'https://enforcedata.dol.gov/views/data_summary.php/download/osha_inspection.csv.zip',
  'https://enforcedata.dol.gov/views/data_catalog/OSHA/osha_inspection.csv.zip',
];

interface OshaEstablishment {
  activityNr: string;
  establishmentName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naicsCode: string;
  sicCode: string;
  employeeCount: number | null;
  inspectionDate: string;
  ownerType: string;
}

export interface OshaFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

/**
 * SIC code ranges for manufacturing (SIC 20-39)
 */
function isManufacturingSic(sic: string): boolean {
  const code = parseInt(sic, 10);
  return code >= 2000 && code <= 3999;
}

function isManufacturingNaics(naics: string): boolean {
  return naics.startsWith('31') || naics.startsWith('32') || naics.startsWith('33');
}

/**
 * Try to load OSHA data from local file, then attempt remote download.
 */
async function fetchOshaData(): Promise<OshaEstablishment[]> {
  // Priority 1: Check for local CSV
  try {
    const csvStat = await stat(OSHA_CSV_PATH);
    if (csvStat.size > 1000) {
      console.log(`[OSHA] Found local CSV: ${OSHA_CSV_PATH} (${(csvStat.size / 1024 / 1024).toFixed(1)} MB)`);
      updateProgress('fetching', 10, 'Parsing local OSHA CSV...');
      return await parseOshaCsv(OSHA_CSV_PATH);
    }
  } catch { /* file doesn't exist */ }

  // Priority 2: Try downloading bulk ZIP
  console.log('[OSHA] No local file found. Attempting bulk download...');
  updateProgress('fetching', 5, 'Downloading OSHA inspection data...');

  await mkdir(DOWNLOAD_DIR, { recursive: true });

  for (const url of OSHA_BULK_URLS) {
    try {
      console.log(`[OSHA] Trying: ${url}`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Pillar-Data-Pipeline/1.0' },
        redirect: 'follow',
      });

      if (!res.ok) {
        console.log(`[OSHA] ${res.status} from ${url}`);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('html')) {
        console.log('[OSHA] Got HTML instead of data, skipping');
        continue;
      }

      // Save ZIP file
      const buffer = Buffer.from(await res.arrayBuffer());
      const { writeFileSync } = await import('fs');
      writeFileSync(OSHA_ZIP_PATH, buffer);
      console.log(`[OSHA] Downloaded ZIP: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

      // Extract CSV from ZIP
      updateProgress('fetching', 15, 'Extracting OSHA CSV from ZIP...');
      await extractZip(OSHA_ZIP_PATH, DOWNLOAD_DIR);

      // Check if the extracted CSV exists
      const extractedStat = await stat(OSHA_CSV_PATH);
      if (extractedStat.size > 1000) {
        return await parseOshaCsv(OSHA_CSV_PATH);
      }
    } catch (err) {
      console.log(`[OSHA] Error from ${url}:`, String(err).slice(0, 200));
    }
  }

  // Priority 3: Try DOL data API (paginated)
  console.log('[OSHA] Bulk download failed. Trying DOL data API...');
  const apiRecords = await fetchFromDolApi();
  if (apiRecords.length > 0) return apiRecords;

  console.log('[OSHA] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[OSHA] No automated OSHA data source available.');
  console.log('[OSHA] To import OSHA data manually:');
  console.log('[OSHA]   1. Visit https://enforcedata.dol.gov/views/data_catalog.php');
  console.log('[OSHA]   2. Download "OSHA Inspection" CSV');
  console.log('[OSHA]   3. Place at: downloads/osha_inspections.csv');
  console.log('[OSHA]   4. Re-run this sync');
  console.log('[OSHA] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return [];
}

/**
 * Extract a ZIP file using Node's built-in zlib (single-file ZIPs only)
 * Falls back to unzip shell command if available
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  try {
    // Try using unzip command if available
    const { execSync } = await import('child_process');
    execSync(`unzip -o "${zipPath}" -d "${destDir}" 2>/dev/null`, { stdio: 'pipe' });
    console.log('[OSHA] Extracted via unzip command');

    // Rename the extracted file if needed (DOL names it osha_inspection.csv)
    const extractedPath = path.join(destDir, 'osha_inspection.csv');
    try {
      await stat(extractedPath);
      if (extractedPath !== OSHA_CSV_PATH) {
        const { renameSync } = await import('fs');
        renameSync(extractedPath, OSHA_CSV_PATH);
      }
    } catch { /* already named correctly or doesn't exist */ }
  } catch {
    console.log('[OSHA] Could not extract ZIP — unzip command not available');
    console.log('[OSHA] Please manually extract the ZIP and place osha_inspections.csv in downloads/');
  }
}

/**
 * Parse OSHA inspection CSV and extract manufacturing establishments
 */
async function parseOshaCsv(csvPath: string): Promise<OshaEstablishment[]> {
  // Map from deduplicate key -> most recent record
  const establishments = new Map<string, OshaEstablishment>();
  let totalRows = 0;
  let mfgRows = 0;

  return new Promise((resolve, reject) => {
    const stream = createReadStream(csvPath, { encoding: 'utf-8' });
    Papa.parse<Record<string, string>>(stream, {
      header: true,
      skipEmptyLines: true,
      step: (row) => {
        totalRows++;
        if (totalRows % 50000 === 0) {
          updateProgress('fetching', 10 + Math.min(30, Math.round((totalRows / 200000) * 30)),
            `Parsing OSHA... ${totalRows.toLocaleString()} rows, ${mfgRows.toLocaleString()} mfg`);
        }

        const record = parseOshaRow(row.data);
        if (!record) return;

        // Filter to manufacturing only
        const hasMfgNaics = record.naicsCode && isManufacturingNaics(record.naicsCode);
        const hasMfgSic = record.sicCode && isManufacturingSic(record.sicCode);
        if (!hasMfgNaics && !hasMfgSic) return;

        mfgRows++;

        // Deduplicate by establishment location (keep most recent inspection)
        const key = `${record.establishmentName.toUpperCase()}|${record.city.toUpperCase()}|${record.state.toUpperCase()}`;
        const existing = establishments.get(key);
        if (!existing || (record.inspectionDate > existing.inspectionDate)) {
          establishments.set(key, record);
        }
      },
      complete: () => {
        console.log(`[OSHA] Parsed ${totalRows.toLocaleString()} total rows → ${mfgRows.toLocaleString()} mfg → ${establishments.size.toLocaleString()} unique establishments`);
        resolve(Array.from(establishments.values()));
      },
      error: (err) => reject(new Error(`OSHA CSV parse error: ${err.message}`)),
    });
  });
}

/**
 * Parse a single OSHA inspection CSV row
 */
function parseOshaRow(row: Record<string, string>): OshaEstablishment | null {
  const name = row['estab_name'] || row['ESTAB_NAME'] || row['EstabName'] || '';
  if (!name.trim()) return null;

  const state = (row['site_state'] || row['SITE_STATE'] || row['SiteState'] || '').trim();
  if (!state || state.length !== 2) return null;

  const empStr = row['nr_in_estab'] || row['NR_IN_ESTAB'] || row['NrInEstab'] || '';
  let employeeCount: number | null = parseInt(empStr, 10);
  if (isNaN(employeeCount) || employeeCount <= 0) employeeCount = null;

  return {
    activityNr: (row['activity_nr'] || row['ACTIVITY_NR'] || row['ActivityNr'] || '').trim(),
    establishmentName: name.trim(),
    address: (row['site_address'] || row['SITE_ADDRESS'] || row['SiteAddress'] || '').trim(),
    city: (row['site_city'] || row['SITE_CITY'] || row['SiteCity'] || '').trim(),
    state,
    zip: (row['site_zip'] || row['SITE_ZIP'] || row['SiteZip'] || '').trim().slice(0, 10),
    naicsCode: (row['naics_code'] || row['NAICS_CODE'] || row['NaicsCode'] || '').trim().slice(0, 6),
    sicCode: (row['sic_code'] || row['SIC_CODE'] || row['SicCode'] || '').trim().slice(0, 4),
    employeeCount,
    inspectionDate: (row['open_date'] || row['OPEN_DATE'] || row['OpenDate'] || '').trim(),
    ownerType: (row['owner_type'] || row['OWNER_TYPE'] || row['OwnerType'] || '').trim(),
  };
}

/**
 * Fallback: Try paginated fetch from DOL data API
 */
async function fetchFromDolApi(): Promise<OshaEstablishment[]> {
  const establishments = new Map<string, OshaEstablishment>();
  const PAGE_SIZE = 200;
  const MAX_PAGES = 1500; // Cap at 300K records
  let offset = 0;
  let emptyPages = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const url = `https://data.dol.gov/get/inspection/limit/${PAGE_SIZE}/offset/${offset}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Pillar-Data-Pipeline/1.0', 'Accept': 'application/json' },
      });

      if (!res.ok) {
        console.log(`[OSHA] DOL API returned ${res.status}, stopping pagination`);
        break;
      }

      const data = await res.json() as Record<string, string>[];
      if (!Array.isArray(data) || data.length === 0) {
        emptyPages++;
        if (emptyPages >= 3) break;
        offset += PAGE_SIZE;
        continue;
      }

      emptyPages = 0;
      for (const row of data) {
        const record = parseOshaRow(row);
        if (!record) continue;

        const hasMfgNaics = record.naicsCode && isManufacturingNaics(record.naicsCode);
        const hasMfgSic = record.sicCode && isManufacturingSic(record.sicCode);
        if (!hasMfgNaics && !hasMfgSic) continue;

        const key = `${record.establishmentName.toUpperCase()}|${record.city.toUpperCase()}|${record.state.toUpperCase()}`;
        const existing = establishments.get(key);
        if (!existing || (record.inspectionDate > existing.inspectionDate)) {
          establishments.set(key, record);
        }
      }

      offset += PAGE_SIZE;
      if (page % 50 === 0) {
        updateProgress('fetching', 10 + Math.min(30, Math.round((page / MAX_PAGES) * 30)),
          `DOL API page ${page}... ${establishments.size.toLocaleString()} mfg establishments`);
      }

      // Small delay to be respectful
      if (page % 10 === 9) await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`[OSHA] DOL API error at offset ${offset}:`, String(err).slice(0, 100));
      break;
    }
  }

  console.log(`[OSHA] DOL API: ${establishments.size} unique manufacturing establishments`);
  return Array.from(establishments.values());
}

/**
 * Convert SIC code to approximate NAICS for establishments that only have SIC
 */
function sicToNaicsApprox(sic: string): string | null {
  const code = parseInt(sic, 10);
  if (isNaN(code)) return null;

  // Major SIC manufacturing divisions → NAICS 2-digit mapping
  if (code >= 2000 && code < 2100) return '311'; // Food
  if (code >= 2100 && code < 2200) return '312'; // Tobacco/Beverage
  if (code >= 2200 && code < 2400) return '313'; // Textiles/Apparel
  if (code >= 2400 && code < 2500) return '321'; // Wood
  if (code >= 2500 && code < 2600) return '337'; // Furniture
  if (code >= 2600 && code < 2700) return '322'; // Paper
  if (code >= 2700 && code < 2800) return '323'; // Printing
  if (code >= 2800 && code < 2900) return '325'; // Chemicals
  if (code >= 2900 && code < 3000) return '324'; // Petroleum
  if (code >= 3000 && code < 3100) return '326'; // Rubber/Plastics
  if (code >= 3100 && code < 3200) return '316'; // Leather
  if (code >= 3200 && code < 3300) return '327'; // Stone/Clay/Glass
  if (code >= 3300 && code < 3400) return '331'; // Primary Metal
  if (code >= 3400 && code < 3500) return '332'; // Fabricated Metal
  if (code >= 3500 && code < 3600) return '333'; // Machinery
  if (code >= 3600 && code < 3700) return '335'; // Electrical
  if (code >= 3700 && code < 3800) return '336'; // Transportation Equipment
  if (code >= 3800 && code < 3900) return '334'; // Instruments
  if (code >= 3900 && code < 4000) return '339'; // Misc Manufacturing
  return null;
}

/**
 * Insert OSHA establishments into raw_records
 */
async function insertOshaRecords(records: OshaEstablishment[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(r => {
      // Use NAICS if available, otherwise convert from SIC
      let naics = r.naicsCode || null;
      if (!naics && r.sicCode) {
        naics = sicToNaicsApprox(r.sicCode);
      }

      return {
        source: 'osha' as const,
        sourceRunId: runId,
        sourceRecordId: r.activityNr || `osha_${r.establishmentName}_${r.state}_${r.city}`,
        rawName: r.establishmentName || null,
        rawAddress: r.address || null,
        rawCity: r.city || null,
        rawState: r.state || null,
        rawZip: r.zip || null,
        rawNaicsCode: naics,
        rawSicCode: r.sicCode || null,
        oshaActivityId: r.activityNr || null,
        oshaEmployeeCount: r.employeeCount,
        oshaInspectionDate: r.inspectionDate ? new Date(r.inspectionDate) : null,
        rawJson: null,
      };
    });

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      // Try one-by-one for this batch to handle individual conflicts
      for (const record of batch) {
        try {
          await db.insert(rawRecords).values(record);
          inserted++;
        } catch (innerErr) {
          errors.push(`Record ${record.sourceRecordId}: ${String(innerErr).slice(0, 80)}`);
        }
      }
    }

    updateProgress('fetching', 40 + Math.round((i / records.length) * 40),
      `Inserting OSHA records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full OSHA fetch pipeline
 */
export async function fetchOsha(runId: string): Promise<OshaFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    const records = await fetchOshaData();

    if (records.length === 0) {
      const durationMs = Date.now() - startTime;
      await db.update(sourceRuns).set({
        status: 'completed',
        completedAt: new Date(),
        totalFetched: 0,
        newRecords: 0,
        errorCount: 1,
        errorLog: JSON.stringify(['No records fetched — place OSHA CSV at downloads/osha_inspections.csv']),
        durationMs,
      }).where(eq(sourceRuns.id, runId));
      return { totalFetched: 0, inserted: 0, errors: ['No data source available'] };
    }

    const { inserted, errors } = await insertOshaRecords(records, runId);

    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'completed',
      completedAt: new Date(),
      totalFetched: records.length,
      newRecords: inserted,
      errorCount: errors.length,
      errorLog: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      durationMs,
    }).where(eq(sourceRuns.id, runId));

    console.log(`[OSHA] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted.toLocaleString()} inserted from ${records.length.toLocaleString()} establishments`);
    return { totalFetched: records.length, inserted, errors };
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
