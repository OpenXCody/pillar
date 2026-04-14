/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app for serverless deployment.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { facilitiesRouter } from '../server/routes/facilities.js';
import { companiesRouter } from '../server/routes/companies.js';
import { sourcesRouter } from '../server/routes/sources.js';
import { reviewRouter } from '../server/routes/review.js';
import { exportRouter } from '../server/routes/export.js';
import { statsRouter } from '../server/routes/stats.js';
import { pipelineRouter } from '../server/routes/pipeline.js';
import { statesRouter } from '../server/routes/states.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/facilities', facilitiesRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/review', reviewRouter);
app.use('/api/export', exportRouter);
app.use('/api/stats', statsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/states', statesRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
