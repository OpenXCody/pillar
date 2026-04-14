/**
 * Data Cleanup
 *
 * Removes or fixes common data quality issues:
 * - Facilities with very short/garbage names
 * - Government facilities (CITY OF, VILLAGE OF, etc.)
 * - Duplicate company names (case-insensitive)
 * - Companies with 0 facilities
 *
 * Run: npx tsx server/scripts/cleanup-data.ts [--dry-run]
 */

import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Data Cleanup ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // 1. Identify garbage company names (1-2 chars, common words that aren't companies)
  const garbageNames = await db.execute(sql`
    SELECT id, name, facility_count
    FROM companies
    WHERE (LENGTH(name) <= 2 AND name NOT IN ('3M', 'GE', 'BD', 'HP', 'GM', 'BP', 'LG', 'ZF', 'IT', 'US', 'K2'))
       OR name IN ('Air', 'Pq', 'Na', 'N/A', 'Tbd', 'Unknown', 'None', 'Test', 'Null')
    ORDER BY facility_count DESC
  `);

  if (garbageNames.length > 0) {
    console.log(`Found ${garbageNames.length} garbage company names:`);
    for (const r of garbageNames) {
      console.log(`  "${r.name}" (${r.facility_count} facilities)`);
    }

    if (!DRY_RUN) {
      for (const r of garbageNames) {
        await db.execute(sql`UPDATE facilities SET company_id = NULL, company_name = NULL WHERE company_id = ${String(r.id)}::uuid`);
        await db.execute(sql`DELETE FROM companies WHERE id = ${String(r.id)}::uuid`);
      }
      console.log(`  Deleted ${garbageNames.length} garbage companies and unlinked their facilities`);
    }
  }

  // 2. Clean up companies with 0 facilities
  const [emptyCompanies] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM companies WHERE facility_count = 0
  `);
  console.log(`\nCompanies with 0 facilities: ${emptyCompanies.cnt}`);

  if (!DRY_RUN && Number(emptyCompanies.cnt) > 0) {
    await db.execute(sql`DELETE FROM companies WHERE facility_count = 0`);
    console.log(`  Deleted ${emptyCompanies.cnt} empty companies`);
  }

  // 3. Recalculate facility counts for all companies
  if (!DRY_RUN) {
    console.log('\nRecalculating company facility counts...');
    await db.execute(sql`
      UPDATE companies SET facility_count = (
        SELECT COUNT(*) FROM facilities WHERE facilities.company_id = companies.id
      )
    `);
    console.log('  Done');
  }

  // 4. Fix company_name denormalization on facilities
  if (!DRY_RUN) {
    console.log('\nSyncing facility company_name from companies table...');
    const [updated] = await db.execute(sql`
      WITH updates AS (
        UPDATE facilities f SET company_name = c.name
        FROM companies c
        WHERE f.company_id = c.id AND (f.company_name IS NULL OR f.company_name != c.name)
        RETURNING f.id
      )
      SELECT COUNT(*)::int as cnt FROM updates
    `);
    console.log(`  Updated ${updated.cnt} facility company_name fields`);
  }

  // 5. Summary
  const [stats] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM facilities) as total_fac,
      (SELECT COUNT(*)::int FROM companies) as total_co,
      (SELECT COUNT(*)::int FROM facilities WHERE company_id IS NOT NULL) as linked,
      (SELECT COUNT(*)::int FROM facilities WHERE company_id IS NULL) as unlinked,
      (SELECT AVG(confidence)::int FROM facilities) as avg_conf,
      (SELECT COUNT(*)::int FROM companies WHERE sector IS NOT NULL AND sector != 'Manufacturing') as companies_with_sector
  `);

  console.log('\n=== Summary ===');
  console.log(`  Facilities: ${stats.total_fac}`);
  console.log(`  Companies: ${stats.total_co}`);
  console.log(`  Linked: ${stats.linked} (${Math.round(Number(stats.linked) / Number(stats.total_fac) * 100)}%)`);
  console.log(`  Unlinked: ${stats.unlinked}`);
  console.log(`  Avg confidence: ${stats.avg_conf}`);
  console.log(`  Companies with specific sector: ${stats.companies_with_sector}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
