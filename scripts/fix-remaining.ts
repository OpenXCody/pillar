import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';
import { extractCompanyFromFacilityName } from '../shared/companyNormalization.js';

async function main() {
  // Check for still-misattributed records
  const misattributed = await db.execute(sql`
    SELECT id, name, company_name FROM facilities
    WHERE name ~ '^[A-Z].+ - .*(CATERPILLAR|CUMMINS|WAUKESHA)'
      AND company_name IN ('Caterpillar', 'Cummins', 'John Deere')
    LIMIT 20
  `) as { id: string; name: string; company_name: string }[];
  console.log(`Still misattributed: ${misattributed.length}`);
  for (const r of misattributed) console.log(`  "${r.name}" → ${r.company_name}`);

  // Test the extraction on a few names
  const testNames = [
    'HILCORP - PORTABLE CATERPILLAR 3306NA',
    'EOG - PORTABLE CATERPILLAR G3406NA',
    'ARCHROCK - CATERPILLAR G3516 TALE NO2045',
    'CATERPILLAR INC - MAPLETON',
    'CATERPILLAR REMANUFACTURING POWERTRAIN',
  ];
  console.log('\nExtraction test:');
  for (const name of testNames) {
    console.log(`  "${name}" → ${extractCompanyFromFacilityName(name)}`);
  }

  // Check current top companies
  const top = await db.execute(sql`
    SELECT company_name, count(*) as cnt FROM facilities
    WHERE company_name IS NOT NULL
    GROUP BY company_name ORDER BY count(*) DESC LIMIT 15
  `);
  console.log('\nTop companies:');
  for (const r of top) console.log(`  ${r.company_name}: ${r.cnt}`);

  // Total stats
  const stats = await db.execute(sql`
    SELECT count(*) as total,
      count(*) FILTER (WHERE company_id IS NOT NULL) as linked
    FROM facilities
  `);
  console.log('\nFacility stats:', stats[0]);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
