import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  // Total DB size
  const dbSize = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log('Database size:', dbSize[0].size);

  // Table sizes
  const tables = await sql`
    SELECT
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_size_pretty(pg_relation_size(relid)) as data_size,
      pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
  `;

  console.log('\nTable sizes:');
  for (const t of tables) {
    console.log(`  ${t.table_name}: ${t.total_size} (data: ${t.data_size}, indexes: ${t.index_size}) - ${t.row_count} rows`);
  }

  // Check rawJson column size
  const jsonSize = await sql`
    SELECT
      pg_size_pretty(sum(pg_column_size(raw_json))) as json_size,
      count(*) as count
    FROM raw_records
    WHERE raw_json IS NOT NULL
  `;
  console.log('\nraw_json column total:', jsonSize[0].json_size, `(${jsonSize[0].count} rows)`);

  // Check by source
  const bySource = await sql`
    SELECT
      source,
      count(*) as count,
      pg_size_pretty(sum(pg_column_size(raw_json))) as json_size
    FROM raw_records
    GROUP BY source
    ORDER BY sum(pg_column_size(raw_json)) DESC NULLS LAST
  `;
  console.log('\nraw_json by source:');
  for (const s of bySource) {
    console.log(`  ${s.source}: ${s.json_size || 'NULL'} (${s.count} rows)`);
  }

  await sql.end();
}

main().catch(console.error);
