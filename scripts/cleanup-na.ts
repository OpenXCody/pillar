import 'dotenv/config';
import { db } from '../server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  // Check current state
  const before = await db.execute(sql`
    SELECT name, facility_count FROM companies WHERE name = 'Na'
  `);
  console.log('Before:', before);

  // 1. Null out company references on facilities linked to "Na"
  const updated = await db.execute(sql`
    UPDATE facilities
    SET company_name = NULL, company_id = NULL, updated_at = NOW()
    WHERE company_name = 'Na'
  `);
  console.log('Facilities unlinked from Na:', (updated as any)?.rowCount ?? 'unknown');

  // 2. Also clean other known bad names
  const badNames = ['Na', 'N/A', 'Tbd', 'Unknown', 'None', 'Test', 'Null', 'Various', 'Other', 'Private', '-', '.'];
  for (const name of badNames) {
    const result = await db.execute(sql`
      UPDATE facilities
      SET company_name = NULL, company_id = NULL, updated_at = NOW()
      WHERE company_name = ${name}
    `);
    const count = (result as any)?.rowCount ?? 0;
    if (count > 0) console.log(`  Unlinked ${count} facilities from "${name}"`);
  }

  // 3. Delete orphaned company records (no linked facilities)
  const deleted = await db.execute(sql`
    DELETE FROM companies
    WHERE name IN ('Na', 'N/A', 'Tbd', 'Unknown', 'None', 'Test', 'Null', 'Various', 'Other', 'Private', '-', '.')
  `);
  console.log('Bad company records deleted:', (deleted as any)?.rowCount ?? 'unknown');

  // 4. Recount facility counts for all companies
  await db.execute(sql`
    UPDATE companies c
    SET facility_count = COALESCE(sub.cnt, 0), updated_at = NOW()
    FROM (
      SELECT company_id, count(*) as cnt
      FROM facilities WHERE company_id IS NOT NULL
      GROUP BY company_id
    ) sub
    WHERE c.id = sub.company_id AND c.facility_count != COALESCE(sub.cnt, 0)
  `);
  console.log('Company facility counts recalculated');

  // Verify
  const after = await db.execute(sql`
    SELECT name, facility_count FROM companies WHERE name = 'Na'
  `);
  console.log('After:', after);

  const stats = await db.execute(sql`
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE company_id IS NOT NULL) as linked
    FROM facilities
  `);
  console.log('Facility stats:', stats[0]);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
