import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
await sql`DELETE FROM source_runs`;
console.log('Cleaned up stale source runs');
await sql.end();
