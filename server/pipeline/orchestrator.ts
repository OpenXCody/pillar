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
import { fetchNhtsa } from './fetch/nhtsaConnector.js';
import { fetchCensusCbp } from './fetch/censusCbpConnector.js';
import { fetchOsha } from './fetch/oshaConnector.js';
import { fetchFsis } from './fetch/fsisConnector.js';
import { runMatching } from './match/matcher.js';
import { runMerge } from './merge/merger.js';
import type { DataSource } from '../../shared/types.js';

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
let stageProgress: number = 0;   // 0-100
let stageLabel: string | null = null;
let syncStartedAt: number | null = null;

export function getPipelineStatus() {
  return {
    running: isRunning,
    currentStage,
    currentSource,
    stageProgress,
    stageLabel,
    elapsedMs: syncStartedAt ? Date.now() - syncStartedAt : null,
  };
}

/** Update progress visible to the status endpoint */
export function updateProgress(stage: string, progress: number, label: string) {
  currentStage = stage;
  stageProgress = Math.min(100, Math.max(0, progress));
  stageLabel = label;
}

/**
 * Run the full pipeline for a specific source.
 */
export async function runPipeline(source: DataSource): Promise<PipelineResult> {
  if (isRunning) throw new Error('Pipeline is already running');

  isRunning = true;
  currentSource = source;
  syncStartedAt = Date.now();
  stageProgress = 0;
  stageLabel = 'Starting...';
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
    stageProgress = 5;
    stageLabel = 'Downloading records...';
    console.log(`[Pipeline] Stage 1: Fetching ${source}...`);

    let totalFetched = 0;
    let inserted = 0;

    if (source === 'epa_echo') {
      const echoResult = await fetchEcho(run.id);
      totalFetched = echoResult.manufacturingCount;
      inserted = echoResult.inserted;
    } else if (source === 'epa_tri') {
      const triResult = await fetchTri(run.id);
      totalFetched = triResult.totalFetched;
      inserted = triResult.inserted;
    } else if (source === 'nhtsa') {
      const nhtsaResult = await fetchNhtsa(run.id);
      totalFetched = nhtsaResult.totalFetched;
      inserted = nhtsaResult.inserted;
    } else if (source === 'census_cbp') {
      const cbpResult = await fetchCensusCbp(run.id);
      totalFetched = cbpResult.totalFetched;
      inserted = cbpResult.inserted;
    } else if (source === 'osha') {
      const oshaResult = await fetchOsha(run.id);
      totalFetched = oshaResult.totalFetched;
      inserted = oshaResult.inserted;
    } else if (source === 'usda_fsis') {
      const fsisResult = await fetchFsis(run.id);
      totalFetched = fsisResult.totalFetched;
      inserted = fsisResult.inserted;
    } else {
      throw new Error(`Source connector not implemented: ${source}`);
    }

    result.stages.fetch = {
      totalFetched,
      inserted,
    };

    // Stage 2: Match
    currentStage = 'matching';
    stageProgress = 40;
    stageLabel = `Fetched ${totalFetched.toLocaleString()} records. Matching...`;
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
    stageProgress = 70;
    stageLabel = 'Building golden records...';
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

    stageProgress = 100;
    stageLabel = 'Complete!';
    result.durationMs = Date.now() - startTime;
    console.log(`[Pipeline] Complete in ${(result.durationMs / 1000).toFixed(1)}s`);

    return result;
  } catch (err) {
    result.error = String(err);
    result.durationMs = Date.now() - startTime;
    stageLabel = `Failed: ${String(err).slice(0, 80)}`;
    console.error(`[Pipeline] Failed:`, err);
    throw err;
  } finally {
    isRunning = false;
    currentStage = null;
    currentSource = null;
    stageProgress = 0;
    stageLabel = null;
    syncStartedAt = null;
  }
}
