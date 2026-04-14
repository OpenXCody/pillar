/**
 * Import Company Seed Data into Pillar.
 *
 * Loads curated facility data (Boeing, Caterpillar, Ford, Lockheed Martin,
 * Northrop Grumman, Raytheon, SpaceX, Textron) as a "manual" source.
 * Creates raw_records + immediately creates golden records and companies
 * since this is curated, high-confidence data.
 */

import 'dotenv/config';
import { createReadStream } from 'fs';
import Papa from 'papaparse';
import { db } from '../db/index.js';
import { rawRecords, facilities, companies, facilitySources, sourceRuns } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { normalizeCompanyName } from '@shared/companyNormalization.js';

const CSV_PATH = '/Users/cody/Downloads/All Company Names - Seed Data-2.csv';

interface SeedRow {
  Company: string;
  Description: string;
  LAT: string;
  LONG: string;
  Address: string;
  City: string;
  State: string;
  Country: string;
}

async function importSeedData() {
  console.log('Importing Company Seed Data...');

  // Create a source run
  const [run] = await db.insert(sourceRuns).values({
    source: 'manual',
    status: 'fetching',
  }).returning();

  const rows: SeedRow[] = await new Promise((resolve, reject) => {
    const results: SeedRow[] = [];
    const stream = createReadStream(CSV_PATH, { encoding: 'utf-8' });
    Papa.parse<SeedRow>(stream, {
      header: true,
      skipEmptyLines: true,
      step: (row) => results.push(row.data),
      complete: () => resolve(results),
      error: (err) => reject(err),
    });
  });

  console.log(`  Parsed ${rows.length} rows`);

  // Filter to US only and skip header-like rows
  const validRows = rows.filter(r =>
    r.Company && r.Company !== 'Company' && r.Description
  );
  console.log(`  ${validRows.length} valid rows`);

  // Step 1: Insert raw records in batches
  const BATCH_SIZE = 200;
  let rawInserted = 0;

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE).map(row => ({
      source: 'manual' as const,
      sourceRunId: run.id,
      sourceRecordId: `seed_${row.Company}_${row.Description}`.substring(0, 200),
      rawName: row.Description || null,
      rawAddress: row.Address || null,
      rawCity: row.City || null,
      rawState: normalizeState(row.State) || null,
      rawZip: null as string | null,
      rawLatitude: row.LAT || null,
      rawLongitude: row.LONG || null,
      rawNaicsCode: null as string | null,
      triParentCompanyName: row.Company || null, // Use this field for the known parent company
      rawJson: JSON.stringify(row),
    }));

    await db.insert(rawRecords).values(batch);
    rawInserted += batch.length;
  }
  console.log(`  Inserted ${rawInserted} raw records`);

  // Step 2: Create/find companies
  const companyNames = [...new Set(validRows.map(r => r.Company))];
  const companyMap = new Map<string, string>(); // name -> id

  for (const name of companyNames) {
    const normalized = normalizeCompanyName(name);
    const existing = await db.select().from(companies).where(eq(companies.name, normalized)).limit(1);

    if (existing.length > 0) {
      companyMap.set(name, existing[0].id);
    } else {
      const [created] = await db.insert(companies).values({
        name: normalized,
        nameVariants: JSON.stringify([name]),
        sector: 'Manufacturing',
      }).returning();
      companyMap.set(name, created.id);
      console.log(`  Created company: ${normalized}`);
    }
  }

  // Step 3: Create golden records (facilities)
  let facilitiesCreated = 0;
  const allRawRecords = await db.select().from(rawRecords)
    .where(eq(rawRecords.sourceRunId, run.id));

  for (const raw of allRawRecords) {
    const row = validRows.find(r =>
      `seed_${r.Company}_${r.Description}`.substring(0, 200) === raw.sourceRecordId
    );
    if (!row) continue;

    const companyId = companyMap.get(row.Company) || null;
    const companyName = row.Company ? normalizeCompanyName(row.Company) : null;
    const state = normalizeState(row.State);

    // Calculate confidence: higher if we have coordinates
    const hasCoords = raw.rawLatitude && raw.rawLongitude;
    const confidence = hasCoords ? 85 : 60;

    const [facility] = await db.insert(facilities).values({
      name: raw.rawName || row.Description,
      companyId,
      companyName,
      address: raw.rawAddress,
      city: raw.rawCity,
      state,
      latitude: raw.rawLatitude,
      longitude: raw.rawLongitude,
      sourceCount: 1,
      sources: JSON.stringify(['manual']),
      confidence,
    }).returning();

    // Link raw record to facility
    await db.update(rawRecords)
      .set({ facilityId: facility.id })
      .where(eq(rawRecords.id, raw.id));

    // Create source attribution
    await db.insert(facilitySources).values({
      facilityId: facility.id,
      rawRecordId: raw.id,
      source: 'manual',
      sourceRecordId: raw.sourceRecordId,
      fieldsProvided: JSON.stringify(['name', 'address', 'city', 'state', 'latitude', 'longitude', 'companyName']),
    });

    facilitiesCreated++;

    if (facilitiesCreated % 500 === 0) {
      console.log(`  Created ${facilitiesCreated} facilities...`);
    }
  }

  // Update company facility counts
  for (const [name, companyId] of companyMap) {
    const count = validRows.filter(r => r.Company === name).length;
    await db.update(companies)
      .set({ facilityCount: count })
      .where(eq(companies.id, companyId));
  }

  // Complete the run
  await db.update(sourceRuns).set({
    status: 'completed',
    completedAt: new Date(),
    totalFetched: validRows.length,
    newRecords: rawInserted,
    goldenRecordsCreated: facilitiesCreated,
    durationMs: 0,
  }).where(eq(sourceRuns.id, run.id));

  console.log(`\nDone!`);
  console.log(`  Companies: ${companyMap.size}`);
  console.log(`  Raw records: ${rawInserted}`);
  console.log(`  Golden records: ${facilitiesCreated}`);

  process.exit(0);
}

function normalizeState(state: string | undefined): string | null {
  if (!state) return null;
  const cleaned = state.trim().toUpperCase();

  // Common full state names to abbreviations
  const stateMap: Record<string, string> = {
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
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC',
    'PUERTO RICO': 'PR', 'GUAM': 'GU', 'VIRGIN ISLANDS': 'VI',
  };

  if (stateMap[cleaned]) return stateMap[cleaned];
  if (cleaned.length === 2) return cleaned;
  return null;
}

importSeedData().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
