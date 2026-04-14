import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  // 1. Check raw_records for equipment patterns
  const rawPortable = await db.execute(sql`
    SELECT count(*) as cnt FROM raw_records WHERE raw_name ~* '\bPORTABLE\b'
  `);
  console.log('Raw records with PORTABLE:', rawPortable[0].cnt);

  const rawEquip = await db.execute(sql`
    SELECT count(*) as cnt FROM raw_records
    WHERE raw_name ~* '\b(GENERATOR|ENGINE|COMPRESSOR|PUMP STATION|BOILER|TURBINE|GENSET|WELLHEAD|WELL PAD|TANK BATTERY|PIPELINE)\b'
  `);
  console.log('Raw records with equipment keywords:', rawEquip[0].cnt);

  // 2. Sample raw Caterpillar records
  const rawCat = await db.execute(sql`
    SELECT raw_name, raw_city, raw_state, source, facility_id
    FROM raw_records
    WHERE raw_name ~* '\bCATERPILLAR\b'
    ORDER BY random() LIMIT 30
  `);
  console.log('\nSample raw records mentioning Caterpillar:');
  for (const r of rawCat) {
    const linked = r.facility_id ? 'LINKED' : 'unlinked';
    console.log(`  [${r.source}] ${r.raw_name} — ${r.raw_city}, ${r.raw_state} (${linked})`);
  }

  // 3. How many raw Caterpillar records are equipment vs facilities?
  const rawCatEquip = await db.execute(sql`
    SELECT count(*) as cnt FROM raw_records
    WHERE raw_name ~* '\bCATERPILLAR\b'
    AND (raw_name ~* '\bPORTABLE\b' OR raw_name ~* '\bG\d{3,4}\b' OR raw_name ~* '\bC-?\d{1,2}\b'
         OR raw_name ~* '\bGENERATOR\b' OR raw_name ~* '\b3\d{3}\b' OR raw_name ~* '\bPACKAGE\b'
         OR raw_name ~* '\bNO\s*\d' OR raw_name ~* '\bSN\b' OR raw_name ~* '\bHP\b')
  `);
  const rawCatTotal = await db.execute(sql`
    SELECT count(*) as cnt FROM raw_records WHERE raw_name ~* '\bCATERPILLAR\b'
  `);
  console.log(`\nRaw Caterpillar: ${rawCatEquip[0].cnt} equipment-like out of ${rawCatTotal[0].cnt} total`);

  // 4. What golden records do these map to?
  const catFacilities = await db.execute(sql`
    SELECT f.name, f.city, f.state, f.source_count,
      (SELECT count(*) FROM raw_records rr WHERE rr.facility_id = f.id) as raw_count
    FROM facilities f
    WHERE f.company_name = 'Caterpillar'
    ORDER BY random() LIMIT 30
  `);
  console.log('\nSample Caterpillar golden records:');
  for (const r of catFacilities) {
    console.log(`  ${r.name} — ${r.city}, ${r.state} (${r.source_count} sources, ${r.raw_count} raw)`);
  }

  // 5. Broader: how many golden records have names suggesting equipment/infrastructure?
  const infraPatterns = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities
    WHERE name ~* '\b(PORTABLE|GENERATOR|COMPRESSOR STATION|PUMP STATION|WELLHEAD|WELL PAD|TANK BATTERY|PIPELINE|METER STATION|GAS PLANT|OIL FIELD|DRILL|FLARE)\b'
  `);
  console.log(`\nGolden records with infrastructure/equipment names: ${infraPatterns[0].cnt}`);

  // 6. Same check but case-insensitive and broader
  const infraBroad = await db.execute(sql`
    SELECT name, company_name, city, state FROM facilities
    WHERE name ILIKE '%PORTABLE%' OR name ILIKE '%GENERATOR%' OR name ILIKE '%COMPRESSOR STA%'
       OR name ILIKE '%PUMP STATION%' OR name ILIKE '%WELLHEAD%' OR name ILIKE '%WELL PAD%'
       OR name ILIKE '%TANK BATTERY%' OR name ILIKE '%PIPELINE%' OR name ILIKE '%METER STA%'
    LIMIT 30
  `);
  console.log(`\nSample infrastructure-named golden records:`);
  for (const r of infraBroad) {
    console.log(`  ${r.name} — ${r.company_name || '(no company)'} — ${r.city}, ${r.state}`);
  }

  // 7. How many facilities are oil/gas infrastructure (not manufacturing)?
  const oilGas = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities
    WHERE name ILIKE '%COMPRESSOR STATION%' OR name ILIKE '%PUMP STATION%'
       OR name ILIKE '%WELLHEAD%' OR name ILIKE '%WELL PAD%' OR name ILIKE '%TANK BATTERY%'
       OR name ILIKE '%GAS PLANT%' OR name ILIKE '%OIL FIELD%' OR name ILIKE '%PIPELINE%'
       OR name ILIKE '%METER STATION%' OR name ILIKE '%FLARE%' OR name ILIKE '%SEPARATOR%'
  `);
  console.log(`\nOil/gas infrastructure facilities: ${oilGas[0].cnt}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
