import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const rows = await db.execute(sql`
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE company_id IS NOT NULL) as linked,
      count(*) FILTER (WHERE company_id IS NULL) as unlinked,
      count(*) FILTER (WHERE company_name IS NOT NULL) as has_name,
      count(*) FILTER (WHERE company_id IS NULL AND company_name IS NOT NULL) as orphan
    FROM facilities
  `);
  console.log('Facilities:', rows[0]);

  const compRows = await db.execute(sql`
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE sector IS NOT NULL AND sector != '') as with_sector,
      count(*) FILTER (WHERE sector IS NULL OR sector = '') as no_sector
    FROM companies
  `);
  console.log('Companies:', compRows[0]);

  const samples = await db.execute(sql`
    SELECT name FROM facilities WHERE company_id IS NULL AND company_name IS NULL ORDER BY random() LIMIT 30
  `);
  console.log('\nSample still unlinked:');
  for (const s of samples) console.log(' ', s.name);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
