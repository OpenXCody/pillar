/**
 * Enrichment Pipeline
 *
 * Post-merge enrichment that runs across all facilities:
 * 1. Company relinking — extract company names from unlinked facilities using enhanced rules
 * 2. Employee count propagation — pull OSHA employee counts into golden records
 * 3. Sector labeling — assign broad sector labels from NAICS codes
 * 4. Confidence recalculation — update scores based on source count and data quality
 */

import { db } from '../db/index.js';
import { companies } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { resolveCompanyName } from './normalize/nameNormalizer.js';

export interface EnrichmentResult {
  companiesLinked: number;
  companiesCreated: number;
  employeeCountsAdded: number;
  sectorsAssigned: number;
  confidenceRecalculated: number;
}

/**
 * Run all enrichment stages
 */
export async function runEnrichment(): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    companiesLinked: 0,
    companiesCreated: 0,
    employeeCountsAdded: 0,
    sectorsAssigned: 0,
    confidenceRecalculated: 0,
  };

  console.log('[Enrichment] Starting...');

  // Stage 1: Company relinking
  await relinkCompanies(result);

  // Stage 2: Employee count propagation
  await propagateEmployeeCounts(result);

  // Stage 3: Sector labeling
  await assignSectors(result);

  // Stage 4: Confidence recalculation
  await recalculateConfidence(result);

  // Stage 5: Update company facility counts
  await updateCompanyFacilityCounts();

  console.log(`[Enrichment] Complete:`, result);
  return result;
}

/**
 * Stage 1: Find unlinked facilities and try to extract company names.
 */
async function relinkCompanies(result: EnrichmentResult): Promise<void> {
  const BATCH = 2000;
  const INSERT_BATCH = 500;
  let totalProcessed = 0;
  const companyIdCache = new Map<string, string>();

  while (true) {
    // Get facilities without company_name (no company_id either)
    const unlinked = await db.execute(sql`
      SELECT id, name, company_name
      FROM facilities
      WHERE company_id IS NULL AND company_name IS NULL
      LIMIT ${BATCH}
    `) as { id: string; name: string; company_name: string | null }[];

    if (unlinked.length === 0) break;

    // Also try facilities that have company_name but still no company_id (orphaned names)
    // These would have been skipped if the company wasn't in the DB yet

    // Try to extract company names
    const updates: { id: string; companyName: string }[] = [];
    const uniqueNames = new Set<string>();

    for (const fac of unlinked) {
      // Also check if any raw_records linked to this facility have TRI parent company
      // Use the facility name to try extraction
      const companyName = resolveCompanyName(null, fac.name);
      if (companyName) {
        updates.push({ id: fac.id, companyName });
        uniqueNames.add(companyName);
      }
    }

    if (updates.length === 0) {
      // Mark remaining as processed to avoid infinite loop — set company_name to empty
      // Actually, we just break since there's nothing more we can do
      break;
    }

    // Find or create companies
    const uncachedNames = Array.from(uniqueNames).filter(n => !companyIdCache.has(n));
    if (uncachedNames.length > 0) {
      // Look up existing
      for (let i = 0; i < uncachedNames.length; i += INSERT_BATCH) {
        const batch = uncachedNames.slice(i, i + INSERT_BATCH);
        const existing = await db.select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(sql`${companies.name} IN (${sql.join(batch.map(n => sql`${n}`), sql`, `)})`);
        for (const co of existing) companyIdCache.set(co.name, co.id);
      }

      // Create new ones
      const newNames = uncachedNames.filter(n => !companyIdCache.has(n));
      if (newNames.length > 0) {
        for (let i = 0; i < newNames.length; i += INSERT_BATCH) {
          const batch = newNames.slice(i, i + INSERT_BATCH);
          const inserted = await db.insert(companies)
            .values(batch.map(name => ({ name, facilityCount: 0 })))
            .onConflictDoNothing()
            .returning({ id: companies.id, name: companies.name });
          for (const co of inserted) {
            companyIdCache.set(co.name, co.id);
            result.companiesCreated++;
          }
        }

        // Refetch any that conflicted
        const stillMissing = newNames.filter(n => !companyIdCache.has(n));
        if (stillMissing.length > 0) {
          const refetched = await db.select({ id: companies.id, name: companies.name })
            .from(companies)
            .where(sql`${companies.name} IN (${sql.join(stillMissing.map(n => sql`${n}`), sql`, `)})`);
          for (const co of refetched) companyIdCache.set(co.name, co.id);
        }
      }
    }

    // Update facilities with company names and IDs
    for (let i = 0; i < updates.length; i += 200) {
      const batch = updates.slice(i, i + 200);
      const pairs = batch.map(u => {
        const companyId = companyIdCache.get(u.companyName);
        return sql`(${u.id}::uuid, ${u.companyName}, ${companyId || null}::uuid)`;
      });

      await db.execute(sql`
        UPDATE facilities SET
          company_name = u.cname,
          company_id = u.cid,
          updated_at = NOW()
        FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(fid, cname, cid)
        WHERE facilities.id = u.fid
      `);
    }

    totalProcessed += unlinked.length;
    result.companiesLinked += updates.length;
    console.log(`[Enrichment] Relinked ${updates.length}/${unlinked.length} in batch (total processed: ${totalProcessed})`);
  }

  // Also handle facilities with company_name but no company_id
  const orphaned = await db.execute(sql`
    SELECT id, company_name FROM facilities
    WHERE company_id IS NULL AND company_name IS NOT NULL
    LIMIT 5000
  `) as { id: string; company_name: string }[];

  if (orphaned.length > 0) {
    const names = [...new Set(orphaned.map(f => f.company_name))];
    for (let i = 0; i < names.length; i += INSERT_BATCH) {
      const batch = names.slice(i, i + INSERT_BATCH).filter(n => !companyIdCache.has(n));
      if (batch.length === 0) continue;

      const existing = await db.select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(sql`${companies.name} IN (${sql.join(batch.map(n => sql`${n}`), sql`, `)})`);
      for (const co of existing) companyIdCache.set(co.name, co.id);

      const newNames = batch.filter(n => !companyIdCache.has(n));
      if (newNames.length > 0) {
        const inserted = await db.insert(companies)
          .values(newNames.map(name => ({ name, facilityCount: 0 })))
          .onConflictDoNothing()
          .returning({ id: companies.id, name: companies.name });
        for (const co of inserted) {
          companyIdCache.set(co.name, co.id);
          result.companiesCreated++;
        }
      }
    }

    // Link orphaned facilities
    for (let i = 0; i < orphaned.length; i += 200) {
      const batch = orphaned.slice(i, i + 200);
      const pairs = batch
        .filter(f => companyIdCache.has(f.company_name))
        .map(f => sql`(${f.id}::uuid, ${companyIdCache.get(f.company_name)!}::uuid)`);

      if (pairs.length > 0) {
        await db.execute(sql`
          UPDATE facilities SET company_id = u.cid, updated_at = NOW()
          FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(fid, cid)
          WHERE facilities.id = u.fid
        `);
        result.companiesLinked += pairs.length;
      }
    }
  }

  console.log(`[Enrichment] Company relinking: ${result.companiesLinked} facilities linked, ${result.companiesCreated} new companies`);
}

/**
 * Stage 2: Propagate employee counts from OSHA raw records to golden records.
 */
async function propagateEmployeeCounts(result: EnrichmentResult): Promise<void> {
  // Find facilities that don't have employee counts but have OSHA raw records
  const updated = await db.execute(sql`
    UPDATE facilities SET
      employee_count = sub.emp_count,
      employee_count_source = 'osha'::data_source,
      updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (rr.facility_id)
        rr.facility_id,
        rr.osha_employee_count as emp_count
      FROM raw_records rr
      WHERE rr.source = 'osha'
        AND rr.osha_employee_count IS NOT NULL
        AND rr.osha_employee_count > 0
        AND rr.facility_id IS NOT NULL
      ORDER BY rr.facility_id, rr.osha_inspection_date DESC NULLS LAST
    ) sub
    WHERE facilities.id = sub.facility_id
      AND (facilities.employee_count IS NULL OR facilities.employee_count = 0)
  `);

  result.employeeCountsAdded = Number((updated as any)?.rowCount || 0);
  console.log(`[Enrichment] Employee counts propagated: ${result.employeeCountsAdded}`);
}

/**
 * Stage 3: Assign sector labels based on NAICS codes.
 */
async function assignSectors(result: EnrichmentResult): Promise<void> {
  // Update companies with sector labels based on their facilities' NAICS codes
  const sectorMap: Record<string, string> = {
    '311': 'Food Manufacturing',
    '312': 'Beverage & Tobacco',
    '313': 'Textile Mills',
    '314': 'Textile Products',
    '315': 'Apparel',
    '316': 'Leather & Allied',
    '321': 'Wood Products',
    '322': 'Paper Manufacturing',
    '323': 'Printing',
    '324': 'Petroleum & Coal',
    '325': 'Chemical Manufacturing',
    '326': 'Plastics & Rubber',
    '327': 'Nonmetallic Minerals',
    '331': 'Primary Metals',
    '332': 'Fabricated Metals',
    '333': 'Machinery',
    '334': 'Computer & Electronics',
    '335': 'Electrical Equipment',
    '336': 'Transportation Equipment',
    '337': 'Furniture',
    '339': 'Miscellaneous Manufacturing',
  };

  // Assign sectors based on the most common 3-digit NAICS prefix per company
  const updated = await db.execute(sql`
    UPDATE companies SET
      sector = sub.sector,
      naics_codes = sub.naics_list,
      updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (company_id)
        company_id,
        CASE
          ${sql.join(Object.entries(sectorMap).map(([prefix, label]) =>
            sql`WHEN naics_prefix = ${prefix} THEN ${label}`
          ), sql` `)}
          ELSE 'Manufacturing'
        END as sector,
        naics_list
      FROM (
        SELECT
          company_id,
          LEFT(primary_naics, 3) as naics_prefix,
          count(*) as cnt,
          json_agg(DISTINCT primary_naics)::text as naics_list
        FROM facilities
        WHERE company_id IS NOT NULL AND primary_naics IS NOT NULL
        GROUP BY company_id, LEFT(primary_naics, 3)
        ORDER BY company_id, count(*) DESC
      ) ranked
    ) sub
    WHERE companies.id = sub.company_id
      AND (companies.sector IS NULL OR companies.sector = '')
  `);

  result.sectorsAssigned = Number((updated as any)?.rowCount || 0);
  console.log(`[Enrichment] Sectors assigned: ${result.sectorsAssigned}`);
}

/**
 * Stage 4: Recalculate confidence scores based on current data quality.
 */
async function recalculateConfidence(result: EnrichmentResult): Promise<void> {
  const updated = await db.execute(sql`
    UPDATE facilities SET
      confidence = LEAST(100, (
        30 +
        CASE WHEN source_count >= 3 THEN 30
             WHEN source_count >= 2 THEN 20
             ELSE 0 END +
        CASE WHEN latitude IS NOT NULL AND latitude != '' THEN 20 ELSE 0 END +
        CASE WHEN company_id IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN employee_count IS NOT NULL AND employee_count > 0 THEN 10 ELSE 0 END
      )),
      updated_at = NOW()
    WHERE confidence != LEAST(100, (
      30 +
      CASE WHEN source_count >= 3 THEN 30
           WHEN source_count >= 2 THEN 20
           ELSE 0 END +
      CASE WHEN latitude IS NOT NULL AND latitude != '' THEN 20 ELSE 0 END +
      CASE WHEN company_id IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN employee_count IS NOT NULL AND employee_count > 0 THEN 10 ELSE 0 END
    ))
  `);

  result.confidenceRecalculated = Number((updated as any)?.rowCount || 0);
  console.log(`[Enrichment] Confidence recalculated: ${result.confidenceRecalculated}`);
}

/**
 * Update company facility counts to match actual linked facilities.
 */
async function updateCompanyFacilityCounts(): Promise<void> {
  await db.execute(sql`
    UPDATE companies SET
      facility_count = COALESCE(sub.cnt, 0),
      updated_at = NOW()
    FROM (
      SELECT company_id, count(*) as cnt
      FROM facilities
      WHERE company_id IS NOT NULL
      GROUP BY company_id
    ) sub
    WHERE companies.id = sub.company_id
      AND companies.facility_count != COALESCE(sub.cnt, 0)
  `);
  console.log('[Enrichment] Company facility counts updated');
}
