/**
 * Company Enrichment Script
 *
 * Retroactively extracts company names from facility names and links them
 * to the companies table. Handles 177K+ facilities that were merged without
 * company association.
 *
 * Run: npx tsx server/scripts/enrich-companies.ts
 */

import { db } from '../db/index.js';
import { companies } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { resolveCompanyName, cleanCompanyName } from '../pipeline/normalize/nameNormalizer.js';
import { COMPANY_RULES, normalizeCompanyName } from '../../shared/companyNormalization.js';

const BATCH_SIZE = 2000;
const INSERT_BATCH = 500;

/**
 * Enhanced company extraction that tries harder than the standard resolver.
 * Patterns:
 * 1. Match against COMPANY_RULES (known companies)
 * 2. Extract from "COMPANY NAME - FACILITY DESCRIPTION" pattern
 * 3. Extract from "COMPANY NAME CITY_NAME" by checking known suffixes
 * 4. Use cleaned facility name if it looks like a company name
 */
function extractCompanyAggressive(facilityName: string | null, parentCompany: string | null): string | null {
  // First try the standard resolver
  const standard = resolveCompanyName(parentCompany, facilityName);
  if (standard) return standard;

  if (!facilityName) return null;
  const upper = facilityName.toUpperCase().trim();

  // Match against all COMPANY_RULES patterns
  for (const rule of COMPANY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(upper)) return rule.canonical;
    }
  }

  // Common facility name patterns where company is embedded:
  // "COMPANY INC PLANT NAME"
  // "COMPANY LLC FACILITY NAME"
  // "COMPANY CO DIVISION NAME"
  const corpSuffixes = /\b(INC\.?|INCORPORATED|LLC|L\.?L\.?C\.?|LTD\.?|LIMITED|CORP\.?|CORPORATION|CO\.?|COMPANY|L\.?P\.?)\b/i;
  const suffixMatch = upper.match(corpSuffixes);
  if (suffixMatch && suffixMatch.index !== undefined) {
    const companyPart = facilityName.substring(0, suffixMatch.index + suffixMatch[0].length).trim();
    if (companyPart.length >= 3) {
      const normalized = normalizeCompanyName(companyPart);
      if (normalized) return normalized;
    }
  }

  // Try separator-based extraction
  const separators = [' - ', ' – ', ' — ', ' / ', ', ', ' @ '];
  for (const sep of separators) {
    const idx = facilityName.indexOf(sep);
    if (idx > 2) {
      const potentialCompany = facilityName.substring(0, idx).trim();
      if (potentialCompany.length >= 3) {
        const cleaned = cleanCompanyName(potentialCompany);
        if (cleaned) return cleaned;
      }
    }
  }

  // Try parenthetical pattern: "FACILITY NAME (COMPANY)"
  const parenMatch = facilityName.match(/\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch[1].length >= 3) {
    const inner = parenMatch[1].trim();
    const normalized = normalizeCompanyName(inner);
    if (normalized) return normalized;
  }

  return null;
}

async function main() {
  console.log('\n=== Company Enrichment ===\n');

  const [before] = await db.execute(sql`
    SELECT count(*)::int as total FROM facilities WHERE company_id IS NULL
  `);
  console.log(`Facilities without company: ${before.total}`);

  const companyIdCache = new Map<string, string>();
  let totalProcessed = 0;
  let totalLinked = 0;
  let totalCompaniesCreated = 0;

  // Pre-load existing companies into cache
  console.log('Loading existing companies...');
  const existingCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies);
  for (const co of existingCompanies) {
    companyIdCache.set(co.name, co.id);
  }
  console.log(`  Cached ${companyIdCache.size} companies\n`);

  let cursor: string | null = null;

  while (true) {
    // Get batch of facilities without companies (cursor-based to avoid skipping)
    const batch: Record<string, unknown>[] = cursor
      ? await db.execute(sql`
          SELECT id, name, company_name, parent_company_from_tri
          FROM facilities
          WHERE company_id IS NULL AND id > ${cursor}::uuid
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `)
      : await db.execute(sql`
          SELECT id, name, company_name, parent_company_from_tri
          FROM facilities
          WHERE company_id IS NULL
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `);

    if (batch.length === 0) break;

    const updates: { id: string; companyName: string; companyId: string }[] = [];
    const newCompanyNames = new Set<string>();

    // Extract company names
    for (const fac of batch) {
      const companyName = extractCompanyAggressive(
        String(fac.name || ''),
        fac.parent_company_from_tri ? String(fac.parent_company_from_tri) : null,
      );

      if (companyName && companyName.length >= 2) {
        if (companyIdCache.has(companyName)) {
          updates.push({
            id: String(fac.id),
            companyName,
            companyId: companyIdCache.get(companyName)!,
          });
        } else {
          newCompanyNames.add(companyName);
        }
      }
    }

    // Create new companies
    const newNames = Array.from(newCompanyNames);
    if (newNames.length > 0) {
      for (let i = 0; i < newNames.length; i += INSERT_BATCH) {
        const nameBatch = newNames.slice(i, i + INSERT_BATCH);
        const inserted = await db.insert(companies)
          .values(nameBatch.map(name => ({ name, facilityCount: 0 })))
          .onConflictDoNothing()
          .returning({ id: companies.id, name: companies.name });
        for (const co of inserted) {
          companyIdCache.set(co.name, co.id);
          totalCompaniesCreated++;
        }

        // Re-fetch any that already existed (conflict)
        const missing = nameBatch.filter(n => !companyIdCache.has(n));
        if (missing.length > 0) {
          const refetched = await db.select({ id: companies.id, name: companies.name })
            .from(companies)
            .where(sql`${companies.name} IN (${sql.join(missing.map(n => sql`${n}`), sql`, `)})`);
          for (const co of refetched) companyIdCache.set(co.name, co.id);
        }
      }

      // Now add updates for the new companies
      for (const fac of batch) {
        const companyName = extractCompanyAggressive(
          String(fac.name || ''),
          fac.parent_company_from_tri ? String(fac.parent_company_from_tri) : null,
        );
        if (companyName && companyIdCache.has(companyName) && !updates.find(u => u.id === String(fac.id))) {
          updates.push({
            id: String(fac.id),
            companyName,
            companyId: companyIdCache.get(companyName)!,
          });
        }
      }
    }

    // Batch update facilities
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += INSERT_BATCH) {
        const updateBatch = updates.slice(i, i + INSERT_BATCH);
        const triples = updateBatch.map(u => sql`(${u.id}::uuid, ${u.companyId}::uuid, ${u.companyName}::text)`);
        await db.execute(sql`
          UPDATE facilities SET
            company_id = u.cid,
            company_name = u.cname,
            updated_at = NOW()
          FROM (VALUES ${sql.join(triples, sql`, `)}) AS u(fid, cid, cname)
          WHERE facilities.id = u.fid
        `);
      }
      totalLinked += updates.length;
    }

    // Update cursor to last ID in batch
    cursor = String(batch[batch.length - 1].id);
    totalProcessed += batch.length;
    if (totalProcessed % 10000 === 0 || batch.length < BATCH_SIZE) {
      console.log(`  Processed ${totalProcessed.toLocaleString()} | Linked ${totalLinked.toLocaleString()} | New companies: ${totalCompaniesCreated}`);
    }

    if (batch.length < BATCH_SIZE) break;
  }

  // Update company facility counts
  console.log('\nUpdating company facility counts...');
  await db.execute(sql`
    UPDATE companies SET
      facility_count = COALESCE(sub.cnt, 0),
      status = CASE WHEN COALESCE(sub.cnt, 0) > 0 THEN 'verified'::company_status ELSE status END,
      updated_at = NOW()
    FROM (
      SELECT company_id, count(*)::int as cnt
      FROM facilities
      WHERE company_id IS NOT NULL
      GROUP BY company_id
    ) sub
    WHERE companies.id = sub.company_id
  `);

  const [after] = await db.execute(sql`
    SELECT count(*)::int as total FROM facilities WHERE company_id IS NULL
  `);
  const [finalCompanies] = await db.execute(sql`
    SELECT count(*)::int as total FROM companies
  `);

  console.log(`\n=== Enrichment Complete ===`);
  console.log(`  Facilities linked to companies: ${totalLinked.toLocaleString()}`);
  console.log(`  New companies created: ${totalCompaniesCreated.toLocaleString()}`);
  console.log(`  Remaining without company: ${after.total}`);
  console.log(`  Total companies: ${finalCompanies.total}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Enrichment failed:', err);
  process.exit(1);
});
