import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  // 1. Caterpillar: equipment vs real factories
  const catAll = await db.execute(sql`
    SELECT name, city, state FROM facilities WHERE company_name = 'Caterpillar'
  `) as { name: string; city: string | null; state: string | null }[];

  let catEquip = 0;
  let catReal = 0;
  const equipPatterns = /\b(G\d{3,4}|C-?\d{1,2}\b|3\d{3}|D-?\d{1,2}\b|\d{3,4}\s*HP|\bSN\b|NO\d{3,4}|PORTABLE SOURCE|STATEWIDE)/i;
  const otherCompanyPrefix = /^(?!CATERPILLAR).+\s*-\s*.*CATERPILLAR/i;

  for (const f of catAll) {
    if (equipPatterns.test(f.name) || otherCompanyPrefix.test(f.name) || f.city === 'PORTABLE SOURCE' || f.city === 'STATEWIDE') {
      catEquip++;
    } else {
      catReal++;
    }
  }
  console.log(`CATERPILLAR: ${catEquip} equipment / ${catReal} real factories / ${catAll.length} total`);

  // 2. Check other engine/equipment manufacturers
  const suspects = ['Cummins', 'John Deere', 'Waukesha', 'Kohler', 'Generac'];
  for (const company of suspects) {
    const all = await db.execute(sql`
      SELECT name, city FROM facilities WHERE company_name = ${company}
    `) as { name: string; city: string | null }[];
    let equip = 0;
    for (const f of all) {
      if (equipPatterns.test(f.name) || f.city === 'PORTABLE SOURCE' || f.city === 'STATEWIDE') equip++;
    }
    if (equip > 0) console.log(`${company}: ${equip} equipment / ${all.length - equip} real / ${all.length} total`);
  }

  // 3. Facilities with city = "PORTABLE SOURCE" or "STATEWIDE"
  const portableCity = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities WHERE city ILIKE '%PORTABLE SOURCE%' OR city ILIKE '%STATEWIDE%'
  `);
  console.log(`\nFacilities with city = PORTABLE SOURCE or STATEWIDE: ${portableCity[0].cnt}`);

  // 4. All facilities where another company's name comes BEFORE the equipment brand
  // Pattern: "[REAL COMPANY] - [BRAND] [MODEL]"
  const crossBrand = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities
    WHERE name ~ '^[A-Z].+ - .*(CATERPILLAR|CUMMINS|WAUKESHA|JOHN DEERE)'
  `);
  console.log(`Facilities with "[COMPANY] - [BRAND]" pattern: ${crossBrand[0].cnt}`);

  // Samples
  const crossSamples = await db.execute(sql`
    SELECT name, company_name, city, state FROM facilities
    WHERE name ~ '^[A-Z].+ - .*(CATERPILLAR|CUMMINS|WAUKESHA|JOHN DEERE)'
    ORDER BY random() LIMIT 15
  `);
  console.log('\nSample cross-brand misattributions:');
  for (const r of crossSamples) {
    console.log(`  "${r.name}" → linked to: ${r.company_name || '(none)'}`);
  }

  // 5. Total scope: how many facilities are really equipment/infrastructure?
  const nonFacility = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities
    WHERE city ILIKE '%PORTABLE SOURCE%'
       OR city ILIKE '%STATEWIDE%'
       OR name ~ '^\d{3,4}\s*HP\b'
       OR name ~ '\bSN\s*[A-Z0-9]{5,}\b'
       OR name ~ '\bNO\d{4}\b'
       OR name ~ '\bUNIT\s*#\d+'
  `);
  console.log(`\nFacilities that are clearly equipment registrations: ${nonFacility[0].cnt}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
