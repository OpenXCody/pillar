import { Router } from 'express';
import { db } from '../db/index.js';
import { exports as exportsTable } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export const exportRouter = Router();

exportRouter.post('/generate', async (req, res) => {
  try {
    const { filters, format = 'csv' } = req.body;

    const [exportRecord] = await db.insert(exportsTable).values({
      status: 'pending',
      format,
      filters: filters ? JSON.stringify(filters) : null,
    }).returning();

    // Export generation will be implemented with the export pipeline
    res.json(exportRecord);
  } catch (err) {
    console.error('Error generating export:', err);
    res.status(500).json({ error: 'Failed to generate export' });
  }
});

exportRouter.get('/history', async (_req, res) => {
  try {
    const rows = await db.select().from(exportsTable)
      .orderBy(desc(exportsTable.createdAt))
      .limit(20);

    res.json({
      exports: rows.map(e => ({
        ...e,
        filters: e.filters ? JSON.parse(e.filters) : null,
      })),
    });
  } catch (err) {
    console.error('Error fetching export history:', err);
    res.status(500).json({ error: 'Failed to fetch export history' });
  }
});
