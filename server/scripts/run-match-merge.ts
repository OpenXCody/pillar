/**
 * Standalone script to run the match + merge pipeline stages.
 * Use this when raw records are already fetched and need processing.
 */
import 'dotenv/config';
import { db } from '../db/index.js';
import { sourceRuns, rawRecords } from '../db/schema.js';
import { isNull, sql } from 'drizzle-orm';
import { runMatching } from '../pipeline/match/matcher.js';
import { runMerge } from '../pipeline/merge/merger.js';

async function main() {
  const startTime = Date.now();

  // Check what we're working with
  const unmatchedCount = await db.select({ count: sql<number>`count(*)` })
    .from(rawRecords).where(isNull(rawRecords.matchedAt));
  const totalCount = await db.select({ count: sql<number>`count(*)` }).from(rawRecords);

  console.log(`\n=== Match + Merge Pipeline ===`);
  console.log(`Total raw records: ${totalCount[0].count}`);
  console.log(`Unmatched records: ${unmatchedCount[0].count}`);

  if (Number(unmatchedCount[0].count) === 0) {
    console.log('No unmatched records to process. Running merge only...\n');
    const mergeResult = await runMerge();
    console.log(`\nMerge result:`, mergeResult);
    process.exit(0);
  }

  // Create a source run record for tracking
  const [run] = await db.insert(sourceRuns).values({
    source: 'epa_echo',
    status: 'matching',
  }).returning();

  try {
    // Stage 1: Match
    console.log(`\n--- Stage 1: Matching ${unmatchedCount[0].count} records ---`);
    const matchStart = Date.now();
    const matchResult = await runMatching(run.id);
    const matchDuration = ((Date.now() - matchStart) / 1000).toFixed(1);

    console.log(`\nMatch complete in ${matchDuration}s:`);
    console.log(`  Compared: ${matchResult.totalCompared}`);
    console.log(`  Auto-matched: ${matchResult.autoMatched}`);
    console.log(`  Queued for review: ${matchResult.queuedForReview}`);
    console.log(`  No match: ${matchResult.noMatch}`);

    // Stage 2: Merge
    console.log(`\n--- Stage 2: Merging golden records ---`);
    const mergeStart = Date.now();
    const mergeResult = await runMerge();
    const mergeDuration = ((Date.now() - mergeStart) / 1000).toFixed(1);

    console.log(`\nMerge complete in ${mergeDuration}s:`);
    console.log(`  Facilities created: ${mergeResult.facilitiesCreated}`);
    console.log(`  Facilities updated: ${mergeResult.facilitiesUpdated}`);
    console.log(`  Companies created: ${mergeResult.companiesCreated}`);

    // Update source run
    await db.update(sourceRuns).set({
      status: 'completed',
      matchesFound: matchResult.autoMatched + matchResult.queuedForReview,
      goldenRecordsCreated: mergeResult.facilitiesCreated,
      goldenRecordsUpdated: mergeResult.facilitiesUpdated,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    }).where(sql`${sourceRuns.id} = ${run.id}`);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== Pipeline complete in ${totalDuration}s ===\n`);

  } catch (err) {
    console.error(`\nPipeline failed:`, err);
    await db.update(sourceRuns).set({
      status: 'failed',
      errorLog: JSON.stringify({ error: String(err), stack: (err as Error).stack }),
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    }).where(sql`${sourceRuns.id} = ${run.id}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
