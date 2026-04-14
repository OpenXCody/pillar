/**
 * Run the complete pipeline: ECHO fetch → seed import → matching → merge.
 * TRI is skipped for speed (slow API).
 */
import 'dotenv/config';
import { db } from '../db/index.js';
import { sourceRuns, rawRecords } from '../db/schema.js';
import { isNull, sql } from 'drizzle-orm';
import { fetchEcho } from '../pipeline/fetch/echoConnector.js';
import { runMatching } from '../pipeline/match/matcher.js';
import { runMerge } from '../pipeline/merge/merger.js';

async function main() {
  const startTime = Date.now();
  console.log('\n=== Full Pipeline Run ===\n');

  // Step 1: Fetch ECHO data
  console.log('--- Step 1: Fetching EPA ECHO ---');
  const [echoRun] = await db.insert(sourceRuns).values({ source: 'epa_echo', status: 'fetching' }).returning();
  const echoResult = await fetchEcho(echoRun.id);
  console.log(`  ECHO: ${echoResult.totalFetched} total, ${echoResult.inserted} inserted in ${(echoResult.durationMs / 1000).toFixed(1)}s`);
  await db.update(sourceRuns).set({
    status: 'completed',
    totalFetched: echoResult.totalFetched,
    newRecords: echoResult.inserted,
    completedAt: new Date(),
    durationMs: echoResult.durationMs,
  }).where(sql`${sourceRuns.id} = ${echoRun.id}`);

  // Step 2: Import seed data (if CSV exists)
  console.log('\n--- Step 2: Importing seed data ---');
  try {
    const { existsSync } = await import('fs');
    const seedPath = '/Users/cody/Downloads/All Company Names - Seed Data-2.csv';
    if (existsSync(seedPath)) {
      // Dynamic import the seed script's logic
      const { execSync } = await import('child_process');
      execSync('npx tsx server/scripts/import-seed-companies.ts', { stdio: 'inherit', cwd: process.cwd() });
    } else {
      console.log('  Seed CSV not found, skipping');
    }
  } catch (e) {
    console.log('  Seed import skipped:', (e as Error).message?.substring(0, 80));
  }

  // Step 3: Import TX factories
  console.log('\n--- Step 3: Importing TX factories ---');
  try {
    const { existsSync } = await import('fs');
    if (existsSync('/Users/cody/Downloads/TX_Manufacturing_Factories.csv')) {
      const { execSync } = await import('child_process');
      execSync('npx tsx server/scripts/import-tx-factories.ts', { stdio: 'inherit', cwd: process.cwd() });
    } else {
      console.log('  TX factories CSV not found, skipping');
    }
  } catch (e) {
    console.log('  TX import skipped:', (e as Error).message?.substring(0, 80));
  }

  // Check counts
  const unmatchedCount = await db.select({ count: sql<number>`count(*)` })
    .from(rawRecords).where(isNull(rawRecords.matchedAt));
  const totalCount = await db.select({ count: sql<number>`count(*)` }).from(rawRecords);
  console.log(`\nTotal raw records: ${totalCount[0].count}, unmatched: ${unmatchedCount[0].count}`);

  // Step 4: Match
  console.log('\n--- Step 4: Matching ---');
  const [matchRun] = await db.insert(sourceRuns).values({ source: 'epa_echo', status: 'matching' }).returning();
  const matchResult = await runMatching(matchRun.id);
  console.log(`  Match: ${matchResult.totalCompared} compared, ${matchResult.autoMatched} auto, ${matchResult.queuedForReview} review`);

  // Step 5: Merge
  console.log('\n--- Step 5: Merging ---');
  const mergeResult = await runMerge();
  console.log(`  Merge: ${mergeResult.facilitiesCreated} facilities, ${mergeResult.companiesCreated} companies`);

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Pipeline complete in ${totalDuration}s ===\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
