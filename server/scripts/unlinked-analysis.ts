import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  // What types of names remain unlinked?
  const categories = await db.execute(sql`
    WITH categorized AS (
      SELECT 
        CASE 
          WHEN name LIKE 'CITY OF %' OR name LIKE 'VILLAGE OF %' OR name LIKE 'TOWN OF %' OR name LIKE 'PORT OF %' OR name LIKE 'COUNTY OF %' THEN 'government'
          WHEN name LIKE 'US %' OR name LIKE 'U.S. %' OR name LIKE 'US NAVY%' OR name LIKE 'US ARMY%' OR name LIKE 'CALTRANS%' OR name LIKE 'WA DOT%' THEN 'government'
          WHEN name ~ '.*(PLANT|FACILITY|FACTORY|WORKS|MILL|REFINERY|TERMINAL)\s*#?\d*$' THEN 'has_facility_suffix'
          WHEN name ~ '.*#\d+.*' THEN 'has_number'
          WHEN name ~ '.*(INC|LLC|CORP|LTD|CO)\.?\s*$' THEN 'has_corporate_suffix'
          WHEN name ~ '^[A-Z] & [A-Z]' THEN 'initial_ampersand'
          WHEN LENGTH(name) < 10 THEN 'very_short'
          ELSE 'other'
        END as category
      FROM facilities
      WHERE company_id IS NULL
    )
    SELECT category, COUNT(*)::int as cnt
    FROM categorized
    GROUP BY category
    ORDER BY cnt DESC
  `);

  console.log('=== Unlinked Facility Categories ===');
  for (const r of categories) {
    console.log('  ' + String(r.cnt).padStart(6) + '  ' + r.category);
  }

  // Sample some "has_corporate_suffix" that should have matched
  const corpSuffix = await db.execute(sql`
    SELECT name, city, state FROM facilities
    WHERE company_id IS NULL
      AND name ~ '.*(INC|LLC|CORP|LTD|CO)\.?\s*$'
    LIMIT 20
  `);
  console.log('\n=== Sample unlinked with corporate suffix ===');
  for (const r of corpSuffix) {
    console.log('  ' + r.name + ' — ' + r.city + ', ' + r.state);
  }

  // Check specific user-expected companies
  const userCheck = await db.execute(sql`
    SELECT c.name, c.facility_count
    FROM companies c
    WHERE c.name IN (
      'Applied Materials', 'Airgas', 'Ingersoll Rand', 'Atlas Copco', 'Magna International',
      'Phillips 66', 'Procter & Gamble', 'Colgate-Palmolive', 'Kimberly-Clark',
      'Anheuser-Busch', 'Boston Scientific', 'Medtronic', 'Stryker',
      'Mohawk Industries', 'Shaw Industries', 'Pella', 'Alcoa',
      'Spirit AeroSystems', 'Howmet Aerospace', 'Frito-Lay',
      'Foster Farms', 'Trident Seafoods', 'Zimmer Biomet'
    )
    ORDER BY c.facility_count DESC
  `);
  console.log('\n=== Key Company Facility Counts ===');
  for (const r of userCheck) {
    console.log('  ' + String(r.facility_count).padStart(4) + '  ' + r.name);
  }

  process.exit(0);
}
main();
