import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';
async function main() {
  const states = await db.execute(sql`
    SELECT state, count(*) as cnt FROM facilities
    WHERE state IS NOT NULL
    GROUP BY state ORDER BY state
  `);
  console.log('All distinct states:');
  for (const s of states) console.log(`  ${s.state}: ${Number(s.cnt).toLocaleString()}`);
  console.log(`\nTotal distinct: ${states.length}`);
  // Show non-standard ones
  const valid = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']);
  const invalid = states.filter(s => !valid.has(String(s.state)));
  console.log('\nNon-standard state codes:');
  for (const s of invalid) console.log(`  "${s.state}": ${Number(s.cnt).toLocaleString()}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
