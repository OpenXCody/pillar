import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  // 1. How many facilities have "PORTABLE" in the name?
  const portable = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities WHERE name ~* '\bPORTABLE\b'
  `);
  console.log('Facilities with PORTABLE:', portable[0].cnt);

  // 2. How many have equipment model patterns (alphanumeric model numbers)?
  const equipment = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities
    WHERE name ~* '\b(GENERATOR|ENGINE|COMPRESSOR|PUMP|BOILER|TURBINE|GENSET|CHILLER)\b'
  `);
  console.log('Facilities with equipment keywords:', equipment[0].cnt);

  // 3. How many Caterpillar facilities look like equipment vs real factories?
  const catEquip = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities
    WHERE company_name = 'Caterpillar'
    AND (name ~* '\bPORTABLE\b' OR name ~* '\bG\d{4}\b' OR name ~* '\bC\d{1,2}\b'
         OR name ~* '\bGENERATOR\b' OR name ~* '\bENGINE\b' OR name ~* '\bCOMPRESSOR\b'
         OR name ~* '\b\d{4,5}\b' OR name ~* '\bPACKAGE\b')
  `);
  const catTotal = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities WHERE company_name = 'Caterpillar'
  `);
  console.log(`\nCaterpillar: ${catEquip[0].cnt} equipment-like out of ${catTotal[0].cnt} total`);

  // 4. Sample Caterpillar equipment names
  const catSamples = await db.execute(sql`
    SELECT name, city, state FROM facilities
    WHERE company_name = 'Caterpillar'
    AND (name ~* '\bPORTABLE\b' OR name ~* '\bG\d{4}\b' OR name ~* '\bGENERATOR\b'
         OR name ~* '\bENGINE\b' OR name ~* '\bCOMPRESSOR\b' OR name ~* '\bPACKAGE\b')
    ORDER BY random() LIMIT 20
  `);
  console.log('\nSample Caterpillar equipment records:');
  for (const r of catSamples) console.log(`  ${r.name} — ${r.city}, ${r.state}`);

  // 5. Sample real Caterpillar factories
  const catReal = await db.execute(sql`
    SELECT name, city, state FROM facilities
    WHERE company_name = 'Caterpillar'
    AND name !~* '\bPORTABLE\b' AND name !~* '\bG\d{4}\b' AND name !~* '\bGENERATOR\b'
    AND name !~* '\bENGINE\b' AND name !~* '\bCOMPRESSOR\b' AND name !~* '\bPACKAGE\b'
    AND name !~* '\b\d{4,5}\b'
    ORDER BY source_count DESC LIMIT 15
  `);
  console.log('\nSample likely-real Caterpillar factories:');
  for (const r of catReal) console.log(`  ${r.name} — ${r.city}, ${r.state}`);

  // 6. Which other companies might have this problem?
  const topCompanies = await db.execute(sql`
    SELECT company_name, count(*) as total,
      count(*) FILTER (WHERE name ~* '\b(PORTABLE|GENERATOR|ENGINE|COMPRESSOR|PUMP|BOILER|TURBINE|GENSET)\b') as equipment_like
    FROM facilities
    WHERE company_name IS NOT NULL
    GROUP BY company_name
    HAVING count(*) FILTER (WHERE name ~* '\b(PORTABLE|GENERATOR|ENGINE|COMPRESSOR|PUMP|BOILER|TURBINE|GENSET)\b') > 10
    ORDER BY equipment_like DESC
    LIMIT 20
  `);
  console.log('\nCompanies with most equipment-like records:');
  console.log('Company | Equipment-like | Total | % Equipment');
  for (const r of topCompanies) {
    const pct = Math.round((Number(r.equipment_like) / Number(r.total)) * 100);
    console.log(`  ${r.company_name} | ${r.equipment_like} | ${r.total} | ${pct}%`);
  }

  // 7. Broader pattern: facilities that are likely equipment, not factories
  const broadEquip = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities
    WHERE name ~* '\b(PORTABLE|GENERATOR|ENGINE NO|COMPRESSOR STATION|PUMP STATION|BOILER|TURBINE|GENSET|WELLHEAD|WELL PAD|TANK BATTERY|FLARE|VENT|METER STATION|PIPELINE|LINE\s+\d|MP\s+\d)\b'
  `);
  console.log(`\nTotal facilities matching broad equipment/infrastructure patterns: ${broadEquip[0].cnt}`);

  // 8. What percentage of our 276K are likely NOT manufacturing facilities?
  const totalFac = await db.execute(sql`SELECT count(*) as cnt FROM facilities`);
  console.log(`Total facilities: ${totalFac[0].cnt}`);
  console.log(`Estimated equipment/infrastructure: ${broadEquip[0].cnt} (${Math.round((Number(broadEquip[0].cnt) / Number(totalFac[0].cnt)) * 100)}%)`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
