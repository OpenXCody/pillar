/**
 * Reset merge state safely (no CASCADE wipe).
 * Clears golden records while preserving raw_records and match_candidates.
 */
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  console.log('Resetting merge state (safe)...');

  // 1. Clear facility_id from raw_records FIRST (removes FK references)
  await sql`UPDATE raw_records SET facility_id = NULL WHERE facility_id IS NOT NULL`;
  console.log('  Cleared facility_id from raw_records');

  // 2. Delete facility_sources (references facilities)
  await sql`DELETE FROM facility_sources`;
  console.log('  Deleted all facility_sources');

  // 3. Delete facilities (now safe — no FK references remain)
  await sql`DELETE FROM facilities`;
  console.log('  Deleted all facilities');

  // 4. Reset company facility counts
  await sql`UPDATE companies SET facility_count = 0`;
  console.log('  Reset company facility counts');

  // 5. VACUUM to reclaim space
  await sql.unsafe('VACUUM facility_sources, facilities');
  console.log('  Vacuumed');

  const size = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`\nDone. DB size: ${size[0].size}`);

  await sql.end();
}

main().catch(console.error);
