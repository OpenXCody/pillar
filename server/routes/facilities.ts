import { Router } from 'express';
import { db } from '../db/index.js';
import { facilities, facilitySources, rawRecords } from '../db/schema.js';
import { sql, eq, ilike, and, count, desc } from 'drizzle-orm';
import { INDUSTRY_CATEGORIES } from '@shared/naics.js';

export const facilitiesRouter = Router();

/**
 * Resolve a NAICS filter value — could be a category key (e.g. "aerospace"),
 * a category label (e.g. "Aerospace & Defense"), or a raw NAICS prefix (e.g. "3364").
 * Returns an array of NAICS prefixes to match with OR.
 */
function resolveNaicsPrefixes(value: string): string[] {
  const v = value.trim();
  // Check if it's a category key
  const byKey = INDUSTRY_CATEGORIES.find(c => c.key === v);
  if (byKey) return byKey.naicsPrefixes;
  // Check if it's a category label (case-insensitive)
  const byLabel = INDUSTRY_CATEGORIES.find(c => c.label.toLowerCase() === v.toLowerCase());
  if (byLabel) return byLabel.naicsPrefixes;
  // Otherwise treat as a raw NAICS prefix
  return [v];
}

/** Build filter conditions from query params (shared between list + count) */
function buildFacilityFilters(query: Record<string, any>) {
  const { search, state, naics, company, minSources } = query;
  const conditions = [];

  if (search) {
    const searchStr = String(search).trim();
    // Check if the search matches a category label
    const categoryMatch = INDUSTRY_CATEGORIES.find(c =>
      c.label.toLowerCase() === searchStr.toLowerCase() ||
      c.key === searchStr.toLowerCase()
    );
    if (categoryMatch) {
      // Search is a category — filter by all its NAICS prefixes
      const prefixConds = categoryMatch.naicsPrefixes.map(p => sql`${facilities.primaryNaics} LIKE ${p + '%'}`);
      conditions.push(sql`(${sql.join(prefixConds, sql` OR `)})`);
    } else {
      conditions.push(
        sql`(${ilike(facilities.name, `%${searchStr}%`)} OR ${ilike(facilities.companyName, `%${searchStr}%`)})`
      );
    }
  }
  if (state) conditions.push(eq(facilities.state, String(state)));
  if (naics) {
    const prefixes = resolveNaicsPrefixes(String(naics));
    if (prefixes.length === 1) {
      conditions.push(sql`${facilities.primaryNaics} LIKE ${prefixes[0] + '%'}`);
    } else {
      const prefixConds = prefixes.map(p => sql`${facilities.primaryNaics} LIKE ${p + '%'}`);
      conditions.push(sql`(${sql.join(prefixConds, sql` OR `)})`);
    }
  }
  if (company) conditions.push(ilike(facilities.companyName, `%${company}%`));
  if (minSources && Number(minSources) > 1) {
    conditions.push(sql`${facilities.sourceCount} >= ${Number(minSources)}`);
  }
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

    // Cursor format: "confidence:id" for stable sort by confidence DESC, id DESC
    if (cursor) {
      const [cursorConf, cursorId] = String(cursor).split(':');
      conditions.push(
        sql`(${facilities.confidence}, ${facilities.id}) < (${parseInt(cursorConf)}, ${cursorId})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(facilities)
      .where(where)
      .orderBy(desc(facilities.confidence), desc(facilities.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = data[data.length - 1];
    const nextCursor = hasMore && lastRow ? `${lastRow.confidence}:${lastRow.id}` : null;

    res.json({
      data: data.map(f => ({
        ...f,
        sources: f.sources ? JSON.parse(f.sources) : [],
        faaApprovalTypes: f.faaApprovalTypes ? JSON.parse(f.faaApprovalTypes) : null,
        exportedToArchangel: f.exportedToArchangel === 1,
      })),
      nextCursor,
    });
  } catch (err) {
    console.error('Error fetching facilities:', err);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// PATCH /api/facilities/:id — Manual edit with Open X audit trail
facilitiesRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate facility exists
    const [existing] = await db.select().from(facilities).where(eq(facilities.id, id));
    if (!existing) return res.status(404).json({ error: 'Facility not found' });

    // Editable fields and their raw_record column mappings
    const fieldMap: Record<string, string> = {
      name: 'rawName',
      address: 'rawAddress',
      city: 'rawCity',
      state: 'rawState',
      zip: 'rawZip',
      primaryNaics: 'rawNaicsCode',
      primaryNaicsDescription: 'rawNaicsDescription',
      companyName: 'triParentCompanyName',
      latitude: 'rawLatitude',
      longitude: 'rawLongitude',
    };

    const fieldsUpdated: string[] = [];
    const facilityUpdate: Record<string, unknown> = {};
    const rawRecordValues: Record<string, unknown> = {};

    for (const [facilityField, rawField] of Object.entries(fieldMap)) {
      if (updates[facilityField] !== undefined) {
        const oldVal = (existing as Record<string, unknown>)[facilityField];
        const newVal = updates[facilityField];
        if (String(newVal ?? '') !== String(oldVal ?? '')) {
          fieldsUpdated.push(facilityField);
          facilityUpdate[facilityField] = newVal || null;
          rawRecordValues[rawField] = newVal || null;
        }
      }
    }

    // Handle employeeCount separately (integer)
    if (updates.employeeCount !== undefined) {
      const newCount = updates.employeeCount ? parseInt(String(updates.employeeCount)) : null;
      if (newCount !== existing.employeeCount) {
        fieldsUpdated.push('employeeCount');
        facilityUpdate.employeeCount = newCount;
        facilityUpdate.employeeCountSource = 'manual';
      }
    }

    if (fieldsUpdated.length === 0) {
      return res.json({ message: 'No changes detected', fieldsUpdated: [] });
    }

    // 1. Create raw_record for audit trail (Open X source)
    const [rawRecord] = await db.insert(rawRecords).values({
      source: 'manual',
      sourceRecordId: `openx_edit_${id}_${Date.now()}`,
      rawName: (rawRecordValues.rawName as string) ?? existing.name,
      rawAddress: (rawRecordValues.rawAddress as string) ?? existing.address,
      rawCity: (rawRecordValues.rawCity as string) ?? existing.city,
      rawState: (rawRecordValues.rawState as string) ?? existing.state,
      rawZip: (rawRecordValues.rawZip as string) ?? existing.zip,
      rawNaicsCode: (rawRecordValues.rawNaicsCode as string) ?? existing.primaryNaics,
      rawNaicsDescription: (rawRecordValues.rawNaicsDescription as string) ?? existing.primaryNaicsDescription,
      rawLatitude: (rawRecordValues.rawLatitude as string) ?? existing.latitude,
      rawLongitude: (rawRecordValues.rawLongitude as string) ?? existing.longitude,
      triParentCompanyName: (rawRecordValues.triParentCompanyName as string) ?? existing.companyName,
      facilityId: id,
      fetchedAt: new Date(),
      normalizedAt: new Date(),
      matchedAt: new Date(),
      rawJson: JSON.stringify({ editedFields: fieldsUpdated, previousValues: fieldsUpdated.reduce((acc, f) => ({ ...acc, [f]: (existing as Record<string, unknown>)[f] }), {}) }),
    }).returning();

    // 2. Update the facility golden record
    facilityUpdate.updatedAt = new Date();
    await db.update(facilities).set(facilityUpdate).where(eq(facilities.id, id));

    // 3. Create facility_source attribution
    await db.insert(facilitySources).values({
      facilityId: id,
      rawRecordId: rawRecord.id,
      source: 'manual',
      sourceRecordId: rawRecord.sourceRecordId,
      fieldsProvided: JSON.stringify(fieldsUpdated),
    });

    // 4. Add 'manual' to sources array if not already present
    const currentSources: string[] = existing.sources ? JSON.parse(existing.sources) : [];
    if (!currentSources.includes('manual')) {
      currentSources.push('manual');
      await db.update(facilities).set({
        sources: JSON.stringify(currentSources),
        sourceCount: currentSources.length,
      }).where(eq(facilities.id, id));
    }

    // Return updated facility with source links
    const [updated] = await db.select().from(facilities).where(eq(facilities.id, id));
    const sourceLinks = await db.select({
      source: facilitySources.source,
      sourceRecordId: facilitySources.sourceRecordId,
      fieldsProvided: facilitySources.fieldsProvided,
      linkedAt: facilitySources.linkedAt,
    }).from(facilitySources)
      .where(eq(facilitySources.facilityId, id));

    res.json({
      facility: {
        ...updated,
        sources: updated.sources ? JSON.parse(updated.sources) : [],
        faaApprovalTypes: updated.faaApprovalTypes ? JSON.parse(updated.faaApprovalTypes) : null,
        exportedToArchangel: updated.exportedToArchangel === 1,
        facilitySources: sourceLinks.map(s => ({
          ...s,
          fieldsProvided: s.fieldsProvided ? JSON.parse(s.fieldsProvided) : [],
        })),
      },
      fieldsUpdated,
    });
  } catch (err) {
    console.error('Error updating facility:', err);
    res.status(500).json({ error: 'Failed to update facility' });
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
      faaApprovalTypes: facility.faaApprovalTypes ? JSON.parse(facility.faaApprovalTypes) : null,
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
