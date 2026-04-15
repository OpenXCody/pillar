import { Router } from 'express';
import { db } from '../db/index.js';
import { companies, facilities } from '../db/schema.js';
import { eq, ilike, and, desc, sql, count } from 'drizzle-orm';
import { INDUSTRY_CATEGORIES } from '../../shared/naics.js';

export const companiesRouter = Router();

companiesRouter.get('/', async (req, res) => {
  try {
    const { search, cursor, status, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(String(rawLimit || '50'), 10), 100);

    const conditions = [];
    if (search) {
      const searchStr = String(search).trim();
      // Check if search matches a category label or key
      const categoryMatch = INDUSTRY_CATEGORIES.find(c =>
        c.label.toLowerCase() === searchStr.toLowerCase() ||
        c.key === searchStr.toLowerCase() ||
        c.label.toLowerCase().includes(searchStr.toLowerCase())
      );
      if (categoryMatch) {
        // Search by sector (which stores category labels)
        conditions.push(ilike(companies.sector, `%${categoryMatch.label}%`));
      } else {
        // Search by name or sector
        conditions.push(sql`(${ilike(companies.name, `%${searchStr}%`)} OR ${ilike(companies.sector, `%${searchStr}%`)})`);
      }
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

    // Compute state breakdown
    const stateCounts: Record<string, number> = {};
    const naicsCounts: Record<string, { description: string | null; count: number }> = {};
    const sourceCounts: Record<string, number> = {};

    for (const f of linkedFacilities) {
      // State
      if (f.state) {
        stateCounts[f.state] = (stateCounts[f.state] || 0) + 1;
      }
      // NAICS
      if (f.primaryNaics) {
        if (!naicsCounts[f.primaryNaics]) {
          naicsCounts[f.primaryNaics] = { description: f.primaryNaicsDescription, count: 0 };
        }
        naicsCounts[f.primaryNaics].count += 1;
      }
      // Sources
      const fSources: string[] = f.sources ? JSON.parse(f.sources) : [];
      for (const src of fSources) {
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      }
    }

    const stateBreakdown = Object.entries(stateCounts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);

    const naicsBreakdown = Object.entries(naicsCounts)
      .map(([code, { description, count }]) => ({ code, description, count }))
      .sort((a, b) => b.count - a.count);

    const sourceBreakdown = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      ...company,
      facilities: linkedFacilities.map(f => ({
        ...f,
        sources: f.sources ? JSON.parse(f.sources) : [],
        exportedToArchangel: f.exportedToArchangel === 1,
      })),
      stateBreakdown,
      naicsBreakdown,
      sourceBreakdown,
    });
  } catch (err) {
    console.error('Error fetching company:', err);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// PATCH /api/companies/:id — Edit company details
companiesRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [existing] = await db.select().from(companies).where(eq(companies.id, id));
    if (!existing) return res.status(404).json({ error: 'Company not found' });

    const allowedFields: Record<string, keyof typeof companies.$inferInsert> = {
      name: 'name',
      sector: 'sector',
      status: 'status',
    };

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    const fieldsUpdated: string[] = [];

    for (const [key, col] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined && updates[key] !== (existing as Record<string, unknown>)[col || key]) {
        setValues[col || key] = updates[key];
        fieldsUpdated.push(key);
      }
    }

    if (fieldsUpdated.length === 0) {
      return res.json({ company: existing, fieldsUpdated: [] });
    }

    // If name changed, update company_name on all linked facilities
    if (fieldsUpdated.includes('name')) {
      await db.execute(sql`
        UPDATE facilities SET company_name = ${updates.name}, updated_at = NOW()
        WHERE company_id = ${id}::uuid
      `);
    }

    await db.update(companies).set(setValues).where(eq(companies.id, id));

    const [updated] = await db.select().from(companies).where(eq(companies.id, id));
    res.json({ company: updated, fieldsUpdated });
  } catch (err) {
    console.error('Error updating company:', err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});
