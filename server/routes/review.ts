import { Router } from 'express';
import { db } from '../db/index.js';
import { matchCandidates } from '../db/schema.js';
import { eq, count, and, gt, desc } from 'drizzle-orm';

export const reviewRouter = Router();

reviewRouter.get('/', async (req, res) => {
  try {
    const { status, cursor, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(String(rawLimit || '20'), 10), 100);

    const conditions = [];
    if (status) conditions.push(eq(matchCandidates.status, String(status) as 'pending'));
    if (cursor) conditions.push(gt(matchCandidates.id, String(cursor)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(matchCandidates)
      .where(where)
      .orderBy(desc(matchCandidates.confidenceScore))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      data: data.map(m => ({
        ...m,
        scoreBreakdown: m.scoreBreakdown ? JSON.parse(m.scoreBreakdown) : null,
      })),
      nextCursor: hasMore ? data[data.length - 1].id : null,
    });
  } catch (err) {
    console.error('Error fetching review queue:', err);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

reviewRouter.get('/stats', async (_req, res) => {
  try {
    const [pending] = await db.select({ count: count() }).from(matchCandidates).where(eq(matchCandidates.status, 'pending'));
    const [confirmed] = await db.select({ count: count() }).from(matchCandidates).where(eq(matchCandidates.status, 'confirmed'));
    const [rejected] = await db.select({ count: count() }).from(matchCandidates).where(eq(matchCandidates.status, 'rejected'));

    res.json({
      pending: pending.count,
      confirmed: confirmed.count,
      rejected: rejected.count,
    });
  } catch (err) {
    console.error('Error fetching review stats:', err);
    res.status(500).json({ error: 'Failed to fetch review stats' });
  }
});

reviewRouter.post('/:id/confirm', async (req, res) => {
  try {
    await db.update(matchCandidates)
      .set({ status: 'confirmed', reviewedAt: new Date(), reviewedBy: 'admin' })
      .where(eq(matchCandidates.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Error confirming match:', err);
    res.status(500).json({ error: 'Failed to confirm match' });
  }
});

reviewRouter.post('/:id/reject', async (req, res) => {
  try {
    await db.update(matchCandidates)
      .set({ status: 'rejected', reviewedAt: new Date(), reviewedBy: 'admin' })
      .where(eq(matchCandidates.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Error rejecting match:', err);
    res.status(500).json({ error: 'Failed to reject match' });
  }
});
