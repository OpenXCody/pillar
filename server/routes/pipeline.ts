import { Router } from 'express';
import { getPipelineStatus, runPipeline } from '../pipeline/orchestrator.js';
import { runEnrichment } from '../pipeline/enrichment.js';
import type { DataSource } from '@shared/types.js';

export const pipelineRouter = Router();

pipelineRouter.get('/status', (_req, res) => {
  res.json(getPipelineStatus());
});

pipelineRouter.post('/run', async (req, res) => {
  const status = getPipelineStatus();
  if (status.running) {
    return res.status(409).json({ error: 'Pipeline is already running', ...status });
  }

  const { source } = req.body as { source?: DataSource };
  if (!source) {
    return res.status(400).json({ error: 'source is required' });
  }

  res.json({ message: `Pipeline started for ${source}` });

  runPipeline(source).catch(err => {
    console.error(`[Pipeline] Run failed:`, err);
  });
});

pipelineRouter.post('/enrich', async (_req, res) => {
  const status = getPipelineStatus();
  if (status.running) {
    return res.status(409).json({ error: 'Pipeline is already running' });
  }

  res.json({ message: 'Enrichment started' });

  runEnrichment().catch(err => {
    console.error(`[Enrichment] Failed:`, err);
  });
});
