/**
 * Merger
 *
 * Creates golden records (facilities) from matched raw records.
 * Uses field priority rules to select the best value from each source.
 */

import { db } from '../../db/index.js';
import { rawRecords, facilities, companies, facilitySources, matchCandidates } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { selectBestValue } from './fieldPriority.js';
import { resolveCompanyName, normalizeFacilityName } from '../normalize/nameNormalizer.js';
import { describeNaics } from '../normalize/naicsLookup.js';
import type { DataSource } from '@shared/types.js';

export interface MergeResult {
  facilitiesCreated: number;
  facilitiesUpdated: number;
  companiesCreated: number;
}

/**
 * Process all auto-matched pairs into golden records.
 */
export async function runMerge(): Promise<MergeResult> {
  const result: MergeResult = { facilitiesCreated: 0, facilitiesUpdated: 0, companiesCreated: 0 };

  // Get auto-matched pairs that haven't been merged yet (raw records without facilityId)
  const autoMatches = await db.select().from(matchCandidates)
    .where(eq(matchCandidates.status, 'auto_matched'));

  if (autoMatches.length === 0) {
    // Also handle unmatched records (single-source records)
    await mergeUnmatchedRecords(result);
    return result;
  }

  // Group matched records into clusters
  const clusters = buildMatchClusters(autoMatches);
  console.log(`[Merger] Processing ${clusters.length} match clusters`);

  // Batch process clusters for performance (instead of 1-at-a-time)
  const CLUSTER_BATCH = 200;
  const INSERT_BATCH = 500;
  const companyIdCache = new Map<string, string>();
  let clustersProcessed = 0;

  for (let cb = 0; cb < clusters.length; cb += CLUSTER_BATCH) {
    const clusterBatch = clusters.slice(cb, cb + CLUSTER_BATCH);

    // Step A: Fetch all raw records for this batch of clusters in ONE query
    const allIdsInBatch = clusterBatch.flat();
    const allRecords = new Map<string, typeof rawRecords.$inferSelect>();

    for (let i = 0; i < allIdsInBatch.length; i += 1000) {
      const idSlice = allIdsInBatch.slice(i, i + 1000);
      const rows = await db.select().from(rawRecords)
        .where(sql`${rawRecords.id} IN (${sql.join(idSlice.map(id => sql`${id}`), sql`, `)})`);
      for (const r of rows) allRecords.set(r.id, r);
    }

    // Step B: Resolve all fields and company names in memory
    const facilityValues: (typeof facilities.$inferInsert)[] = [];
    const clusterRecordMap: { records: (typeof rawRecords.$inferSelect)[]; clusterIdx: number }[] = [];
    const uniqueCompanyNames = new Set<string>();

    for (let ci = 0; ci < clusterBatch.length; ci++) {
      const cluster = clusterBatch[ci];
      const records = cluster.map(id => allRecords.get(id)).filter(Boolean) as (typeof rawRecords.$inferSelect)[];
      if (records.length === 0) continue;

      const candidates = records.map(r => ({ source: r.source as DataSource, record: r }));

      const bestName = selectBestValue('name', candidates.map(c => ({ source: c.source, value: c.record.rawName })));
      const bestAddress = selectBestValue('address', candidates.map(c => ({ source: c.source, value: c.record.rawAddress })));
      const bestCity = selectBestValue('city', candidates.map(c => ({ source: c.source, value: c.record.rawCity })));
      const bestState = selectBestValue('state', candidates.map(c => ({ source: c.source, value: c.record.rawState })));
      const bestZip = selectBestValue('zip', candidates.map(c => ({ source: c.source, value: c.record.rawZip })));
      const bestCounty = selectBestValue('county', candidates.map(c => ({ source: c.source, value: c.record.rawCounty })));
      const bestLat = selectBestValue('latitude', candidates.map(c => ({ source: c.source, value: c.record.rawLatitude })));
      const bestLng = selectBestValue('longitude', candidates.map(c => ({ source: c.source, value: c.record.rawLongitude })));
      const bestNaics = selectBestValue('naicsCode', candidates.map(c => ({ source: c.source, value: c.record.rawNaicsCode })));

      const triRecord = records.find(r => r.source === 'epa_tri');
      const companyName = resolveCompanyName(triRecord?.triParentCompanyName || null, bestName.value);
      if (companyName) uniqueCompanyNames.add(companyName);

      const sources = [...new Set(records.map(r => r.source))];
      const registryId = records.find(r => r.registryId)?.registryId || null;

      facilityValues.push({
        name: normalizeFacilityName(bestName.value) || 'Unknown Facility',
        companyId: null, // filled after company resolution
        companyName,
        address: bestAddress.value,
        city: bestCity.value,
        state: bestState.value,
        zip: bestZip.value,
        county: bestCounty.value,
        latitude: bestLat.value,
        longitude: bestLng.value,
        primaryNaics: bestNaics.value,
        primaryNaicsDescription: describeNaics(bestNaics.value),
        epaRegistryId: registryId,
        parentCompanyFromTri: triRecord?.triParentCompanyName || null,
        sourceCount: sources.length,
        sources: JSON.stringify(sources),
        confidence: computeConfidence(records.length, sources.length, !!bestLat.value),
      });
      clusterRecordMap.push({ records, clusterIdx: facilityValues.length - 1 });
    }

    // Step C: Batch resolve companies
    const uncachedNames = Array.from(uniqueCompanyNames).filter(n => !companyIdCache.has(n));
    if (uncachedNames.length > 0) {
      for (let i = 0; i < uncachedNames.length; i += INSERT_BATCH) {
        const batch = uncachedNames.slice(i, i + INSERT_BATCH);
        const existing = await db.select({ id: companies.id, name: companies.name })
          .from(companies).where(sql`${companies.name} IN (${sql.join(batch.map(n => sql`${n}`), sql`, `)})`);
        for (const co of existing) companyIdCache.set(co.name, co.id);
      }
      const newNames = uncachedNames.filter(n => !companyIdCache.has(n));
      if (newNames.length > 0) {
        for (let i = 0; i < newNames.length; i += INSERT_BATCH) {
          const batch = newNames.slice(i, i + INSERT_BATCH);
          const inserted = await db.insert(companies).values(batch.map(name => ({ name, facilityCount: 0 })))
            .onConflictDoNothing().returning({ id: companies.id, name: companies.name });
          for (const co of inserted) { companyIdCache.set(co.name, co.id); result.companiesCreated++; }
        }
        const stillMissing = newNames.filter(n => !companyIdCache.has(n));
        if (stillMissing.length > 0) {
          const refetched = await db.select({ id: companies.id, name: companies.name }).from(companies)
            .where(sql`${companies.name} IN (${sql.join(stillMissing.map(n => sql`${n}`), sql`, `)})`);
          for (const co of refetched) companyIdCache.set(co.name, co.id);
        }
      }
    }

    // Step D: Set company IDs on facility values
    for (const fv of facilityValues) {
      if (fv.companyName) fv.companyId = companyIdCache.get(fv.companyName) || null;
    }

    // Step E: Batch insert facilities
    const allInsertedIds: { id: string }[] = [];
    for (let i = 0; i < facilityValues.length; i += INSERT_BATCH) {
      const batch = facilityValues.slice(i, i + INSERT_BATCH);
      const inserted = await db.insert(facilities).values(batch).returning({ id: facilities.id });
      allInsertedIds.push(...inserted);
    }
    result.facilitiesCreated += allInsertedIds.length;

    // Step F: Batch insert facility_sources
    const allSourceLinks: (typeof facilitySources.$inferInsert)[] = [];
    for (const { records, clusterIdx } of clusterRecordMap) {
      const facilityId = allInsertedIds[clusterIdx]?.id;
      if (!facilityId) continue;
      for (const r of records) {
        allSourceLinks.push({
          facilityId,
          rawRecordId: r.id,
          source: r.source as DataSource,
          sourceRecordId: r.sourceRecordId,
          fieldsProvided: JSON.stringify(getFieldsProvided(r)),
        });
      }
    }
    for (let i = 0; i < allSourceLinks.length; i += INSERT_BATCH) {
      await db.insert(facilitySources).values(allSourceLinks.slice(i, i + INSERT_BATCH));
    }

    // Step G: Batch update raw_records with facility IDs
    const updatePairs: { rid: string; fid: string }[] = [];
    for (const { records, clusterIdx } of clusterRecordMap) {
      const facilityId = allInsertedIds[clusterIdx]?.id;
      if (!facilityId) continue;
      for (const r of records) updatePairs.push({ rid: r.id, fid: facilityId });
    }
    for (let i = 0; i < updatePairs.length; i += INSERT_BATCH) {
      const batch = updatePairs.slice(i, i + INSERT_BATCH);
      const pairs = batch.map(p => sql`(${p.rid}::uuid, ${p.fid}::uuid)`);
      await db.execute(sql`UPDATE raw_records SET facility_id = u.fid FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(rid, fid) WHERE raw_records.id = u.rid`);
    }

    clustersProcessed += clusterBatch.length;
    console.log(`[Merger] Cluster batch: ${clustersProcessed}/${clusters.length} clusters → ${result.facilitiesCreated} facilities`);

    // Reset batch accumulators
    facilityValues.length = 0;
    clusterRecordMap.length = 0;
  }

  // Also process unmatched single-source records
  await mergeUnmatchedRecords(result);

  console.log(`[Merger] Complete: ${result.facilitiesCreated} created, ${result.companiesCreated} companies`);
  return result;
}

/**
 * Merge records that didn't match anything (single-source facilities).
 * Optimized for scale: batch inserts instead of one-at-a-time.
 */
async function mergeUnmatchedRecords(result: MergeResult): Promise<void> {
  const QUERY_BATCH = 2000;  // Records per DB query
  const INSERT_BATCH = 500;  // Records per INSERT statement
  let totalProcessed = 0;

  // Cache company lookups across batches
  const companyIdCache = new Map<string, string>();

  while (true) {
    const unmerged = await db.select().from(rawRecords)
      .where(sql`${rawRecords.facilityId} IS NULL AND ${rawRecords.matchedAt} IS NOT NULL`)
      .limit(QUERY_BATCH);

    if (unmerged.length === 0) break;

    // Step 1: Resolve company names for all records in batch
    const recordCompanyNames = new Map<string, string | null>();
    const uniqueCompanyNames = new Set<string>();

    for (const record of unmerged) {
      const companyName = resolveCompanyName(record.triParentCompanyName || null, record.rawName);
      recordCompanyNames.set(record.id, companyName);
      if (companyName) uniqueCompanyNames.add(companyName);
    }

    // Step 2: Batch find/create companies
    const uncachedNames = Array.from(uniqueCompanyNames).filter(n => !companyIdCache.has(n));

    if (uncachedNames.length > 0) {
      // Find existing
      for (let i = 0; i < uncachedNames.length; i += INSERT_BATCH) {
        const batch = uncachedNames.slice(i, i + INSERT_BATCH);
        const existing = await db.select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(sql`${companies.name} IN (${sql.join(batch.map(n => sql`${n}`), sql`, `)})`);
        for (const co of existing) companyIdCache.set(co.name, co.id);
      }

      // Insert new ones
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

        // Re-fetch any that conflicted (race condition with onConflictDoNothing)
        const stillMissing = newNames.filter(n => !companyIdCache.has(n));
        if (stillMissing.length > 0) {
          const refetched = await db.select({ id: companies.id, name: companies.name })
            .from(companies)
            .where(sql`${companies.name} IN (${sql.join(stillMissing.map(n => sql`${n}`), sql`, `)})`);
          for (const co of refetched) companyIdCache.set(co.name, co.id);
        }
      }
    }

    // Step 3: Batch insert facilities
    const facilityValues = unmerged.map(record => {
      const companyName = recordCompanyNames.get(record.id) || null;
      const companyId = companyName ? companyIdCache.get(companyName) || null : null;
      return {
        name: normalizeFacilityName(record.rawName) || 'Unknown Facility',
        companyId,
        companyName,
        address: record.rawAddress,
        city: record.rawCity,
        state: record.rawState,
        zip: record.rawZip,
        county: record.rawCounty,
        latitude: record.rawLatitude,
        longitude: record.rawLongitude,
        primaryNaics: record.rawNaicsCode,
        primaryNaicsDescription: describeNaics(record.rawNaicsCode),
        epaRegistryId: record.registryId,
        parentCompanyFromTri: record.triParentCompanyName,
        sourceCount: 1,
        sources: JSON.stringify([record.source]),
        confidence: computeConfidence(1, 1, !!record.rawLatitude),
      };
    });

    const allInsertedIds: { id: string }[] = [];
    for (let i = 0; i < facilityValues.length; i += INSERT_BATCH) {
      const batch = facilityValues.slice(i, i + INSERT_BATCH);
      const inserted = await db.insert(facilities).values(batch).returning({ id: facilities.id });
      allInsertedIds.push(...inserted);
    }
    result.facilitiesCreated += allInsertedIds.length;

    // Step 4: Batch insert facility_sources
    const sourceValues = unmerged.map((record, i) => ({
      facilityId: allInsertedIds[i].id,
      rawRecordId: record.id,
      source: record.source as DataSource,
      sourceRecordId: record.sourceRecordId,
      fieldsProvided: JSON.stringify(getFieldsProvided(record)),
    }));

    for (let i = 0; i < sourceValues.length; i += INSERT_BATCH) {
      await db.insert(facilitySources).values(sourceValues.slice(i, i + INSERT_BATCH));
    }

    // Step 5: Batch update raw_records with facility IDs (bulk UPDATE with VALUES)
    for (let i = 0; i < unmerged.length; i += INSERT_BATCH) {
      const batchRecords = unmerged.slice(i, i + INSERT_BATCH);
      const batchFacilityIds = allInsertedIds.slice(i, i + INSERT_BATCH);
      const pairs = batchRecords.map((r, j) => sql`(${r.id}::uuid, ${batchFacilityIds[j].id}::uuid)`);
      await db.execute(sql`
        UPDATE raw_records SET facility_id = u.fid
        FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(rid, fid)
        WHERE raw_records.id = u.rid
      `);
    }

    totalProcessed += unmerged.length;
    console.log(`[Merger] Batch processed ${totalProcessed} unmatched records`);
  }

  // Update company facility counts and auto-verify companies with factory ties
  if (companyIdCache.size > 0) {
    await db.execute(sql`
      UPDATE companies SET
        facility_count = sub.cnt,
        status = CASE WHEN sub.cnt > 0 THEN 'verified'::company_status ELSE status END
      FROM (SELECT company_id, count(*) as cnt FROM facilities WHERE company_id IS NOT NULL GROUP BY company_id) sub
      WHERE companies.id = sub.company_id
    `);
  }
}

/**
 * Build clusters of matched record IDs from pairwise match candidates.
 * Uses union-find to group transitive matches.
 */
function buildMatchClusters(matches: { recordAId: string; recordBId: string }[]): string[][] {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  for (const match of matches) {
    union(match.recordAId, match.recordBId);
  }

  const clusters = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(id);
  }

  return Array.from(clusters.values()).filter(c => c.length >= 2);
}

/**
 * Compute confidence score based on data quality signals.
 */
function computeConfidence(recordCount: number, sourceCount: number, hasCoordinates: boolean): number {
  let confidence = 30; // Base

  // Multi-source confirmation
  if (sourceCount >= 3) confidence += 30;
  else if (sourceCount >= 2) confidence += 20;

  // Has coordinates
  if (hasCoordinates) confidence += 20;

  // Multiple records
  if (recordCount >= 3) confidence += 20;
  else if (recordCount >= 2) confidence += 10;

  return Math.min(confidence, 100);
}

/**
 * Determine which fields a raw record provided.
 */
function getFieldsProvided(record: typeof rawRecords.$inferSelect): string[] {
  const fields: string[] = [];
  if (record.rawName) fields.push('name');
  if (record.rawAddress) fields.push('address');
  if (record.rawCity) fields.push('city');
  if (record.rawState) fields.push('state');
  if (record.rawZip) fields.push('zip');
  if (record.rawLatitude) fields.push('latitude');
  if (record.rawLongitude) fields.push('longitude');
  if (record.rawNaicsCode) fields.push('naics');
  if (record.triParentCompanyName) fields.push('company');
  if (record.oshaEmployeeCount) fields.push('employees');
  if (record.faaApprovalType) fields.push('faaApprovalType');
  if (record.nhtsaMfrId) fields.push('nhtsaMfrId');
  return fields;
}
