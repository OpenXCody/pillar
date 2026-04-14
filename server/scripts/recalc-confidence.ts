/**
 * Recalculate Facility Confidence Scores
 *
 * Confidence is 0-100 based on how much data we have:
 * - Has name: +10
 * - Has address: +10
 * - Has city + state: +10
 * - Has zip code: +5
 * - Has coordinates: +15
 * - Has NAICS code: +10
 * - Has company: +10
 * - Multi-source (2+): +15
 * - Triple-source (3+): +10 (additional)
 * - Has employee count: +5
 *
 * Max = 100
 *
 * Run: npx tsx server/scripts/recalc-confidence.ts
 */

import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('\n=== Recalculate Confidence Scores ===\n');

  await db.execute(sql`
    UPDATE facilities SET confidence = (
      CASE WHEN name IS NOT NULL AND name != '' THEN 10 ELSE 0 END +
      CASE WHEN address IS NOT NULL AND address != '' THEN 10 ELSE 0 END +
      CASE WHEN city IS NOT NULL AND state IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN zip IS NOT NULL AND zip != '' THEN 5 ELSE 0 END +
      CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 15 ELSE 0 END +
      CASE WHEN primary_naics IS NOT NULL AND primary_naics != '' THEN 10 ELSE 0 END +
      CASE WHEN company_id IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN source_count >= 2 THEN 15 ELSE 0 END +
      CASE WHEN source_count >= 3 THEN 10 ELSE 0 END +
      CASE WHEN employee_count IS NOT NULL AND employee_count > 0 THEN 5 ELSE 0 END
    )
  `);

  // Show distribution
  const dist = await db.execute(sql`
    SELECT
      CASE
        WHEN confidence >= 90 THEN '90-100'
        WHEN confidence >= 70 THEN '70-89'
        WHEN confidence >= 50 THEN '50-69'
        WHEN confidence >= 30 THEN '30-49'
        ELSE '0-29'
      END as range,
      COUNT(*)::int as cnt
    FROM facilities
    GROUP BY 1
    ORDER BY 1 DESC
  `);

  console.log('Confidence distribution:');
  for (const r of dist) {
    console.log(`  ${String(r.range).padEnd(8)} ${String(r.cnt).padStart(8)} facilities`);
  }

  // Average
  const [avg] = await db.execute(sql`SELECT AVG(confidence)::int as avg_conf FROM facilities`);
  console.log(`\nAverage confidence: ${avg.avg_conf}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Confidence recalc failed:', err);
  process.exit(1);
});
