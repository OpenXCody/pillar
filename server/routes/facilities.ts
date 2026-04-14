import { Router } from 'express';
import { db } from '../db/index.js';
import { facilities, facilitySources } from '../db/schema.js';
import { sql, eq, ilike, and, gt, count } from 'drizzle-orm';

export const facilitiesRouter = Router();

/** Build filter conditions from query params (shared between list + count) */
function buildFacilityFilters(query: Record<string, any>) {
  const { search, state, naics, company } = query;
  const conditions = [];
  if (search) {
    conditions.push(
      sql`(${ilike(facilities.name, `%${search}%`)} OR ${ilike(facilities.companyName, `%${search}%`)})`
    );
  }
  if (state) conditions.push(eq(facilities.state, String(state)));
  if (naics) conditions.push(sql`${facilities.primaryNaics} LIKE ${String(naics) + '%'}`);
  if (company) conditions.push(ilike(facilities.companyName, `%${company}%`));
  return conditions;
}

// GET /api/facilities/count — filtered count (no pagination)
facilitiesRouter.get('/count', async (req, res) => {
  try {
    const conditions = buildFacilityFilters(req.query);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [result] = await db.select({ count: count() }).from(facilities).where(where);
    res.json({ count: result.count });
  } catch (err) {
    console.error('Error counting facilities:', err);
    res.status(500).json({ error: 'Failed to count facilities' });
  }
});

facilitiesRouter.get('/', async (req, res) => {
  try {
    const { cursor, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(String(rawLimit || '50'), 10), 100);

    const conditions = buildFacilityFilters(req.query);
    if (cursor) conditions.push(gt(facilities.id, String(cursor)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(facilities)
      .where(where)
      .orderBy(facilities.id)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.json({
      data: data.map(f => ({
        ...f,
        sources: f.sources ? JSON.parse(f.sources) : [],
        exportedToArchangel: f.exportedToArchangel === 1,
      })),
      nextCursor,
    });
  } catch (err) {
    console.error('Error fetching facilities:', err);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

facilitiesRouter.get('/:id', async (req, res) => {
  try {
    const [facility] = await db.select().from(facilities)
      .where(eq(facilities.id, req.params.id));

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    const sourceLinks = await db.select({
      source: facilitySources.source,
      sourceRecordId: facilitySources.sourceRecordId,
      fieldsProvided: facilitySources.fieldsProvided,
      linkedAt: facilitySources.linkedAt,
    }).from(facilitySources)
      .where(eq(facilitySources.facilityId, facility.id));

    res.json({
      ...facility,
      sources: facility.sources ? JSON.parse(facility.sources) : [],
      exportedToArchangel: facility.exportedToArchangel === 1,
      facilitySources: sourceLinks.map(s => ({
        ...s,
        fieldsProvided: s.fieldsProvided ? JSON.parse(s.fieldsProvided) : [],
      })),
    });
  } catch (err) {
    console.error('Error fetching facility:', err);
    res.status(500).json({ error: 'Failed to fetch facility' });
  }
});
