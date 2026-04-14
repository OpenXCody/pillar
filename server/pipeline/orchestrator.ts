/**
 * Pipeline Orchestrator
 *
 * Chains the full pipeline: fetch -> normalize -> match -> merge.
 * Can run the full pipeline or individual stages.
 */

import { db } from '../db/index.js';
import { sourceRuns } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { fetchEcho } from './fetch/echoConnector.js';
import { fetchTri } from './fetch/triConnector.js';
import { runMatching } from './match/matcher.js';
import { runMerge } from './merge/merger.js';
import type { DataSource } from '@shared/types.js';

export interface PipelineResult {
  source: DataSource;
  runId: string;
  stages: {
    fetch: { totalFetched: number; inserted: number } | null;
    match: { autoMatched: number; queuedForReview: number } | null;
    merge: { facilitiesCreated: number; companiesCreated: number } | null;
  };
  durationMs: number;
  error: string | null;
}

let isRunning = false;
let currentStage: string | null = null;
let currentSource: string | null = null;

export function getPipelineStatus() {
  return { running: isRunning, currentStage, currentSource };
}

/**
 * Run the full pipeline for a specific source.
 */
export async function runPipeline(source: DataSource): Promise<PipelineResult> {
  if (isRunning) throw new Error('Pipeline is already running');

  isRunning = true;
  currentSource = source;
  const startTime = Date.now();

  const result: PipelineResult = {
    source,
    runId: '',
    stages: { fetch: null, match: null, merge: null },
    durationMs: 0,
    error: null,
  };

  try {
    // Create source run record
    const [run] = await db.insert(sourceRuns).values({
      source,
      status: 'pending',
    }).returning();
    result.runId = run.id;

    // Stage 1: Fetch
    currentStage = 'fetching';
    console.log(`[Pipeline] Stage 1: Fetching ${source}...`);

    let fetchResult;
    if (source === 'epa_echo') {
      fetchResult = await fetchEcho(run.id);
    } else if (source === 'epa_tri') {
      fetchResult = await fetchTri(run.id);
    } else {
      throw new Error(`Source connector not implemented: ${source}`);
    }

    result.stages.fetch = {
      totalFetched: fetchResult.totalFetched,
      inserted: fetchResult.inserted,
    };

    // Stage 2: Match
    currentStage = 'matching';
    console.log(`[Pipeline] Stage 2: Matching...`);
    await db.update(sourceRuns).set({ status: 'matching' }).where(eq(sourceRuns.id, run.id));

    const matchResult = await runMatching(run.id);
    result.stages.match = {
      autoMatched: matchResult.autoMatched,
      queuedForReview: matchResult.queuedForReview,
    };

    await db.update(sourceRuns).set({
      matchesFound: matchResult.autoMatched + matchResult.queuedForReview,
    }).where(eq(sourceRuns.id, run.id));

    // Stage 3: Merge
    currentStage = 'merging';
    console.log(`[Pipeline] Stage 3: Merging golden records...`);
    await db.update(sourceRuns).set({ status: 'merging' }).where(eq(sourceRuns.id, run.id));

    const mergeResult = await runMerge();
    result.stages.merge = {
      facilitiesCreated: mergeResult.facilitiesCreated,
      companiesCreated: mergeResult.companiesCreated,
    };

    await db.update(sourceRuns).set({
      status: 'completed',
      goldenRecordsCreated: mergeResult.facilitiesCreated,
      goldenRecordsUpdated: mergeResult.facilitiesUpdated,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    }).where(eq(sourceRuns.id, run.id));

    result.durationMs = Date.now() - startTime;
    console.log(`[Pipeline] Complete in ${(result.durationMs / 1000).toFixed(1)}s`);

    return result;
  } catch (err) {
    result.error = String(err);
    result.durationMs = Date.now() - startTime;
    console.error(`[Pipeline] Failed:`, err);
    throw err;
  } finally {
    isRunning = false;
    currentStage = null;
    currentSource = null;
  }
}
