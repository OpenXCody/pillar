import { Router } from 'express';
import { db } from '../db/index.js';
import { companies, facilities } from '../db/schema.js';
import { eq, ilike, and, gt, desc, sql, count } from 'drizzle-orm';

export const companiesRouter = Router();

companiesRouter.get('/', async (req, res) => {
  try {
    const { search, cursor, status, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(String(rawLimit || '50'), 10), 100);

    const conditions = [];
    if (search) {
      conditions.push(ilike(companies.name, `%${search}%`));
    }
    // Filter by status (default: show only verified)
    if (status && ['unverified', 'verified', 'rejected'].includes(String(status))) {
      conditions.push(eq(companies.status, String(status) as 'unverified' | 'verified' | 'rejected'));
    }
    // Cursor-based pagination using facility_count + id for stable ordering
    if (cursor) {
      // cursor format: "count:id" for stable sort by facility_count DESC, id ASC
      const [cursorCount, cursorId] = String(cursor).split(':');
      conditions.push(sql`(${companies.facilityCount}, ${companies.id}) < (${parseInt(cursorCount)}, ${cursorId})`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(companies)
      .where(where)
      .orderBy(desc(companies.facilityCount), desc(companies.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = data[data.length - 1];
    const nextCursor = hasMore && lastRow ? `${lastRow.facilityCount}:${lastRow.id}` : null;

    res.json({ data, nextCursor });
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// GET /api/companies/stats — Status counts for filter tabs
companiesRouter.get('/stats', async (_req, res) => {
  try {
    const statusCounts = await db
      .select({ status: companies.status, count: count() })
      .from(companies)
      .groupBy(companies.status);

    const counts: Record<string, number> = { unverified: 0, verified: 0, rejected: 0 };
    for (const row of statusCounts) {
      counts[row.status] = row.count;
    }
    res.json(counts);
  } catch (err) {
    console.error('Error fetching company stats:', err);
    res.status(500).json({ error: 'Failed to fetch company stats' });
  }
});

companiesRouter.get('/:id', async (req, res) => {
  try {
    const [company] = await db.select().from(companies)
      .where(eq(companies.id, req.params.id));

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const linkedFacilities = await db.select().from(facilities)
      .where(eq(facilities.companyId, company.id))
      .orderBy(facilities.name);

    res.json({
      ...company,
      facilities: linkedFacilities.map(f => ({
        ...f,
        sources: f.sources ? JSON.parse(f.sources) : [],
        exportedToArchangel: f.exportedToArchangel === 1,
      })),
    });
  } catch (err) {
    console.error('Error fetching company:', err);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});
