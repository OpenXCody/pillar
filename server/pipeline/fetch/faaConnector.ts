/**
 * FAA Production Approval Holder (PAH) Connector
 *
 * Imports manufacturers with PC, PMA, and TSOA certifications from the
 * FAA Production Approval Holder directory.
 *
 * Approval Types:
 * - PC  (Production Certificate): OEMs who manufacture complete aircraft, engines, or propellers
 * - PMA (Parts Manufacturer Approval): Manufacturers of replacement/modification parts
 * - TSOA (Technical Standard Order Authorization): Manufacturers of specific articles
 *       (instruments, equipment, components) meeting minimum performance standards
 *
 * Data Source:
 * The FAA DRS (drs.faa.gov) is an Angular SPA without a public REST API.
 * This connector supports:
 * 1. Manual CSV upload placed at downloads/faa_pah.csv
 * 2. Excel file at downloads/faa_pah.xlsx
 * 3. Attempted automated fetch from FAA endpoints (may require session tokens)
 *
 * Expected CSV columns: Holder Name, Address, City, State, Zip, Type, Certificate No, Status
 */

import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { updateProgress } from '../orchestrator.js';

const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

interface FaaPahRecord {
  holderNumber: string;
  holderName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  approvalType: string;  // PC, PMA, TSOA
  certNumber: string;
  status: string;
}

export interface FaaFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

/**
 * Try to load FAA data from local files first, then attempt remote endpoints.
 */
async function fetchFaaPahData(): Promise<FaaPahRecord[]> {
  // Priority 1: Check for locally placed CSV file
  const csvPath = path.join(DOWNLOAD_DIR, 'faa_pah.csv');
  try {
    const csvStat = await stat(csvPath);
    if (csvStat.size > 100) {
      console.log(`[FAA] Found local CSV: ${csvPath} (${(csvStat.size / 1024).toFixed(1)} KB)`);
      updateProgress('fetching', 10, 'Parsing local FAA CSV...');
      return await parseFaaCsv(csvPath);
    }
  } catch { /* file doesn't exist */ }

  // Priority 2: Check for locally placed Excel file
  const xlsxPath = path.join(DOWNLOAD_DIR, 'faa_pah.xlsx');
  try {
    const xlsStat = await stat(xlsxPath);
    if (xlsStat.size > 100) {
      console.log(`[FAA] Found local Excel: ${xlsxPath} (${(xlsStat.size / 1024).toFixed(1)} KB)`);
      updateProgress('fetching', 10, 'Parsing local FAA Excel...');
      return await parseFaaExcel(xlsxPath);
    }
  } catch { /* file doesn't exist */ }

  // Priority 3: Try to fetch from FAA endpoints
  console.log('[FAA] No local file found. Attempting remote fetch...');
  updateProgress('fetching', 5, 'Connecting to FAA DRS...');

  const remoteRecords = await tryRemoteFetch();
  if (remoteRecords.length > 0) return remoteRecords;

  // If no data source works, return empty with instructions
  console.log('[FAA] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[FAA] No automated FAA data source available.');
  console.log('[FAA] To import FAA PAH data manually:');
  console.log('[FAA]   1. Visit https://drs.faa.gov/browse/DRSP0002');
  console.log('[FAA]   2. Export the data to CSV or Excel');
  console.log('[FAA]   3. Place the file at: downloads/faa_pah.csv');
  console.log('[FAA]   4. Re-run this sync');
  console.log('[FAA] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return [];
}

/**
 * Parse a local CSV file with FAA PAH data
 */
async function parseFaaCsv(csvPath: string): Promise<FaaPahRecord[]> {
  const records: FaaPahRecord[] = [];

  return new Promise((resolve, reject) => {
    const stream = createReadStream(csvPath, { encoding: 'utf-8' });
    Papa.parse<Record<string, string>>(stream, {
      header: true,
      skipEmptyLines: true,
      step: (row) => {
        const record = parseRow(row.data);
        if (record) records.push(record);
      },
      complete: () => {
        console.log(`[FAA] Parsed ${records.length} records from CSV`);
        resolve(records);
      },
      error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
    });
  });
}

/**
 * Parse a local Excel file with FAA PAH data
 */
async function parseFaaExcel(xlsxPath: string): Promise<FaaPahRecord[]> {
  const { readFileSync } = await import('fs');
  const XLSX = await import('xlsx');
  const buffer = readFileSync(xlsxPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const records: FaaPahRecord[] = [];
  for (const row of rows) {
    const record = parseRow(row);
    if (record) records.push(record);
  }
  console.log(`[FAA] Parsed ${records.length} records from Excel`);
  return records;
}

/**
 * Try fetching from remote FAA endpoints (best-effort)
 */
async function tryRemoteFetch(): Promise<FaaPahRecord[]> {
  const endpoints = [
    'https://drs.faa.gov/browse/excelExport/DRSP0002ExcelExportList',
    'https://drs.faa.gov/browse/csvExport/DRSP0002CsvExportList',
  ];

  for (const url of endpoints) {
    try {
      console.log(`[FAA] Trying: ${url}`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Pillar-Data-Pipeline/1.0' },
        redirect: 'follow',
      });

      if (!res.ok) {
        console.log(`[FAA] ${res.status} from ${url}`);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';

      // Check if we got actual data (not the Angular SPA HTML)
      if (contentType.includes('html')) {
        const text = await res.text();
        if (text.includes('<app-root>') || text.includes('<!doctype html>')) {
          console.log('[FAA] Got Angular SPA HTML instead of data, skipping');
          continue;
        }
      }

      if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('octet-stream')) {
        const XLSX = await import('xlsx');
        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        const records: FaaPahRecord[] = [];
        for (const row of rows) {
          const record = parseRow(row);
          if (record) records.push(record);
        }
        if (records.length > 0) {
          console.log(`[FAA] Fetched ${records.length} records from ${url}`);
          return records;
        }
      }

      if (contentType.includes('csv') || contentType.includes('text/plain')) {
        const text = await res.text();
        const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
        const records: FaaPahRecord[] = [];
        for (const row of parsed.data) {
          const record = parseRow(row);
          if (record) records.push(record);
        }
        if (records.length > 0) {
          console.log(`[FAA] Fetched ${records.length} records from ${url}`);
          return records;
        }
      }
    } catch (err) {
      console.log(`[FAA] Error from ${url}:`, String(err).slice(0, 100));
    }
  }

  return [];
}

/**
 * Parse a row (from CSV or Excel) into a FaaPahRecord.
 * Handles various column naming conventions from FAA exports.
 */
function parseRow(row: Record<string, string>): FaaPahRecord | null {
  // Try various column name formats
  const name =
    row['Holder Name'] || row['HOLDER_NAME'] || row['Name'] ||
    row['PAH Name'] || row['holder_name'] || row['name'] || '';
  if (!name.trim()) return null;

  // Determine approval type
  let approvalType =
    row['Approval Type'] || row['TYPE'] || row['Type'] ||
    row['approval_type'] || row['Approval'] || '';

  if (!approvalType) {
    const cert = row['Certificate No'] || row['CERT_NO'] || row['PAH No'] || row['cert_number'] || '';
    if (cert.startsWith('PC')) approvalType = 'PC';
    else if (cert.startsWith('PMA')) approvalType = 'PMA';
    else if (cert.startsWith('TSO')) approvalType = 'TSOA';
  }

  return {
    holderNumber: (row['PAH No'] || row['Holder No'] || row['HOLDER_NO'] || row['holder_number'] || '').trim(),
    holderName: name.trim(),
    address: (row['Address'] || row['ADDRESS'] || row['Street'] || row['address'] || '').trim(),
    city: (row['City'] || row['CITY'] || row['city'] || '').trim(),
    state: (row['State'] || row['STATE'] || row['state'] || '').trim(),
    zip: (row['Zip'] || row['ZIP'] || row['Zip Code'] || row['zip'] || row['postal_code'] || '').trim(),
    country: (row['Country'] || row['COUNTRY'] || row['country'] || 'US').trim(),
    approvalType: approvalType.trim().toUpperCase(),
    certNumber: (row['Certificate No'] || row['CERT_NO'] || row['PAH No'] || row['cert_number'] || '').trim(),
    status: (row['Status'] || row['STATUS'] || row['status'] || 'Active').trim(),
  };
}

/**
 * Map FAA approval type to NAICS code
 */
function faaApprovalToNaics(approvalType: string): string {
  const type = approvalType.toUpperCase();
  if (type.includes('PC')) return '336411';   // Aircraft Manufacturing (OEM)
  if (type.includes('PMA')) return '336413';  // Other Aircraft Parts
  if (type.includes('TSOA') || type.includes('TSO')) return '336413';
  return '336411';
}

/**
 * Insert FAA records into raw_records
 */
async function insertFaaRecords(records: FaaPahRecord[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  // Filter to US-based and active holders only
  const usRecords = records.filter(r => {
    const country = (r.country || '').toUpperCase();
    const isUS = !country || country === 'US' || country === 'USA' || country === 'UNITED STATES' || r.state.length === 2;
    const isActive = r.status !== 'Revoked' && r.status !== 'Surrendered';
    return isUS && isActive;
  });

  // Deduplicate by cert number + approval type
  const seen = new Map<string, FaaPahRecord>();
  for (const r of usRecords) {
    const key = r.certNumber || `${r.holderName}_${r.approvalType}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  const unique = Array.from(seen.values());
  console.log(`[FAA] ${records.length} total → ${usRecords.length} active US → ${unique.length} unique`);

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE).map(r => ({
      source: 'faa' as const,
      sourceRunId: runId,
      sourceRecordId: r.certNumber || r.holderNumber || `faa_${r.holderName}_${r.approvalType}`,
      rawName: r.holderName || null,
      rawAddress: r.address || null,
      rawCity: r.city || null,
      rawState: r.state || null,
      rawZip: r.zip || null,
      rawNaicsCode: faaApprovalToNaics(r.approvalType),
      rawNaicsDescription: 'Aerospace Product and Parts Manufacturing',
      faaApprovalType: r.approvalType || null,
      faaCertNumber: r.certNumber || null,
      faaHolderNumber: r.holderNumber || null,
      rawJson: null,
    }));

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      errors.push(`Batch insert at offset ${i}: ${err}`);
    }

    updateProgress('fetching', 40 + Math.round((i / unique.length) * 30),
      `Inserting FAA records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full FAA fetch pipeline
 */
export async function fetchFaa(runId: string): Promise<FaaFetchResult> {
  const startTime = Date.now();

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    const records = await fetchFaaPahData();

    if (records.length === 0) {
      const durationMs = Date.now() - startTime;
      await db.update(sourceRuns).set({
        status: 'completed',
        completedAt: new Date(),
        totalFetched: 0,
        newRecords: 0,
        errorCount: 1,
        errorLog: JSON.stringify(['No records fetched — place FAA CSV at downloads/faa_pah.csv and re-sync']),
        durationMs,
      }).where(eq(sourceRuns.id, runId));
      return { totalFetched: 0, inserted: 0, errors: ['No data source available'] };
    }

    const { inserted, errors } = await insertFaaRecords(records, runId);

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

    console.log(`[FAA] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted} inserted`);
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
