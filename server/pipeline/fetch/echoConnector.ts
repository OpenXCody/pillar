/**
 * EPA ECHO Connector
 *
 * Downloads the ECHO Exporter bulk CSV from EPA, filters to manufacturing
 * facilities (NAICS 31-33), and inserts raw records.
 *
 * Source: https://echo.epa.gov/tools/data-downloads
 * Bulk ZIP: https://echo.epa.gov/files/echodownloads/fac_csv.zip
 * Contains ECHO_EXPORTER.csv with 130+ columns per facility.
 *
 * No API key required. Updated weekly.
 */

import { createWriteStream, createReadStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import path from 'path';
import Papa from 'papaparse';
import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { isManufacturingNaics } from '@shared/naics.js';

const ECHO_DOWNLOAD_URL = 'https://echo.epa.gov/files/echodownloads/echo_exporter.zip';
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

// Key ECHO CSV columns we extract
interface EchoRow {
  REGISTRY_ID: string;
  FAC_NAME: string;
  FAC_STREET: string;
  FAC_CITY: string;
  FAC_STATE: string;
  FAC_ZIP: string;
  FAC_COUNTY: string;
  FAC_LAT: string;
  FAC_LONG: string;
  FAC_NAICS_CODES: string;
  FAC_SIC_CODES: string;
  FAC_DERIVED_CD113: string;
  FAC_ACTIVE_FLAG: string;
  [key: string]: string;
}

export interface EchoFetchResult {
  totalParsed: number;
  manufacturingCount: number;
  inserted: number;
  errors: string[];
}

/**
 * Download the ECHO bulk ZIP file
 */
async function downloadEchoZip(): Promise<string> {
  await mkdir(DOWNLOAD_DIR, { recursive: true });
  const zipPath = path.join(DOWNLOAD_DIR, 'fac_csv.zip');

  // Skip download if ZIP exists and is less than 24 hours old
  try {
    const existing = await stat(zipPath);
    const ageHours = (Date.now() - existing.mtimeMs) / (1000 * 60 * 60);
    if (existing.size > 100_000_000 && ageHours < 24) {
      console.log(`[ECHO] Using cached ZIP (${(existing.size / 1024 / 1024).toFixed(1)} MB, ${ageHours.toFixed(1)}h old)`);
      return zipPath;
    }
  } catch { /* file doesn't exist, download it */ }

  console.log(`[ECHO] Downloading bulk CSV from EPA...`);
  const res = await fetch(ECHO_DOWNLOAD_URL);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ECHO data: ${res.status} ${res.statusText}`);
  }

  const fileStream = createWriteStream(zipPath);
  // @ts-expect-error Node ReadableStream compatibility
  await pipeline(res.body, fileStream);

  const stats = await stat(zipPath);
  console.log(`[ECHO] Downloaded ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  return zipPath;
}

/**
 * Extract CSV from ZIP using system unzip (more reliable for large files)
 */
async function extractCsv(zipPath: string): Promise<string> {
  const { execSync } = await import('child_process');
  const csvDir = path.join(DOWNLOAD_DIR, 'echo_extracted');
  await mkdir(csvDir, { recursive: true });

  console.log(`[ECHO] Extracting CSV...`);
  execSync(`unzip -o "${zipPath}" -d "${csvDir}"`, { stdio: 'pipe' });

  // Find the main CSV file (usually ECHO_EXPORTER.csv or similar)
  const { readdirSync } = await import('fs');
  const files = readdirSync(csvDir).filter(f => f.endsWith('.csv'));
  if (files.length === 0) throw new Error('No CSV file found in ECHO ZIP');

  const csvPath = path.join(csvDir, files[0]);
  const stats = await stat(csvPath);
  console.log(`[ECHO] Extracted ${files[0]} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  return csvPath;
}

/**
 * Extract the first NAICS code from the ECHO FAC_NAICS_CODES field.
 * This field can contain multiple codes separated by spaces or commas.
 */
function extractPrimaryNaics(naicsCodes: string | undefined): string | null {
  if (!naicsCodes) return null;
  const codes = naicsCodes.split(/[\s,]+/).filter(c => c.length >= 2);
  return codes[0] || null;
}

/**
 * Check if any NAICS code in the field is manufacturing (31-33)
 */
function hasManufacturingNaics(naicsCodes: string | undefined): boolean {
  if (!naicsCodes) return false;
  const codes = naicsCodes.split(/[\s,]+/).filter(c => c.length >= 2);
  return codes.some(code => isManufacturingNaics(code));
}

/**
 * Parse the CSV and insert manufacturing facilities into raw_records
 */
async function parseAndInsert(csvPath: string, runId: string): Promise<EchoFetchResult> {
  const result: EchoFetchResult = { totalParsed: 0, manufacturingCount: 0, inserted: 0, errors: [] };

  return new Promise((resolve, reject) => {
    const batch: (typeof rawRecords.$inferInsert)[] = [];
    const BATCH_SIZE = 500;

    const fileStream = createReadStream(csvPath, { encoding: 'utf-8' });

    Papa.parse<EchoRow>(fileStream, {
      header: true,
      skipEmptyLines: true,
      step: async (row) => {
        result.totalParsed++;
        const data = row.data;

        // Filter: only manufacturing NAICS
        if (!hasManufacturingNaics(data.FAC_NAICS_CODES)) return;

        result.manufacturingCount++;

        const primaryNaics = extractPrimaryNaics(data.FAC_NAICS_CODES);

        batch.push({
          source: 'epa_echo',
          sourceRunId: runId,
          sourceRecordId: data.REGISTRY_ID || null,
          rawName: data.FAC_NAME || null,
          rawAddress: data.FAC_STREET || null,
          rawCity: data.FAC_CITY || null,
          rawState: data.FAC_STATE || null,
          rawZip: data.FAC_ZIP || null,
          rawCounty: data.FAC_COUNTY || null,
          rawLatitude: data.FAC_LAT || null,
          rawLongitude: data.FAC_LONG || null,
          rawNaicsCode: primaryNaics,
          rawNaicsDescription: null,
          rawSicCode: data.FAC_SIC_CODES?.split(/[\s,]+/)[0] || null,
          registryId: data.REGISTRY_ID || null,
          programIds: null,
          rawJson: null, // Skip raw JSON storage to save DB space
        });

        if (batch.length >= BATCH_SIZE) {
          const toInsert = [...batch];
          batch.length = 0;
          try {
            await db.insert(rawRecords).values(toInsert);
            result.inserted += toInsert.length;
          } catch (err) {
            result.errors.push(`Batch insert error at row ${result.totalParsed}: ${err}`);
          }
        }

        // Log progress periodically
        if (result.totalParsed % 100000 === 0) {
          console.log(`[ECHO] Parsed ${result.totalParsed.toLocaleString()} rows, ${result.manufacturingCount.toLocaleString()} manufacturing`);
        }
      },
      complete: async () => {
        // Insert remaining batch
        if (batch.length > 0) {
          try {
            await db.insert(rawRecords).values(batch);
            result.inserted += batch.length;
          } catch (err) {
            result.errors.push(`Final batch insert error: ${err}`);
          }
        }
        console.log(`[ECHO] Complete: ${result.totalParsed.toLocaleString()} total, ${result.manufacturingCount.toLocaleString()} manufacturing, ${result.inserted.toLocaleString()} inserted`);
        resolve(result);
      },
      error: (err) => {
        reject(new Error(`CSV parse error: ${err.message}`));
      },
    });
  });
}

/**
 * Full ECHO fetch pipeline: download -> extract -> parse -> insert
 */
export async function fetchEcho(runId: string): Promise<EchoFetchResult> {
  const startTime = Date.now();

  try {
    // Update run status
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    // Download and extract
    const zipPath = await downloadEchoZip();
    const csvPath = await extractCsv(zipPath);

    // Parse and insert
    const result = await parseAndInsert(csvPath, runId);

    // Update run record
    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'completed',
      completedAt: new Date(),
      totalFetched: result.manufacturingCount,
      newRecords: result.inserted,
      errorCount: result.errors.length,
      errorLog: result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 100)) : null,
      durationMs,
    }).where(eq(sourceRuns.id, runId));

    // Cleanup downloaded files
    try {
      await unlink(zipPath);
    } catch { /* ignore cleanup errors */ }

    console.log(`[ECHO] Fetch complete in ${(durationMs / 1000).toFixed(1)}s`);
    return result;
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
