import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { facilitiesRouter } from './routes/facilities.js';
import { companiesRouter } from './routes/companies.js';
import { sourcesRouter } from './routes/sources.js';
import { reviewRouter } from './routes/review.js';
import { exportRouter } from './routes/export.js';
import { statsRouter } from './routes/stats.js';
import { pipelineRouter } from './routes/pipeline.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Pillar server running on http://localhost:${PORT}`);
});
