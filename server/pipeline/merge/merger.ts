/**
 * Merger
 *
 * Creates golden records (facilities) from matched raw records.
 * Uses field priority rules to select the best value from each source.
 *
 * IDEMPOTENT: Checks for existing facilities before inserting.
 * Uses epa_registry_id as primary dedup key, falls back to (name, city, state).
 * Match candidates are tagged with facility_id after merge so they're not re-processed.
 */

import { db } from '../../db/index.js';
import { rawRecords, facilities, companies, facilitySources, matchCandidates } from '../../db/schema.js';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { selectBestValue } from './fieldPriority.js';
import { resolveCompanyName, normalizeFacilityName } from '../normalize/nameNormalizer.js';
import { describeNaics } from '../normalize/naicsLookup.js';
import type { DataSource } from '../../../shared/types.js';

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

  // Get auto-matched pairs that haven't been merged yet
  // KEY FIX: Only process candidates that don't have a facility_id assigned yet
  const autoMatches = await db.select().from(matchCandidates)
    .where(and(
      eq(matchCandidates.status, 'auto_matched'),
      isNull(matchCandidates.facilityId),
    ));

  if (autoMatches.length === 0) {
    // Also handle unmatched records (single-source records)
    await mergeUnmatchedRecords(result);
    return result;
  }

  // Group matched records into clusters
  const clusters = buildMatchClusters(autoMatches);
  console.log(`[Merger] Processing ${clusters.length} match clusters (${autoMatches.length} unmerged candidates)`);

  // Build a mapping of match candidate IDs per cluster for later tagging
  const clusterMatchCandidateIds: string[][] = [];
  const recordToCluster = new Map<string, number>();
  for (let i = 0; i < clusters.length; i++) {
    for (const rid of clusters[i]) {
      recordToCluster.set(rid, i);
    }
    clusterMatchCandidateIds.push([]);
  }
  for (const mc of autoMatches) {
    const clusterIdx = recordToCluster.get(mc.recordAId) ?? recordToCluster.get(mc.recordBId);
    if (clusterIdx !== undefined) {
      clusterMatchCandidateIds[clusterIdx].push(mc.id);
    }
  }

  // Batch process clusters for performance
  const CLUSTER_BATCH = 200;
  const INSERT_BATCH = 500;
  const companyIdCache = new Map<string, string>();
  let clustersProcessed = 0;

  for (let cb = 0; cb < clusters.length; cb += CLUSTER_BATCH) {
    const clusterBatch = clusters.slice(cb, cb + CLUSTER_BATCH);
    const mcIdBatch = clusterMatchCandidateIds.slice(cb, cb + CLUSTER_BATCH);

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
    type FacilityCandidate = {
      values: typeof facilities.$inferInsert;
      records: (typeof rawRecords.$inferSelect)[];
      mcIds: string[];
      registryId: string | null;
    };
    const candidates: FacilityCandidate[] = [];
    const uniqueCompanyNames = new Set<string>();

    for (let ci = 0; ci < clusterBatch.length; ci++) {
      const cluster = clusterBatch[ci];
      const records = cluster.map(id => allRecords.get(id)).filter(Boolean) as (typeof rawRecords.$inferSelect)[];
      if (records.length === 0) continue;

      const sourceCandidates = records.map(r => ({ source: r.source as DataSource, record: r }));

      const bestName = selectBestValue('name', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawName })));
      const bestAddress = selectBestValue('address', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawAddress })));
      const bestCity = selectBestValue('city', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawCity })));
      const bestState = selectBestValue('state', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawState })));
      const bestZip = selectBestValue('zip', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawZip })));
      const bestCounty = selectBestValue('county', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawCounty })));
      const bestLat = selectBestValue('latitude', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawLatitude })));
      const bestLng = selectBestValue('longitude', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawLongitude })));
      const bestNaics = selectBestValue('naicsCode', sourceCandidates.map(c => ({ source: c.source, value: c.record.rawNaicsCode })));

      const triRecord = records.find(r => r.source === 'epa_tri');
      const companyName = resolveCompanyName(triRecord?.triParentCompanyName || null, bestName.value);
      if (companyName) uniqueCompanyNames.add(companyName);

      const sources = [...new Set(records.map(r => r.source))];
      const registryId = records.find(r => r.registryId)?.registryId || null;

      candidates.push({
        values: {
          name: normalizeFacilityName(bestName.value) || 'Unknown Facility',
          companyId: null,
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
        },
        records,
        mcIds: mcIdBatch[ci] || [],
        registryId,
      });
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
    for (const c of candidates) {
      if (c.values.companyName) c.values.companyId = companyIdCache.get(c.values.companyName) || null;
    }

    // Step E: CHECK FOR EXISTING FACILITIES (IDEMPOTENCY)
    // Look up existing facilities by epa_registry_id or (name, city, state)
    const existingByRegistry = new Map<string, string>();
    const existingByNameCityState = new Map<string, string>();

    // Batch lookup by registry ID
    const registryIds = candidates.map(c => c.registryId).filter(Boolean) as string[];
    if (registryIds.length > 0) {
      for (let i = 0; i < registryIds.length; i += 500) {
        const batch = registryIds.slice(i, i + 500);
        const rows = await db.execute(sql`
          SELECT id, epa_registry_id FROM facilities
          WHERE epa_registry_id IN (${sql.join(batch.map(r => sql`${r}`), sql`, `)})
        `);
        for (const r of rows) {
          existingByRegistry.set(String(r.epa_registry_id), String(r.id));
        }
      }
    }

    // Batch lookup by (name, city, state) for those without registry ID
    const nameLookups = candidates
      .filter(c => !c.registryId || !existingByRegistry.has(c.registryId))
      .map(c => ({
        name: c.values.name as string,
        city: (c.values.city || '') as string,
        state: (c.values.state || '') as string,
      }));
    if (nameLookups.length > 0) {
      for (let i = 0; i < nameLookups.length; i += 200) {
        const batch = nameLookups.slice(i, i + 200);
        const conditions = batch.map(n =>
          sql`(name = ${n.name} AND coalesce(city,'') = ${n.city} AND coalesce(state,'') = ${n.state})`
        );
        const rows = await db.execute(sql`
          SELECT id, name, coalesce(city,'') as city, coalesce(state,'') as state FROM facilities
          WHERE ${sql.join(conditions, sql` OR `)}
          ORDER BY source_count DESC, confidence DESC
        `);
        for (const r of rows) {
          const key = `${r.name}|${r.city}|${r.state}`;
          if (!existingByNameCityState.has(key)) {
            existingByNameCityState.set(key, String(r.id));
          }
        }
      }
    }

    // Step F: Insert NEW facilities or update EXISTING ones
    const facilityIdMap: { candidateIdx: number; facilityId: string; isNew: boolean }[] = [];
    const toInsert: { idx: number; values: typeof facilities.$inferInsert }[] = [];

    for (let ci = 0; ci < candidates.length; ci++) {
      const c = candidates[ci];

      // Check if already exists
      let existingId: string | undefined;
      if (c.registryId) {
        existingId = existingByRegistry.get(c.registryId);
      }
      if (!existingId) {
        const key = `${c.values.name}|${c.values.city || ''}|${c.values.state || ''}`;
        existingId = existingByNameCityState.get(key);
      }

      if (existingId) {
        // Update existing facility with merged data
        facilityIdMap.push({ candidateIdx: ci, facilityId: existingId, isNew: false });
        result.facilitiesUpdated++;
      } else {
        toInsert.push({ idx: ci, values: c.values });
      }
    }

    // Batch insert new facilities
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
        const batch = toInsert.slice(i, i + INSERT_BATCH);
        const inserted = await db.insert(facilities).values(batch.map(b => b.values)).returning({ id: facilities.id });
        for (let j = 0; j < inserted.length; j++) {
          facilityIdMap.push({ candidateIdx: batch[j].idx, facilityId: inserted[j].id, isNew: true });
        }
      }
      result.facilitiesCreated += toInsert.length;
    }

    // Update existing facilities' source info
    for (const { candidateIdx, facilityId, isNew } of facilityIdMap) {
      if (isNew) continue;
      const c = candidates[candidateIdx];
      const sources = [...new Set(c.records.map(r => r.source))];
      await db.execute(sql`
        UPDATE facilities SET
          source_count = GREATEST(source_count, ${sources.length}),
          confidence = GREATEST(confidence, ${c.values.confidence}),
          updated_at = NOW()
        WHERE id = ${facilityId}::uuid
      `);
    }

    // Step G: Batch insert facility_sources (with ON CONFLICT DO NOTHING)
    const allSourceLinks: (typeof facilitySources.$inferInsert)[] = [];
    for (const { candidateIdx, facilityId } of facilityIdMap) {
      const c = candidates[candidateIdx];
      for (const r of c.records) {
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
      await db.insert(facilitySources).values(allSourceLinks.slice(i, i + INSERT_BATCH))
        .onConflictDoNothing();
    }

    // Step H: Batch update raw_records with facility IDs
    const updatePairs: { rid: string; fid: string }[] = [];
    for (const { candidateIdx, facilityId } of facilityIdMap) {
      const c = candidates[candidateIdx];
      for (const r of c.records) updatePairs.push({ rid: r.id, fid: facilityId });
    }
    for (let i = 0; i < updatePairs.length; i += INSERT_BATCH) {
      const batch = updatePairs.slice(i, i + INSERT_BATCH);
      const pairs = batch.map(p => sql`(${p.rid}::uuid, ${p.fid}::uuid)`);
      await db.execute(sql`UPDATE raw_records SET facility_id = u.fid FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(rid, fid) WHERE raw_records.id = u.rid`);
    }

    // Step I: TAG match candidates with facility_id so they're not re-processed
    const allMcIds = candidates.flatMap((c, i) => {
      const entry = facilityIdMap.find(e => e.candidateIdx === i);
      if (!entry) return [];
      return c.mcIds.map(mcId => ({ mcId, fid: entry.facilityId }));
    });
    for (let i = 0; i < allMcIds.length; i += INSERT_BATCH) {
      const batch = allMcIds.slice(i, i + INSERT_BATCH);
      const pairs = batch.map(p => sql`(${p.mcId}::uuid, ${p.fid}::uuid)`);
      await db.execute(sql`
        UPDATE match_candidates SET facility_id = u.fid
        FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(mcid, fid)
        WHERE match_candidates.id = u.mcid
      `);
    }

    clustersProcessed += clusterBatch.length;
    console.log(`[Merger] Cluster batch: ${clustersProcessed}/${clusters.length} → ${result.facilitiesCreated} new, ${result.facilitiesUpdated} updated`);
  }

  // Also process unmatched single-source records
  await mergeUnmatchedRecords(result);

  console.log(`[Merger] Complete: ${result.facilitiesCreated} created, ${result.facilitiesUpdated} updated, ${result.companiesCreated} companies`);
  return result;
}

/**
 * Merge records that didn't match anything (single-source facilities).
 * IDEMPOTENT: Checks for existing facilities before inserting.
 */
async function mergeUnmatchedRecords(result: MergeResult): Promise<void> {
  const QUERY_BATCH = 2000;
  const INSERT_BATCH = 500;
  let totalProcessed = 0;

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
      for (let i = 0; i < uncachedNames.length; i += INSERT_BATCH) {
        const batch = uncachedNames.slice(i, i + INSERT_BATCH);
        const existing = await db.select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(sql`${companies.name} IN (${sql.join(batch.map(n => sql`${n}`), sql`, `)})`);
        for (const co of existing) companyIdCache.set(co.name, co.id);
      }

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

        const stillMissing = newNames.filter(n => !companyIdCache.has(n));
        if (stillMissing.length > 0) {
          const refetched = await db.select({ id: companies.id, name: companies.name })
            .from(companies)
            .where(sql`${companies.name} IN (${sql.join(stillMissing.map(n => sql`${n}`), sql`, `)})`);
          for (const co of refetched) companyIdCache.set(co.name, co.id);
        }
      }
    }

    // Step 3: CHECK FOR EXISTING FACILITIES (IDEMPOTENCY)
    // Build lookup keys for all records
    type RecordWithFacility = { record: typeof rawRecords.$inferSelect; existingFacilityId: string | null };
    const recordsWithFacility: RecordWithFacility[] = [];

    // Batch lookup by registry_id
    const registryLookup = new Map<string, string>();
    const registryIds = unmerged.filter(r => r.registryId).map(r => r.registryId!);
    if (registryIds.length > 0) {
      for (let i = 0; i < registryIds.length; i += 500) {
        const batch = registryIds.slice(i, i + 500);
        const rows = await db.execute(sql`
          SELECT id, epa_registry_id FROM facilities
          WHERE epa_registry_id IN (${sql.join(batch.map(r => sql`${r}`), sql`, `)})
          ORDER BY source_count DESC
        `);
        for (const r of rows) {
          if (!registryLookup.has(String(r.epa_registry_id))) {
            registryLookup.set(String(r.epa_registry_id), String(r.id));
          }
        }
      }
    }

    // Batch lookup by (name, city, state)
    const nameLookup = new Map<string, string>();
    const nameKeys = unmerged
      .filter(r => !r.registryId || !registryLookup.has(r.registryId))
      .map(r => {
        const name = normalizeFacilityName(r.rawName) || 'Unknown Facility';
        return { name, city: r.rawCity || '', state: r.rawState || '' };
      });
    if (nameKeys.length > 0) {
      for (let i = 0; i < nameKeys.length; i += 200) {
        const batch = nameKeys.slice(i, i + 200);
        const conditions = batch.map(n =>
          sql`(name = ${n.name} AND coalesce(city,'') = ${n.city} AND coalesce(state,'') = ${n.state})`
        );
        const rows = await db.execute(sql`
          SELECT id, name, coalesce(city,'') as city, coalesce(state,'') as state FROM facilities
          WHERE ${sql.join(conditions, sql` OR `)}
          ORDER BY source_count DESC
        `);
        for (const r of rows) {
          const key = `${r.name}|${r.city}|${r.state}`;
          if (!nameLookup.has(key)) {
            nameLookup.set(key, String(r.id));
          }
        }
      }
    }

    // Classify each record as existing or new
    for (const record of unmerged) {
      let existingId: string | null = null;

      if (record.registryId) {
        existingId = registryLookup.get(record.registryId) || null;
      }
      if (!existingId) {
        const name = normalizeFacilityName(record.rawName) || 'Unknown Facility';
        const key = `${name}|${record.rawCity || ''}|${record.rawState || ''}`;
        existingId = nameLookup.get(key) || null;
      }

      recordsWithFacility.push({ record, existingFacilityId: existingId });
    }

    // Step 4: Insert NEW facilities
    const newRecords = recordsWithFacility.filter(r => !r.existingFacilityId);
    const existingRecords = recordsWithFacility.filter(r => r.existingFacilityId);

    if (newRecords.length > 0) {
      const facilityValues = newRecords.map(({ record }) => {
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

      // Insert facility_sources for new
      const sourceValues = newRecords.map(({ record }, i) => ({
        facilityId: allInsertedIds[i].id,
        rawRecordId: record.id,
        source: record.source as DataSource,
        sourceRecordId: record.sourceRecordId,
        fieldsProvided: JSON.stringify(getFieldsProvided(record)),
      }));
      for (let i = 0; i < sourceValues.length; i += INSERT_BATCH) {
        await db.insert(facilitySources).values(sourceValues.slice(i, i + INSERT_BATCH))
          .onConflictDoNothing();
      }

      // Update raw_records.facility_id for new
      for (let i = 0; i < newRecords.length; i += INSERT_BATCH) {
        const batchRecords = newRecords.slice(i, i + INSERT_BATCH);
        const batchFacilityIds = allInsertedIds.slice(i, i + INSERT_BATCH);
        const pairs = batchRecords.map((r, j) => sql`(${r.record.id}::uuid, ${batchFacilityIds[j].id}::uuid)`);
        await db.execute(sql`
          UPDATE raw_records SET facility_id = u.fid
          FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(rid, fid)
          WHERE raw_records.id = u.rid
        `);
      }

      // Also track in name lookup so subsequent records in this batch don't create dupes
      for (let i = 0; i < newRecords.length; i++) {
        const r = newRecords[i].record;
        const name = normalizeFacilityName(r.rawName) || 'Unknown Facility';
        const key = `${name}|${r.rawCity || ''}|${r.rawState || ''}`;
        nameLookup.set(key, allInsertedIds[i].id);
        if (r.registryId) registryLookup.set(r.registryId, allInsertedIds[i].id);
      }
    }

    // Step 5: Link EXISTING facilities
    if (existingRecords.length > 0) {
      result.facilitiesUpdated += existingRecords.length;

      // Insert facility_sources linking existing facilities to new raw records
      const sourceValues = existingRecords.map(({ record, existingFacilityId }) => ({
        facilityId: existingFacilityId!,
        rawRecordId: record.id,
        source: record.source as DataSource,
        sourceRecordId: record.sourceRecordId,
        fieldsProvided: JSON.stringify(getFieldsProvided(record)),
      }));
      for (let i = 0; i < sourceValues.length; i += INSERT_BATCH) {
        await db.insert(facilitySources).values(sourceValues.slice(i, i + INSERT_BATCH))
          .onConflictDoNothing();
      }

      // Update raw_records.facility_id for existing
      for (let i = 0; i < existingRecords.length; i += INSERT_BATCH) {
        const batch = existingRecords.slice(i, i + INSERT_BATCH);
        const pairs = batch.map(r => sql`(${r.record.id}::uuid, ${r.existingFacilityId}::uuid)`);
        await db.execute(sql`
          UPDATE raw_records SET facility_id = u.fid
          FROM (VALUES ${sql.join(pairs, sql`, `)}) AS u(rid, fid)
          WHERE raw_records.id = u.rid
        `);
      }

      // Update source counts on existing facilities
      const facilityIds = [...new Set(existingRecords.map(r => r.existingFacilityId!))];
      for (let i = 0; i < facilityIds.length; i += 200) {
        const batch = facilityIds.slice(i, i + 200);
        await db.execute(sql`
          UPDATE facilities SET
            source_count = sub.cnt,
            sources = sub.srcs,
            updated_at = NOW()
          FROM (
            SELECT
              facility_id,
              count(DISTINCT source)::int as cnt,
              json_agg(DISTINCT source)::text as srcs
            FROM facility_sources
            WHERE facility_id IN (${sql.join(batch.map(id => sql`${id}::uuid`), sql`, `)})
            GROUP BY facility_id
          ) sub
          WHERE facilities.id = sub.facility_id
        `);
      }
    }

    totalProcessed += unmerged.length;
    console.log(`[Merger] Batch processed ${totalProcessed} unmatched records (${newRecords.length} new, ${existingRecords.length} linked to existing)`);
  }

  // Update company facility counts
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
  let confidence = 30;

  if (sourceCount >= 3) confidence += 30;
  else if (sourceCount >= 2) confidence += 20;

  if (hasCoordinates) confidence += 20;

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
