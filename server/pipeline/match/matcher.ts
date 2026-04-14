/**
 * Facility Matcher
 *
 * Finds duplicate records across sources using blocking + composite scoring.
 * High-confidence matches (>=90) are auto-matched.
 * Medium-confidence (60-89) are queued for review.
 *
 * Processes state-by-state to handle 200K+ records without memory overflow.
 */

import { db } from '../../db/index.js';
import { rawRecords, matchCandidates } from '../../db/schema.js';
import { isNull, eq, sql, and } from 'drizzle-orm';
import { buildBlocks } from './blockingStrategy.js';
import { computeCompositeScore, AUTO_MATCH_THRESHOLD, REVIEW_THRESHOLD } from './scoringRules.js';

export interface MatchResult {
  totalCompared: number;
  autoMatched: number;
  queuedForReview: number;
  noMatch: number;
}

const MAX_BLOCK_SIZE = 500; // Skip blocks larger than this — too generic to be useful
const MATCH_INSERT_BATCH = 500;

/**
 * Run the matching pipeline on unmatched raw records.
 * Processes state-by-state to keep memory usage manageable.
 */
export async function runMatching(runId: string): Promise<MatchResult> {
  const result: MatchResult = { totalCompared: 0, autoMatched: 0, queuedForReview: 0, noMatch: 0 };

  // Get distinct states with unmatched records
  const states = await db.selectDistinct({ state: rawRecords.rawState })
    .from(rawRecords)
    .where(isNull(rawRecords.matchedAt));

  const stateList = states.map(s => s.state).filter(Boolean) as string[];
  console.log(`[Matcher] Processing ${stateList.length} states`);

  for (const state of stateList) {
    // Fetch unmatched records for this state
    const unmatched = await db.select({
      id: rawRecords.id,
      source: rawRecords.source,
      rawName: rawRecords.rawName,
      rawAddress: rawRecords.rawAddress,
      rawCity: rawRecords.rawCity,
      rawState: rawRecords.rawState,
      rawZip: rawRecords.rawZip,
      rawLatitude: rawRecords.rawLatitude,
      rawLongitude: rawRecords.rawLongitude,
      rawNaicsCode: rawRecords.rawNaicsCode,
      registryId: rawRecords.registryId,
    }).from(rawRecords).where(
      and(isNull(rawRecords.matchedAt), eq(rawRecords.rawState, state))
    );

    if (unmatched.length < 2) {
      // Mark as matched (no pairs possible) and continue
      if (unmatched.length === 1) {
        await db.update(rawRecords)
          .set({ matchedAt: new Date() })
          .where(eq(rawRecords.id, unmatched[0].id));
      }
      continue;
    }

    // Build blocks for this state's records
    const blocks = buildBlocks(unmatched);
    const matchBatch: (typeof matchCandidates.$inferInsert)[] = [];

    // Process each block
    for (const [, indices] of blocks) {
      if (indices.length < 2) continue;
      if (indices.length > MAX_BLOCK_SIZE) {
        // Skip overly generic blocks — they'll match through more specific blocks
        continue;
      }

      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const a = unmatched[indices[i]];
          const b = unmatched[indices[j]];

          // Don't compare records from the same source
          if (a.source === b.source) continue;

          // Ensure consistent ordering to avoid duplicate pairs across blocks
          const [recA, recB] = a.id < b.id ? [a, b] : [b, a];

          result.totalCompared++;

          // Fast path: shared EPA Registry ID = auto-match at 99
          if (recA.registryId && recB.registryId && recA.registryId === recB.registryId) {
            matchBatch.push({
              recordAId: recA.id,
              recordBId: recB.id,
              matchType: 'frs_id',
              status: 'auto_matched',
              confidenceScore: 99,
              scoreBreakdown: JSON.stringify({ nameScore: 100, geoScore: 100, addressScore: 100, naicsScore: 100 }),
              reviewedBy: 'system',
              reviewedAt: new Date(),
              sourceRunId: runId,
            });
            result.autoMatched++;
            continue;
          }

          // Composite scoring
          const scores = computeCompositeScore(recA, recB);

          if (scores.composite >= AUTO_MATCH_THRESHOLD) {
            matchBatch.push({
              recordAId: recA.id,
              recordBId: recB.id,
              matchType: 'geo_name',
              status: 'auto_matched',
              confidenceScore: scores.composite,
              scoreBreakdown: JSON.stringify(scores),
              reviewedBy: 'system',
              reviewedAt: new Date(),
              sourceRunId: runId,
            });
            result.autoMatched++;
          } else if (scores.composite >= REVIEW_THRESHOLD) {
            matchBatch.push({
              recordAId: recA.id,
              recordBId: recB.id,
              matchType: 'geo_name',
              status: 'pending',
              confidenceScore: scores.composite,
              scoreBreakdown: JSON.stringify(scores),
              sourceRunId: runId,
            });
            result.queuedForReview++;
          } else {
            result.noMatch++;
          }
        }
      }

      // Flush match batch periodically to avoid memory buildup
      if (matchBatch.length >= MATCH_INSERT_BATCH) {
        const toInsert = matchBatch.splice(0, MATCH_INSERT_BATCH);
        await db.insert(matchCandidates).values(toInsert).onConflictDoNothing();
      }
    }

    // Flush remaining matches for this state
    if (matchBatch.length > 0) {
      for (let i = 0; i < matchBatch.length; i += MATCH_INSERT_BATCH) {
        const batch = matchBatch.slice(i, i + MATCH_INSERT_BATCH);
        await db.insert(matchCandidates).values(batch).onConflictDoNothing();
      }
      matchBatch.length = 0;
    }

    // Mark all this state's records as matched
    const now = new Date();
    const allIds = unmatched.map(r => r.id);
    const ID_BATCH = 1000;
    for (let i = 0; i < allIds.length; i += ID_BATCH) {
      const batch = allIds.slice(i, i + ID_BATCH);
      await db.update(rawRecords)
        .set({ matchedAt: now })
        .where(sql`${rawRecords.id} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
    }

    console.log(`[Matcher] State ${state}: ${unmatched.length} records, ${result.autoMatched} auto-matched so far`);
  }

  // Handle records with null state
  const nullStateRecords = await db.select({ id: rawRecords.id })
    .from(rawRecords)
    .where(and(isNull(rawRecords.matchedAt), isNull(rawRecords.rawState)));

  if (nullStateRecords.length > 0) {
    const now = new Date();
    const allIds = nullStateRecords.map(r => r.id);
    const ID_BATCH = 1000;
    for (let i = 0; i < allIds.length; i += ID_BATCH) {
      const batch = allIds.slice(i, i + ID_BATCH);
      await db.update(rawRecords)
        .set({ matchedAt: now })
        .where(sql`${rawRecords.id} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
    }
    console.log(`[Matcher] Marked ${nullStateRecords.length} null-state records as processed`);
  }

  console.log(`[Matcher] Complete: ${result.totalCompared} compared, ${result.autoMatched} auto-matched, ${result.queuedForReview} queued`);
  return result;
}
