import { db } from '../db/index.js';
import { facilities, companies, rawRecords } from '../db/schema.js';
import { sql, count, isNull, isNotNull } from 'drizzle-orm';

async function main() {
  const [fc] = await db.select({ count: count() }).from(facilities);
  const [cc] = await db.select({ count: count() }).from(companies);
  const [rc] = await db.select({ count: count() }).from(rawRecords);
  const [noCompany] = await db.select({ count: count() }).from(facilities).where(isNull(facilities.companyId));
  const [withCompany] = await db.select({ count: count() }).from(facilities).where(isNotNull(facilities.companyId));
  const [multiSource] = await db.select({ count: count() }).from(facilities).where(sql`source_count >= 2`);

  const topUnlinked = await db.execute(sql`
    SELECT name, city, state, source_count
    FROM facilities
    WHERE company_id IS NULL
    ORDER BY source_count DESC, name
    LIMIT 30
  `);

  console.log('=== Database Status ===');
  console.log('Facilities:', fc.count);
  console.log('Companies:', cc.count);
  console.log('Raw Records:', rc.count);
  console.log('With company:', withCompany.count, '(' + Math.round(Number(withCompany.count) / Number(fc.count) * 100) + '%)');
  console.log('Without company:', noCompany.count, '(' + Math.round(Number(noCompany.count) / Number(fc.count) * 100) + '%)');
  console.log('Multi-source:', multiSource.count);
  console.log();
  console.log('=== Top 30 Unlinked (by source count) ===');
  for (const r of topUnlinked) {
    console.log('  [' + r.source_count + ' src] ' + r.name + ' — ' + r.city + ', ' + r.state);
  }
  process.exit(0);
}
main();
