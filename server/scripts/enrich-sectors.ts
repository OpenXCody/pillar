/**
 * Enrich Company Sectors
 *
 * Sets company.sector based on the most common NAICS code across their facilities.
 * Uses a single bulk UPDATE for speed.
 *
 * Run: npx tsx server/scripts/enrich-sectors.ts
 */

import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('\n=== Company Sector Enrichment (Bulk) ===\n');

  // Single SQL to update all companies in one shot using CASE expression
  // This does the mode() calculation and NAICS-to-sector mapping in SQL
  console.log('Calculating most common NAICS per company...');

  await db.execute(sql`
    WITH company_naics AS (
      SELECT
        company_id,
        LEFT(primary_naics, 3) as naics3,
        COUNT(*) as cnt
      FROM facilities
      WHERE company_id IS NOT NULL AND primary_naics IS NOT NULL AND LENGTH(primary_naics) >= 3
      GROUP BY company_id, LEFT(primary_naics, 3)
    ),
    top_naics AS (
      SELECT DISTINCT ON (company_id)
        company_id,
        naics3
      FROM company_naics
      ORDER BY company_id, cnt DESC
    ),
    sector_map AS (
      SELECT
        company_id,
        naics3,
        CASE naics3
          WHEN '311' THEN 'Food Manufacturing'
          WHEN '312' THEN 'Beverage & Tobacco'
          WHEN '313' THEN 'Textile Mills'
          WHEN '314' THEN 'Textile Product Mills'
          WHEN '315' THEN 'Apparel Manufacturing'
          WHEN '316' THEN 'Leather & Allied Products'
          WHEN '321' THEN 'Wood Product Manufacturing'
          WHEN '322' THEN 'Paper Manufacturing'
          WHEN '323' THEN 'Printing & Related'
          WHEN '324' THEN 'Petroleum & Coal Products'
          WHEN '325' THEN 'Chemical Manufacturing'
          WHEN '326' THEN 'Plastics & Rubber Products'
          WHEN '327' THEN 'Nonmetallic Mineral Products'
          WHEN '331' THEN 'Primary Metal Manufacturing'
          WHEN '332' THEN 'Fabricated Metal Products'
          WHEN '333' THEN 'Machinery Manufacturing'
          WHEN '334' THEN 'Computer & Electronic Products'
          WHEN '335' THEN 'Electrical Equipment & Appliances'
          WHEN '336' THEN 'Transportation Equipment'
          WHEN '337' THEN 'Furniture & Related Products'
          WHEN '339' THEN 'Miscellaneous Manufacturing'
          ELSE 'Manufacturing'
        END as sector_label
      FROM top_naics
    )
    UPDATE companies c SET
      sector = sm.sector_label,
      updated_at = NOW()
    FROM sector_map sm
    WHERE c.id = sm.company_id
      AND (c.sector IS NULL OR c.sector = 'Manufacturing' OR c.sector != sm.sector_label)
  `);

  console.log('Bulk sector update complete');

  // Show sector distribution
  const topSectors = await db.execute(sql`
    SELECT sector, COUNT(*)::int as cnt
    FROM companies
    WHERE sector IS NOT NULL
    GROUP BY sector
    ORDER BY cnt DESC
    LIMIT 25
  `);

  console.log('\nSector distribution:');
  for (const r of topSectors) {
    console.log(`  ${String(r.cnt).padStart(6)}  ${r.sector}`);
  }

  // Count remaining without specific sector
  const [remaining] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM companies WHERE sector IS NULL OR sector = 'Manufacturing'
  `);
  console.log(`\nCompanies still generic/null: ${remaining.cnt}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Sector enrichment failed:', err);
  process.exit(1);
});
