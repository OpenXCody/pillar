import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  // Fix XF (unknown state code) - null it out
  const xf = await db.execute(sql`UPDATE facilities SET state = NULL WHERE state = 'XF'`);
  console.log('Fixed XF:', (xf as any)?.rowCount ?? '?');

  // Check territories
  const territories = await db.execute(sql`
    SELECT state, count(*) as cnt FROM facilities
    WHERE state IN ('AS', 'GU', 'MP', 'VI')
    GROUP BY state
  `);
  console.log('Territory records (keeping but excluded from export):');
  for (const t of territories) console.log(`  ${t.state}: ${t.cnt}`);

  // Final state count (50 + DC + PR + territories)
  const final = await db.execute(sql`
    SELECT count(DISTINCT state) as cnt FROM facilities WHERE state IS NOT NULL
  `);
  console.log(`Total distinct state codes: ${final[0].cnt}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
