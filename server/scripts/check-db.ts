import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const raw = await sql`SELECT source, count(*) as cnt FROM raw_records GROUP BY source`;
const runs = await sql`SELECT source, status, total_fetched, new_records, error_log FROM source_runs ORDER BY started_at DESC LIMIT 10`;
console.log('Raw records by source:', JSON.stringify(raw, null, 2));
console.log('Recent runs:', JSON.stringify(runs, null, 2));
await sql.end();
