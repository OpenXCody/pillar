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

  // Sector distribution
  const sectors = await db.execute(sql`
    SELECT sector, COUNT(*)::int as cnt FROM companies
    WHERE sector IS NOT NULL GROUP BY sector ORDER BY cnt DESC LIMIT 10
  `);
  console.log();
  console.log('=== Top Company Sectors ===');
  for (const r of sectors) {
    console.log('  ' + String(r.cnt).padStart(6) + '  ' + r.sector);
  }

  // Companies with tickers
  const [tickered] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM companies WHERE name_variants::text LIKE '%ticker%'
  `);
  console.log();
  console.log('Companies with SEC tickers:', tickered.cnt);

  // Confidence distribution
  const confDist = await db.execute(sql`
    SELECT
      CASE WHEN confidence >= 90 THEN '90+' WHEN confidence >= 70 THEN '70-89'
           WHEN confidence >= 50 THEN '50-69' WHEN confidence >= 30 THEN '30-49' ELSE '<30' END as range,
      COUNT(*)::int as cnt
    FROM facilities GROUP BY 1 ORDER BY 1 DESC
  `);
  console.log();
  console.log('=== Confidence Distribution ===');
  for (const r of confDist) {
    console.log('  ' + String(r.range).padEnd(8) + String(r.cnt).padStart(8));
  }

  process.exit(0);
}
main();
