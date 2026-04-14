/**
 * Deduplicate Facilities
 *
 * Uses window functions to identify the best record per group and delete the rest.
 * Groups by epa_registry_id first, then by (name, city, state) for remaining.
 *
 * Run: npx tsx server/scripts/dedup-facilities.ts [--dry-run]
 */

import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Facility Deduplication ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const [before] = await db.execute(sql`SELECT count(*)::int as total FROM facilities`);
  console.log(`Facilities before: ${before.total}`);

  // Phase 1: Identify all duplicate IDs to delete using window functions
  // For each group, keep the row with: highest source_count, then highest confidence, then newest
  console.log('\n[Phase 1] Identifying duplicates by epa_registry_id...');

  const registryDupeCount = await db.execute(sql`
    SELECT count(*)::int as cnt FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY epa_registry_id
        ORDER BY source_count DESC, confidence DESC, created_at DESC
      ) as rn
      FROM facilities
      WHERE epa_registry_id IS NOT NULL
    ) ranked WHERE rn > 1
  `);
  console.log(`  Registry ID dupes to remove: ${registryDupeCount[0].cnt}`);

  console.log('[Phase 2] Identifying duplicates by name+city+state (excluding registry-deduped)...');

  // We'll handle both in a single pass by creating a temp table of survivors
  if (DRY_RUN) {
    const nameDupeCount = await db.execute(sql`
      SELECT count(*)::int as cnt FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY name, coalesce(city,''), coalesce(state,'')
          ORDER BY source_count DESC, confidence DESC, created_at DESC
        ) as rn
        FROM facilities
      ) ranked WHERE rn > 1
    `);
    console.log(`  Name+City+State dupes to remove: ${nameDupeCount[0].cnt}`);
    console.log('\nDRY RUN — no changes made. Remove --dry-run to execute.');
    process.exit(0);
  }

  // ===== EXECUTE DEDUP =====

  // Drop leftover temp table from any previous failed run
  await db.execute(sql`DROP TABLE IF EXISTS dedup_survivors`);

  // Step 1: Create temp table of survivors (best record per name+city+state group)
  // This handles BOTH registry dupes and name dupes since name+city+state is the broader grouping
  console.log('\n[Executing] Creating survivor table...');
  await db.execute(sql`
    CREATE TEMP TABLE dedup_survivors AS
    SELECT DISTINCT ON (name, coalesce(city,''), coalesce(state,''))
      id as survivor_id,
      name,
      coalesce(city,'') as city,
      coalesce(state,'') as state
    FROM facilities
    ORDER BY name, coalesce(city,''), coalesce(state,''),
             source_count DESC, confidence DESC, created_at DESC
  `);

  const [survivorCount] = await db.execute(sql`SELECT count(*)::int as cnt FROM dedup_survivors`);
  console.log(`  Survivors identified: ${survivorCount.cnt}`);

  // Step 2: Find all IDs to delete (not survivors)
  const [dupeCount] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM facilities
    WHERE id NOT IN (SELECT survivor_id FROM dedup_survivors)
  `);
  console.log(`  Duplicates to remove: ${dupeCount.cnt}`);

  if (Number(dupeCount.cnt) === 0) {
    console.log('No duplicates found!');
    await db.execute(sql`DROP TABLE IF EXISTS dedup_survivors`);
    process.exit(0);
  }

  // Step 3: Re-point raw_records from dupes to survivors
  console.log('\n[Step 3] Re-linking raw_records...');
  await db.execute(sql`
    UPDATE raw_records rr SET facility_id = ds.survivor_id
    FROM facilities f
    JOIN dedup_survivors ds ON f.name = ds.name
      AND coalesce(f.city,'') = ds.city
      AND coalesce(f.state,'') = ds.state
    WHERE rr.facility_id = f.id
      AND f.id != ds.survivor_id
  `);
  console.log(`  Raw records relinked`);

  // Step 4: Re-point facility_sources
  console.log('[Step 4] Re-linking facility_sources...');

  // Insert new source links for survivors from dupe records (ignore conflicts)
  await db.execute(sql`
    INSERT INTO facility_sources (facility_id, raw_record_id, source, source_record_id, fields_provided)
    SELECT ds.survivor_id, fs.raw_record_id, fs.source, fs.source_record_id, fs.fields_provided
    FROM facility_sources fs
    JOIN facilities f ON fs.facility_id = f.id
    JOIN dedup_survivors ds ON f.name = ds.name
      AND coalesce(f.city,'') = ds.city
      AND coalesce(f.state,'') = ds.state
    WHERE f.id != ds.survivor_id
    ON CONFLICT (facility_id, raw_record_id) DO NOTHING
  `);

  // Delete all facility_sources pointing to dupes (they've been copied to survivors)
  await db.execute(sql`
    DELETE FROM facility_sources
    WHERE facility_id NOT IN (SELECT survivor_id FROM dedup_survivors)
  `);
  console.log(`  Facility sources relinked`);

  // Step 5: Update match_candidates
  console.log('[Step 5] Updating match_candidates...');
  await db.execute(sql`
    UPDATE match_candidates mc SET facility_id = ds.survivor_id
    FROM facilities f
    JOIN dedup_survivors ds ON f.name = ds.name
      AND coalesce(f.city,'') = ds.city
      AND coalesce(f.state,'') = ds.state
    WHERE mc.facility_id = f.id
      AND f.id != ds.survivor_id
  `);

  // Step 6: Delete duplicate facilities
  console.log('[Step 6] Deleting duplicate facilities...');
  await db.execute(sql`
    DELETE FROM facilities
    WHERE id NOT IN (SELECT survivor_id FROM dedup_survivors)
  `);
  console.log(`  Deleted duplicate facilities`);

  // Step 7: Update survivor source counts from actual facility_sources
  console.log('[Step 7] Recalculating source counts...');
  await db.execute(sql`
    UPDATE facilities SET
      source_count = COALESCE(sub.cnt, 1),
      sources = COALESCE(sub.srcs, sources),
      updated_at = NOW()
    FROM (
      SELECT
        facility_id,
        count(DISTINCT source)::int as cnt,
        json_agg(DISTINCT source)::text as srcs
      FROM facility_sources
      GROUP BY facility_id
    ) sub
    WHERE facilities.id = sub.facility_id
  `);

  // Step 8: Update company facility counts
  console.log('[Step 8] Updating company counts...');
  await db.execute(sql`
    UPDATE companies SET
      facility_count = COALESCE(sub.cnt, 0),
      updated_at = NOW()
    FROM (
      SELECT company_id, count(*)::int as cnt
      FROM facilities
      WHERE company_id IS NOT NULL
      GROUP BY company_id
    ) sub
    WHERE companies.id = sub.company_id
  `);

  // Remove orphan companies
  const orphans = await db.execute(sql`
    DELETE FROM companies
    WHERE id NOT IN (SELECT DISTINCT company_id FROM facilities WHERE company_id IS NOT NULL)
    RETURNING id
  `);

  // Clean up
  await db.execute(sql`DROP TABLE IF EXISTS dedup_survivors`);

  // Final stats
  const [after] = await db.execute(sql`SELECT count(*)::int as total FROM facilities`);
  const [afterCompanies] = await db.execute(sql`SELECT count(*)::int as total FROM companies`);

  console.log(`\n=== Dedup Complete ===`);
  console.log(`  Before: ${before.total} facilities`);
  console.log(`  After:  ${after.total} facilities`);
  console.log(`  Removed: ${Number(before.total) - Number(after.total)} duplicates`);
  console.log(`  Orphan companies removed: ${(orphans as unknown[]).length || 0}`);
  console.log(`  Final companies: ${afterCompanies.total}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Dedup failed:', err);
  process.exit(1);
});
