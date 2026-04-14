import { Router } from 'express';
import { db } from '../db/index.js';
import { facilities, companies, rawRecords, matchCandidates } from '../db/schema.js';
import { sql, eq, count } from 'drizzle-orm';

export const statsRouter = Router();

statsRouter.get('/overview', async (_req, res) => {
  try {
    const [facilityCount] = await db.select({ count: count() }).from(facilities);
    const [companyCount] = await db.select({ count: count() }).from(companies);
    const [rawCount] = await db.select({ count: count() }).from(rawRecords);

    const multiSource = await db.select({ count: count() }).from(facilities)
      .where(sql`${facilities.sourceCount} >= 2`);

    const pendingReviews = await db.select({ count: count() }).from(matchCandidates)
      .where(eq(matchCandidates.status, 'pending'));

    // Records by source
    const sourceCounts = await db
      .select({ source: rawRecords.source, count: count() })
      .from(rawRecords)
      .groupBy(rawRecords.source);

    const bySource: Record<string, number> = {};
    for (const row of sourceCounts) {
      bySource[row.source] = row.count;
    }

    // All states (sorted by count)
    const topStates = await db
      .select({ state: facilities.state, count: count() })
      .from(facilities)
      .where(sql`${facilities.state} IS NOT NULL`)
      .groupBy(facilities.state)
      .orderBy(sql`count(*) DESC`);

    res.json({
      totalFacilities: facilityCount.count,
      totalCompanies: companyCount.count,
      totalRawRecords: rawCount.count,
      multiSourceCount: multiSource[0].count,
      pendingReviews: pendingReviews[0].count,
      bySource,
      byState: topStates.map(r => ({ state: r.state!, count: r.count })),
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
