import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const totalRaw = await sql`SELECT count(*) FROM raw_records`;
  const unmatched = await sql`SELECT count(*) FROM raw_records WHERE matched_at IS NULL`;
  const golden = await sql`SELECT count(*) FROM facilities`;
  const matches = await sql`SELECT count(*) FROM match_candidates`;
  const companies = await sql`SELECT count(*) FROM companies`;

  const sourceBreakdown = await sql`SELECT source, count(*) FROM raw_records GROUP BY source ORDER BY count DESC`;
  const unmatchedBySource = await sql`SELECT source, count(*) FROM raw_records WHERE matched_at IS NULL GROUP BY source ORDER BY count DESC`;

  console.log('=== Database Counts ===');
  console.log('Total raw records:', totalRaw[0].count);
  console.log('Unmatched raw records:', unmatched[0].count);
  console.log('Golden records (facilities):', golden[0].count);
  console.log('Match candidates:', matches[0].count);
  console.log('Companies:', companies[0].count);
  console.log('\n--- Raw Records by Source ---');
  for (const row of sourceBreakdown) {
    console.log(`  ${row.source}: ${row.count}`);
  }
  console.log('\n--- Unmatched by Source ---');
  for (const row of unmatchedBySource) {
    console.log(`  ${row.source}: ${row.count}`);
  }

  await sql.end();
}

main().catch(console.error);
