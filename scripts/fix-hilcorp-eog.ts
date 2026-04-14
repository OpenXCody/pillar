import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  // Fix Hil -> Hilcorp and Eog -> EOG Resources
  await db.execute(sql`UPDATE facilities SET company_name = NULL, company_id = NULL WHERE company_name IN ('Hil', 'Eog')`);
  await db.execute(sql`DELETE FROM companies WHERE name IN ('Hil', 'Eog')`);
  console.log('Cleaned up bad company names');

  const { runEnrichment } = await import('../server/pipeline/enrichment.js');
  const result = await runEnrichment();
  console.log('Enrichment:', JSON.stringify(result));

  const cat = await db.execute(sql`SELECT count(*) as cnt FROM facilities WHERE company_name = 'Caterpillar'`);
  const hilcorp = await db.execute(sql`SELECT count(*) as cnt FROM facilities WHERE company_name = 'Hilcorp'`);
  const eog = await db.execute(sql`SELECT count(*) as cnt FROM facilities WHERE company_name = 'EOG Resources'`);
  console.log(`Caterpillar: ${cat[0].cnt}, Hilcorp: ${hilcorp[0].cnt}, EOG Resources: ${eog[0].cnt}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
