/**
 * Vercel Serverless Function entry point.
 *
 * Note: Vercel sets environment variables from the dashboard,
 * so dotenv is not needed here. The Express app is exported
 * as the default handler for Vercel's Node.js runtime.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Lazy-load routes to avoid import resolution issues at cold start
app.use('/api/facilities', async (req, res, next) => {
  const { facilitiesRouter } = await import('../server/routes/facilities.js');
  facilitiesRouter(req, res, next);
});
app.use('/api/companies', async (req, res, next) => {
  const { companiesRouter } = await import('../server/routes/companies.js');
  companiesRouter(req, res, next);
});
app.use('/api/sources', async (req, res, next) => {
  const { sourcesRouter } = await import('../server/routes/sources.js');
  sourcesRouter(req, res, next);
});
app.use('/api/review', async (req, res, next) => {
  const { reviewRouter } = await import('../server/routes/review.js');
  reviewRouter(req, res, next);
});
app.use('/api/export', async (req, res, next) => {
  const { exportRouter } = await import('../server/routes/export.js');
  exportRouter(req, res, next);
});
app.use('/api/stats', async (req, res, next) => {
  const { statsRouter } = await import('../server/routes/stats.js');
  statsRouter(req, res, next);
});
app.use('/api/pipeline', async (req, res, next) => {
  const { pipelineRouter } = await import('../server/routes/pipeline.js');
  pipelineRouter(req, res, next);
});
app.use('/api/states', async (req, res, next) => {
  const { statesRouter } = await import('../server/routes/states.js');
  statesRouter(req, res, next);
});

// Health check — no DB dependency
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasDbUrl: !!process.env.DATABASE_URL,
  });
});

// Vercel handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
