/**
 * Import TX Manufacturing Factories as raw_records.
 *
 * 14,034 Texas factories with EPA registry IDs, coordinates, NAICS/SIC codes.
 * These records will match existing ECHO/TRI data via EPA Registry ID during
 * the matching pipeline, enriching golden records with additional fields.
 *
 * Source: 'manual' (curated TX dataset)
 */
import 'dotenv/config';
import { createReadStream } from 'fs';
import Papa from 'papaparse';
import { db } from '../db/index.js';
import { rawRecords, sourceRuns } from '../db/schema.js';
import { sql } from 'drizzle-orm';

const CSV_PATH = '/Users/cody/Downloads/TX_Manufacturing_Factories.csv';

interface TxFactoryRow {
  epa_registry_id: string;
  factory_name: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  latitude: string;
  longitude: string;
  industry_tag: string;
  specialization: string;
  naics_code: string;
  naics_description: string;
  all_naics_codes: string;
  sic_code: string;
  sic_description: string;
  epa_url: string;
  company_domain: string;
  company_employees: string;
  company_linkedin: string;
  company_industry_linkedin: string;
  company_hq: string;
  company_founded: string;
  company_size_range: string;
  match_confidence: string;
}

async function main() {
  console.log('Importing TX Manufacturing Factories...');

  // Create source run
  const [run] = await db.insert(sourceRuns).values({
    source: 'manual',
    status: 'fetching',
  }).returning();

  const rows: TxFactoryRow[] = await new Promise((resolve, reject) => {
    Papa.parse(createReadStream(CSV_PATH), {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as TxFactoryRow[]),
      error: reject,
    });
  });

  console.log(`Parsed ${rows.length} factories from CSV`);

  // Check for existing TX manual records with same EPA registry IDs
  const existingIds = await db.select({ registryId: rawRecords.registryId })
    .from(rawRecords)
    .where(sql`${rawRecords.source} = 'manual' AND ${rawRecords.rawState} = 'TX' AND ${rawRecords.registryId} IS NOT NULL`);
  const existingRegistryIds = new Set(existingIds.map(r => r.registryId));
  console.log(`Existing TX manual records with registry IDs: ${existingRegistryIds.size}`);

  // Build insert batch
  const toInsert: (typeof rawRecords.$inferInsert)[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row.factory_name?.trim()) continue;

    // Skip if we already have this registry ID from manual source
    if (row.epa_registry_id && existingRegistryIds.has(row.epa_registry_id)) {
      skipped++;
      continue;
    }

    toInsert.push({
      source: 'manual',
      sourceRunId: run.id,
      sourceRecordId: row.epa_registry_id || null,
      rawName: row.factory_name.trim(),
      rawAddress: row.address?.trim() || null,
      rawCity: row.city?.trim() || null,
      rawState: row.state?.trim() || 'TX',
      rawZip: row.zip?.trim() || null,
      rawCounty: row.county?.trim() || null,
      rawLatitude: row.latitude || null,
      rawLongitude: row.longitude || null,
      rawNaicsCode: row.naics_code || null,
      rawSicCode: row.sic_code || null,
      registryId: row.epa_registry_id || null,
      rawJson: null, // Don't store raw JSON to save space
      fetchedAt: new Date(),
    });
  }

  console.log(`Records to insert: ${toInsert.length} (${skipped} skipped as duplicates)`);

  // Batch insert
  const BATCH = 1000;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await db.insert(rawRecords).values(batch);
    inserted += batch.length;
    if (inserted % 5000 === 0 || inserted === toInsert.length) {
      console.log(`  Inserted ${inserted}/${toInsert.length}`);
    }
  }

  // Update source run
  await db.update(sourceRuns).set({
    status: 'completed',
    totalFetched: rows.length,
    newRecords: toInsert.length,
    completedAt: new Date(),
  }).where(sql`${sourceRuns.id} = ${run.id}`);

  console.log(`\nDone! Inserted ${toInsert.length} TX factories as raw_records.`);

  const total = await db.select({ count: sql<number>`count(*)` }).from(rawRecords);
  console.log(`Total raw_records in DB: ${total[0].count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
