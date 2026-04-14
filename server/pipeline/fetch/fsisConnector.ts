/**
 * USDA FSIS Establishment Connector
 *
 * Imports meat, poultry, and egg product inspection establishments from the
 * USDA Food Safety and Inspection Service (FSIS) directory.
 *
 * Coverage: ~6,800 federally inspected plants
 * Key data: Establishment number, company name, activities (slaughter, processing, etc.),
 *           DBA names, size category
 *
 * Data Source:
 * FSIS MPI Directory: https://www.fsis.usda.gov/inspection/establishments/
 * - CSV download of Meat, Poultry and Egg Product Inspection Directory
 * - Also supports local CSV placed at downloads/fsis_directory.csv
 *
 * All FSIS establishments are food manufacturing (NAICS 311)
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
const FSIS_CSV_PATH = path.join(DOWNLOAD_DIR, 'fsis_directory.csv');

// Possible download URLs for the FSIS MPI directory
const FSIS_URLS = [
  'https://www.fsis.usda.gov/sites/default/files/media_file/MPI_Directory_by_Establishment_Name.csv',
  'https://www.fsis.usda.gov/sites/default/files/media_file/MPI_Directory_Establishment.csv',
  'https://www.fsis.usda.gov/sites/default/files/media_file/mpi-directory.csv',
];

interface FsisEstablishment {
  estNumber: string;
  company: string;
  dbaName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  activities: string;    // "Slaughter", "Processing", etc.
  dbas: string;
  grantDate: string;
  size: string;          // "Large", "Small", "Very Small"
}

export interface FsisFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

/**
 * Map FSIS activities to more specific NAICS codes
 */
function fsisActivityToNaics(activities: string): string {
  const act = (activities || '').toUpperCase();

  // Poultry processing/slaughter
  if (act.includes('POULTRY')) return '311615'; // Poultry Processing

  // Meat slaughter
  if (act.includes('SLAUGHTER') && !act.includes('POULTRY')) return '311611'; // Animal Slaughtering

  // Meat processing (sausage, curing, etc.)
  if (act.includes('PROCESSING') || act.includes('CURING') || act.includes('SAUSAGE'))
    return '311612'; // Meat Processed from Carcasses

  // Rendering
  if (act.includes('RENDERING')) return '311613'; // Rendering and Meat Byproduct Processing

  // Egg processing
  if (act.includes('EGG')) return '311999'; // All Other Miscellaneous Food Manufacturing

  // Default: general food manufacturing
  return '311611';
}

/**
 * Determine size category for the establishment
 */
function normalizeSizeCategory(size: string): string | null {
  const s = (size || '').toLowerCase().trim();
  if (s.includes('large') && !s.includes('very')) return 'Large';
  if (s.includes('small') && !s.includes('very')) return 'Small';
  if (s.includes('very small') || s.includes('very_small')) return 'Very Small';
  return null;
}

/**
 * Try to load FSIS data from local file, then attempt remote download.
 */
async function fetchFsisData(): Promise<FsisEstablishment[]> {
  // Priority 1: Check for local CSV
  try {
    const csvStat = await stat(FSIS_CSV_PATH);
    if (csvStat.size > 100) {
      console.log(`[FSIS] Found local CSV: ${FSIS_CSV_PATH} (${(csvStat.size / 1024).toFixed(1)} KB)`);
      updateProgress('fetching', 10, 'Parsing local FSIS CSV...');
      return await parseFsisCsv(FSIS_CSV_PATH);
    }
  } catch { /* file doesn't exist */ }

  // Priority 2: Check for alternate local file names
  const altNames = ['MPI_Directory_by_Establishment_Name.csv', 'MPI_Directory_Establishment.csv', 'mpi-directory.csv'];
  for (const name of altNames) {
    const altPath = path.join(DOWNLOAD_DIR, name);
    try {
      const altStat = await stat(altPath);
      if (altStat.size > 100) {
        console.log(`[FSIS] Found local CSV: ${altPath}`);
        updateProgress('fetching', 10, 'Parsing local FSIS CSV...');
        return await parseFsisCsv(altPath);
      }
    } catch { /* doesn't exist */ }
  }

  // Priority 3: Try downloading from FSIS website
  console.log('[FSIS] No local file found. Attempting download...');
  updateProgress('fetching', 5, 'Downloading FSIS directory...');
  await mkdir(DOWNLOAD_DIR, { recursive: true });

  for (const url of FSIS_URLS) {
    try {
      console.log(`[FSIS] Trying: ${url}`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Pillar-Data-Pipeline/1.0' },
        redirect: 'follow',
      });

      if (!res.ok) {
        console.log(`[FSIS] ${res.status} from ${url}`);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      // Check it's actually CSV data, not an HTML redirect
      if (contentType.includes('html')) {
        const text = await res.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html>')) {
          console.log('[FSIS] Got HTML redirect instead of CSV, skipping');
          continue;
        }
      }

      const text = await res.text();
      if (text.length < 500) {
        console.log(`[FSIS] Response too small (${text.length} bytes), skipping`);
        continue;
      }

      // Save to disk for caching
      const { writeFileSync } = await import('fs');
      writeFileSync(FSIS_CSV_PATH, text);
      console.log(`[FSIS] Downloaded and saved: ${(text.length / 1024).toFixed(1)} KB`);

      return await parseFsisCsvText(text);
    } catch (err) {
      console.log(`[FSIS] Error from ${url}:`, String(err).slice(0, 200));
    }
  }

  console.log('[FSIS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[FSIS] No automated FSIS data source available.');
  console.log('[FSIS] To import FSIS data manually:');
  console.log('[FSIS]   1. Visit https://www.fsis.usda.gov/inspection/establishments/meat-poultry-and-egg-product-inspection-directory');
  console.log('[FSIS]   2. Download the MPI Directory CSV');
  console.log('[FSIS]   3. Place at: downloads/fsis_directory.csv');
  console.log('[FSIS]   4. Re-run this sync');
  console.log('[FSIS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return [];
}

/**
 * Parse FSIS CSV from file path
 */
async function parseFsisCsv(csvPath: string): Promise<FsisEstablishment[]> {
  const records: FsisEstablishment[] = [];

  return new Promise((resolve, reject) => {
    const stream = createReadStream(csvPath, { encoding: 'utf-8' });
    Papa.parse<Record<string, string>>(stream, {
      header: true,
      skipEmptyLines: true,
      step: (row) => {
        const record = parseFsisRow(row.data);
        if (record) records.push(record);
      },
      complete: () => {
        console.log(`[FSIS] Parsed ${records.length} establishments from CSV`);
        resolve(deduplicateFsis(records));
      },
      error: (err) => reject(new Error(`FSIS CSV parse error: ${err.message}`)),
    });
  });
}

/**
 * Parse FSIS CSV from string
 */
async function parseFsisCsvText(text: string): Promise<FsisEstablishment[]> {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const records: FsisEstablishment[] = [];
  for (const row of parsed.data) {
    const record = parseFsisRow(row);
    if (record) records.push(record);
  }
  console.log(`[FSIS] Parsed ${records.length} establishments from download`);
  return deduplicateFsis(records);
}

/**
 * Parse a single FSIS CSV row (handles multiple column naming conventions)
 */
function parseFsisRow(row: Record<string, string>): FsisEstablishment | null {
  // FSIS CSV columns vary by version
  const estNumber =
    row['EstNumber'] || row['Est Number'] || row['EST_NUMBER'] || row['Establishment Number'] ||
    row['est_number'] || row['EstablishmentNumber'] || row['M&PI Number'] || '';
  if (!estNumber.trim()) return null;

  const company =
    row['Company'] || row['COMPANY'] || row['company'] || row['Establishment Name'] ||
    row['EstName'] || row['Operator'] || '';

  const state =
    row['State'] || row['STATE'] || row['state'] || row['St'] || '';
  if (!state.trim()) return null;

  // Filter to US states only (skip territories for now, but include them)
  if (state.trim().length !== 2) return null;

  return {
    estNumber: estNumber.trim(),
    company: company.trim(),
    dbaName: (row['DBAName'] || row['DBA Name'] || row['DBA'] || row['dba_name'] || '').trim(),
    street: (row['Street'] || row['STREET'] || row['Address'] || row['street'] || '').trim(),
    city: (row['City'] || row['CITY'] || row['city'] || '').trim(),
    state: state.trim().toUpperCase(),
    zip: (row['Zip'] || row['ZIP'] || row['Zip Code'] || row['zip'] || '').trim().slice(0, 10),
    phone: (row['Phone'] || row['PHONE'] || row['phone'] || '').trim(),
    activities: (row['Activities'] || row['ACTIVITIES'] || row['activities'] || row['Activity'] || '').trim(),
    dbas: (row['DBAs'] || row['DBAS'] || row['dbas'] || '').trim(),
    grantDate: (row['Grant Date'] || row['GrantDate'] || row['grant_date'] || '').trim(),
    size: (row['Size'] || row['SIZE'] || row['size'] || row['Size Range'] || '').trim(),
  };
}

/**
 * Deduplicate FSIS records by establishment number
 */
function deduplicateFsis(records: FsisEstablishment[]): FsisEstablishment[] {
  const byEst = new Map<string, FsisEstablishment>();
  for (const r of records) {
    const key = r.estNumber;
    if (!byEst.has(key)) {
      byEst.set(key, r);
    } else {
      // Merge activities from duplicate rows
      const existing = byEst.get(key)!;
      if (r.activities && !existing.activities.includes(r.activities)) {
        existing.activities = [existing.activities, r.activities].filter(Boolean).join(', ');
      }
    }
  }
  const unique = Array.from(byEst.values());
  console.log(`[FSIS] ${records.length} rows → ${unique.length} unique establishments`);
  return unique;
}

/**
 * Insert FSIS establishments into raw_records
 */
async function insertFsisRecords(records: FsisEstablishment[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
      source: 'usda_fsis' as const,
      sourceRunId: runId,
      sourceRecordId: `FSIS-${r.estNumber}`,
      rawName: r.company || r.dbaName || `FSIS Est. ${r.estNumber}`,
      rawAddress: r.street || null,
      rawCity: r.city || null,
      rawState: r.state || null,
      rawZip: r.zip || null,
      rawNaicsCode: fsisActivityToNaics(r.activities),
      rawNaicsDescription: 'Food Manufacturing',
      fsisEstNumber: r.estNumber,
      fsisActivities: r.activities || null,
      fsisSizeCategory: normalizeSizeCategory(r.size),
      rawJson: null,
    }));

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      // Try one-by-one for conflicts
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
      `Inserting FSIS records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full FSIS fetch pipeline
 */
export async function fetchFsis(runId: string): Promise<FsisFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    const records = await fetchFsisData();

    if (records.length === 0) {
      const durationMs = Date.now() - startTime;
      await db.update(sourceRuns).set({
        status: 'completed',
        completedAt: new Date(),
        totalFetched: 0,
        newRecords: 0,
        errorCount: 1,
        errorLog: JSON.stringify(['No records fetched — place FSIS CSV at downloads/fsis_directory.csv']),
        durationMs,
      }).where(eq(sourceRuns.id, runId));
      return { totalFetched: 0, inserted: 0, errors: ['No data source available'] };
    }

    const { inserted, errors } = await insertFsisRecords(records, runId);

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

    console.log(`[FSIS] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted} inserted from ${records.length} establishments`);
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
