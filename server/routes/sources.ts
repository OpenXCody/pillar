import { Router } from 'express';
import { db } from '../db/index.js';
import { sourceRuns, rawRecords } from '../db/schema.js';
import { eq, count, desc } from 'drizzle-orm';
import { runPipeline } from '../pipeline/orchestrator.js';
import type { DataSource } from '../../shared/types.js';

export const sourcesRouter = Router();

const VALID_SOURCES: DataSource[] = ['epa_echo', 'epa_tri', 'nhtsa', 'census_cbp', 'osha', 'usda_fsis'];
const ALL_SOURCES: DataSource[] = [...VALID_SOURCES, 'manual'];

sourcesRouter.get('/', async (_req, res) => {
  try {
    const sources = await Promise.all(
      ALL_SOURCES.map(async (key) => {
        const [lastRun] = await db.select().from(sourceRuns)
          .where(eq(sourceRuns.source, key))
          .orderBy(desc(sourceRuns.startedAt))
          .limit(1);

        const [recordCount] = await db.select({ count: count() }).from(rawRecords)
          .where(eq(rawRecords.source, key));

        return {
          key,
          name: key,
          lastRun: lastRun || null,
          rawRecordCount: recordCount.count,
        };
      })
    );

    res.json({ sources });
  } catch (err) {
    console.error('Error fetching sources:', err);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

sourcesRouter.get('/:source/runs', async (req, res) => {
  try {
    const source = req.params.source as DataSource;
    const runs = await db.select().from(sourceRuns)
      .where(eq(sourceRuns.source, source))
      .orderBy(desc(sourceRuns.startedAt))
      .limit(20);

    res.json({ runs });
  } catch (err) {
    console.error('Error fetching runs:', err);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

sourcesRouter.post('/:source/fetch', async (req, res) => {
  try {
    const source = req.params.source as DataSource;
    if (!VALID_SOURCES.includes(source)) {
      return res.status(400).json({ error: `Invalid source: ${source}` });
    }

    // Return immediately, run pipeline async
    res.json({ message: `Pipeline started for ${source}`, source });

    // Fire and forget — runs in background
    runPipeline(source).catch(err => {
      console.error(`[Pipeline] Background run failed for ${source}:`, err);
    });
  } catch (err) {
    console.error('Error triggering fetch:', err);
    res.status(500).json({ error: 'Failed to trigger fetch' });
  }
});
