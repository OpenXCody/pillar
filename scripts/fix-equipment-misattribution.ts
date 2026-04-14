import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== Equipment Misattribution Fix ===\n');

  // 1. Reset company links on facilities where the name has "[OPERATOR] - [BRAND MODEL]" pattern
  //    and the company was set to the BRAND instead of the OPERATOR
  const crossBrand = await db.execute(sql`
    UPDATE facilities SET
      company_name = NULL,
      company_id = NULL,
      updated_at = NOW()
    WHERE name ~ '^[A-Z].+ - .*(CATERPILLAR|CUMMINS|WAUKESHA|JOHN DEERE|KOHLER|GENERAC)'
      AND company_name IN ('Caterpillar', 'Cummins', 'John Deere', 'Kohler', 'Generac')
  `);
  console.log(`Reset cross-brand misattributions: ${(crossBrand as any)?.rowCount ?? '?'} facilities`);

  // 2. Reset company links on equipment-like Caterpillar records
  //    (model numbers, serial numbers, HP ratings in the name)
  const equipCat = await db.execute(sql`
    UPDATE facilities SET
      company_name = NULL,
      company_id = NULL,
      updated_at = NOW()
    WHERE company_name = 'Caterpillar'
      AND (
        name ~* '\bG\d{3,4}\b'
        OR name ~* '\b3\d{3}\b'
        OR name ~* '\bD-?\d{2}\b'
        OR name ~* '\d{3,4}\s*HP\b'
        OR name ~* '\bSN\s*[A-Z0-9]'
        OR name ~* '\bNO\d{3,4}\b'
        OR name ~* '\bUNIT\s*#'
        OR city ILIKE '%PORTABLE SOURCE%'
        OR city ILIKE '%STATEWIDE%'
      )
  `);
  console.log(`Reset equipment-like Caterpillar records: ${(equipCat as any)?.rowCount ?? '?'} facilities`);

  // 3. Flag facilities with non-facility cities
  const portableCities = await db.execute(sql`
    UPDATE facilities SET
      company_name = NULL,
      company_id = NULL,
      updated_at = NOW()
    WHERE (city ILIKE '%PORTABLE SOURCE%' OR city ILIKE '%STATEWIDE%')
      AND company_id IS NOT NULL
  `);
  console.log(`Reset PORTABLE SOURCE/STATEWIDE facilities: ${(portableCities as any)?.rowCount ?? '?'} facilities`);

  // 4. Recount company facility counts
  await db.execute(sql`
    UPDATE companies c SET
      facility_count = COALESCE(sub.cnt, 0),
      updated_at = NOW()
    FROM (
      SELECT company_id, count(*) as cnt
      FROM facilities WHERE company_id IS NOT NULL
      GROUP BY company_id
    ) sub
    WHERE c.id = sub.company_id AND c.facility_count != sub.cnt
  `);

  // Also zero out companies with no more facilities
  await db.execute(sql`
    UPDATE companies SET facility_count = 0, updated_at = NOW()
    WHERE id NOT IN (SELECT DISTINCT company_id FROM facilities WHERE company_id IS NOT NULL)
      AND facility_count > 0
  `);
  console.log('Company facility counts recalculated');

  // 5. Check new Caterpillar count
  const catAfter = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities WHERE company_name = 'Caterpillar'
  `);
  console.log(`\nCaterpillar after fix: ${catAfter[0].cnt} facilities`);

  // 6. Now re-run enrichment to try linking the reset records to the correct operator
  console.log('\nRunning enrichment to relink reset records...');
  const { runEnrichment } = await import('../server/pipeline/enrichment.js');
  const result = await runEnrichment();
  console.log('Enrichment result:', JSON.stringify(result, null, 2));

  // 7. Final Caterpillar count
  const catFinal = await db.execute(sql`
    SELECT count(*) as cnt FROM facilities WHERE company_name = 'Caterpillar'
  `);
  console.log(`\nCaterpillar final: ${catFinal[0].cnt} facilities`);

  // 8. Sample of what was relinked
  const relinked = await db.execute(sql`
    SELECT name, company_name, city, state FROM facilities
    WHERE name ~ '^[A-Z].+ - .*(CATERPILLAR|CUMMINS)'
      AND company_name IS NOT NULL
      AND company_name NOT IN ('Caterpillar', 'Cummins')
    LIMIT 10
  `);
  console.log('\nSample relinked records:');
  for (const r of relinked) {
    console.log(`  "${r.name}" → ${r.company_name}`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
