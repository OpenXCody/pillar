/**
 * Remove duplicate raw_records (keep one per source_record_id per source).
 */
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const before = await sql`SELECT count(*) FROM raw_records`;
  console.log(`Records before: ${before[0].count}`);

  // Find and delete duplicates (keep the one with the smallest id)
  const result = await sql`
    DELETE FROM raw_records
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY source, source_record_id
          ORDER BY id
        ) as rn
        FROM raw_records
        WHERE source_record_id IS NOT NULL
      ) sub
      WHERE rn > 1
    )
  `;

  const after = await sql`SELECT count(*) FROM raw_records`;
  console.log(`Records after: ${after[0].count}`);
  console.log(`Removed: ${Number(before[0].count) - Number(after[0].count)} duplicates`);

  // VACUUM to reclaim space
  await sql.unsafe('VACUUM raw_records');
  console.log('Vacuumed');

  await sql.end();
}

main().catch(console.error);
