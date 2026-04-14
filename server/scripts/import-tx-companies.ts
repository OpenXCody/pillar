/**
 * Import TX Manufacturing Companies into Pillar's companies table.
 *
 * 12,817 Texas manufacturing companies with enriched data:
 * - Company name, industry, description
 * - HQ location + coordinates
 * - Domain, LinkedIn, founding year, employee estimate
 * - Primary NAICS code
 */
import 'dotenv/config';
import { createReadStream } from 'fs';
import Papa from 'papaparse';
import { db } from '../db/index.js';
import { companies } from '../db/schema.js';
import { normalizeCompanyName } from '@shared/companyNormalization.js';
import { sql } from 'drizzle-orm';

const CSV_PATH = '/Users/cody/Downloads/TX_Manufacturing_Companies.csv';

interface TxCompanyRow {
  company_name: string;
  industry: string;
  description: string;
  hq_locality: string;
  latitude: string;
  longitude: string;
  domain: string;
  linkedin_url: string;
  year_founded: string;
  size_range: string;
  employee_estimate: string;
  tx_factory_count: string;
  tx_cities: string;
  primary_naics: string;
}

async function main() {
  console.log('Importing TX Manufacturing Companies...');

  const rows: TxCompanyRow[] = await new Promise((resolve, reject) => {
    Papa.parse(createReadStream(CSV_PATH), {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as TxCompanyRow[]),
      error: reject,
    });
  });

  console.log(`Parsed ${rows.length} companies from CSV`);

  // Deduplicate by normalized name
  const seen = new Map<string, TxCompanyRow>();
  let skippedDupes = 0;

  for (const row of rows) {
    if (!row.company_name?.trim()) continue;
    const normalized = normalizeCompanyName(row.company_name.trim());
    if (!seen.has(normalized)) {
      seen.set(normalized, row);
    } else {
      skippedDupes++;
    }
  }

  console.log(`Unique companies: ${seen.size} (${skippedDupes} duplicates)`);

  // Get existing company names to avoid conflicts
  const existing = await db.select({ name: companies.name }).from(companies);
  const existingNames = new Set(existing.map(c => c.name));
  console.log(`Existing companies in DB: ${existingNames.size}`);

  // Build insert batch
  const toInsert: (typeof companies.$inferInsert)[] = [];

  for (const [name, row] of seen) {
    if (existingNames.has(name)) continue;

    toInsert.push({
      name,
      sector: row.industry || null,
      naicsCodes: row.primary_naics ? JSON.stringify([row.primary_naics]) : null,
      facilityCount: parseInt(row.tx_factory_count) || 0,
    });
  }

  console.log(`New companies to insert: ${toInsert.length}`);

  // Batch insert
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await db.insert(companies).values(batch).onConflictDoNothing();
    inserted += batch.length;
    if (inserted % 2000 === 0 || inserted === toInsert.length) {
      console.log(`  Inserted ${inserted}/${toInsert.length}`);
    }
  }

  console.log(`\nDone! Inserted ${toInsert.length} TX companies.`);

  const total = await db.select({ count: sql<number>`count(*)` }).from(companies);
  console.log(`Total companies in DB: ${total[0].count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
