import { Router } from 'express';
import { db } from '../db/index.js';
import { exports as exportsTable, facilities } from '../db/schema.js';
import { desc, sql, eq, and, gte, isNotNull, like, inArray } from 'drizzle-orm';
import { createWriteStream, existsSync, mkdirSync, statSync, createReadStream } from 'fs';
import { join } from 'path';

export const exportRouter = Router();

const EXPORT_DIR = join(process.cwd(), 'exports');

// Ensure export directory exists
if (!existsSync(EXPORT_DIR)) {
  mkdirSync(EXPORT_DIR, { recursive: true });
}

/**
 * POST /export/generate — Generate a CSV export of facility data
 */
exportRouter.post('/generate', async (req, res) => {
  try {
    const { filters = {}, format = 'csv', exportType = 'factory' } = req.body;

    // Company export: separate path
    if (exportType === 'company') {
      return await generateCompanyExport(req, res, filters, format);
    }

    // Create export record
    const [exportRecord] = await db.insert(exportsTable).values({
      status: 'generating',
      format,
      filters: JSON.stringify(filters),
    }).returning();

    // Build query conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (filters.states && filters.states.length > 0) {
      conditions.push(inArray(facilities.state, filters.states));
    }
    if (filters.naicsPrefix) {
      conditions.push(like(facilities.primaryNaics, `${filters.naicsPrefix}%`));
    }
    if (filters.minSources && filters.minSources > 1) {
      conditions.push(gte(facilities.sourceCount, filters.minSources));
    }
    if (filters.minConfidence) {
      conditions.push(gte(facilities.confidence, filters.minConfidence));
    }
    if (filters.hasCompany) {
      conditions.push(isNotNull(facilities.companyId));
    }
    if (filters.hasCoordinates) {
      conditions.push(isNotNull(facilities.latitude));
      conditions.push(isNotNull(facilities.longitude));
    }

    // Count matching facilities
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(facilities)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalCount = countResult.count;

    if (totalCount === 0) {
      await db.update(exportsTable).set({
        status: 'completed',
        facilityCount: 0,
        companyCount: 0,
        completedAt: new Date(),
      }).where(eq(exportsTable.id, exportRecord.id));

      return res.json({ ...exportRecord, facilityCount: 0, companyCount: 0, status: 'completed' });
    }

    // Generate CSV file
    const filename = `pillar-export-${exportRecord.id.slice(0, 8)}.csv`;
    const filePath = join(EXPORT_DIR, filename);
    const writeStream = createWriteStream(filePath);

    // Archangel-compatible CSV header
    const headers = [
      'company_name', 'facility_name', 'address', 'city', 'state', 'zip',
      'latitude', 'longitude', 'naics_code', 'naics_description',
      'employee_count', 'source_count', 'confidence', 'epa_registry_id',
    ];
    writeStream.write(headers.join(',') + '\n');

    // Stream facilities in batches
    const BATCH_SIZE = 5000;
    let offset = 0;
    let facilityCount = 0;
    const companyIds = new Set<string>();

    while (offset < totalCount) {
      const rows = await db
        .select({
          name: facilities.name,
          companyName: facilities.companyName,
          companyId: facilities.companyId,
          address: facilities.address,
          city: facilities.city,
          state: facilities.state,
          zip: facilities.zip,
          latitude: facilities.latitude,
          longitude: facilities.longitude,
          primaryNaics: facilities.primaryNaics,
          primaryNaicsDescription: facilities.primaryNaicsDescription,
          employeeCount: facilities.employeeCount,
          sourceCount: facilities.sourceCount,
          confidence: facilities.confidence,
          epaRegistryId: facilities.epaRegistryId,
        })
        .from(facilities)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(facilities.state, facilities.city, facilities.name)
        .limit(BATCH_SIZE)
        .offset(offset);

      for (const row of rows) {
        if (row.companyId) companyIds.add(row.companyId);
        const line = [
          csvEscape(row.companyName || ''),
          csvEscape(row.name),
          csvEscape(row.address || ''),
          csvEscape(row.city || ''),
          row.state || '',
          row.zip || '',
          row.latitude || '',
          row.longitude || '',
          row.primaryNaics || '',
          csvEscape(row.primaryNaicsDescription || ''),
          row.employeeCount?.toString() || '',
          row.sourceCount.toString(),
          row.confidence.toString(),
          row.epaRegistryId || '',
        ].join(',');
        writeStream.write(line + '\n');
        facilityCount++;
      }

      offset += BATCH_SIZE;
    }

    writeStream.end();

    // Wait for write to finish
    await new Promise<void>((resolve) => writeStream.on('finish', resolve));

    const fileSize = statSync(filePath).size;

    // Update export record
    await db.update(exportsTable).set({
      status: 'completed',
      facilityCount,
      companyCount: companyIds.size,
      filePath: filename,
      fileSize,
      completedAt: new Date(),
    }).where(eq(exportsTable.id, exportRecord.id));

    // Mark exported facilities
    await db.execute(sql`
      UPDATE facilities SET exported_to_archangel = exported_to_archangel + 1, last_exported_at = NOW()
      ${conditions.length > 0 ? sql`WHERE ${and(...conditions)}` : sql``}
    `);

    res.json({
      id: exportRecord.id,
      status: 'completed',
      format,
      facilityCount,
      companyCount: companyIds.size,
      filePath: filename,
      fileSize,
      filters,
    });
  } catch (err) {
    console.error('Error generating export:', err);
    res.status(500).json({ error: 'Failed to generate export' });
  }
});

/**
 * GET /export/preview — Preview count of facilities matching filters
 */
exportRouter.get('/preview', async (req, res) => {
  try {
    const { states, naicsPrefix, minSources, minConfidence, hasCompany, hasCoordinates } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    if (states && typeof states === 'string') {
      const stateList = states.split(',').filter(Boolean);
      if (stateList.length > 0) conditions.push(inArray(facilities.state, stateList));
    }
    if (naicsPrefix) {
      conditions.push(like(facilities.primaryNaics, `${naicsPrefix}%`));
    }
    if (minSources && Number(minSources) > 1) {
      conditions.push(gte(facilities.sourceCount, Number(minSources)));
    }
    if (minConfidence) {
      conditions.push(gte(facilities.confidence, Number(minConfidence)));
    }
    if (hasCompany === 'true') {
      conditions.push(isNotNull(facilities.companyId));
    }
    if (hasCoordinates === 'true') {
      conditions.push(isNotNull(facilities.latitude));
      conditions.push(isNotNull(facilities.longitude));
    }

    const [result] = await db
      .select({
        facilityCount: sql<number>`count(*)::int`,
        companyCount: sql<number>`count(distinct company_id)::int`,
        stateCount: sql<number>`count(distinct state)::int`,
      })
      .from(facilities)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      facilityCount: result.facilityCount,
      companyCount: result.companyCount,
      stateCount: result.stateCount,
    });
  } catch (err) {
    console.error('Error previewing export:', err);
    res.status(500).json({ error: 'Failed to preview export' });
  }
});

/**
 * GET /export/history — List recent exports
 */
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

/**
 * GET /export/download/:filename — Download an export file
 */
exportRouter.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = join(EXPORT_DIR, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Export file not found' });
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  createReadStream(filePath).pipe(res);
});

async function generateCompanyExport(_req: import('express').Request, res: import('express').Response, filters: Record<string, unknown>, format: string) {
  const [exportRecord] = await db.insert(exportsTable).values({
    status: 'generating',
    format,
    filters: JSON.stringify({ ...filters, exportType: 'company' }),
  }).returning();

  const filename = `pillar-companies-${exportRecord.id.slice(0, 8)}.csv`;
  const filePath = join(EXPORT_DIR, filename);
  const writeStream = createWriteStream(filePath);

  const headers = ['company_name', 'sector', 'facility_count', 'states', 'naics_codes', 'status'];
  writeStream.write(headers.join(',') + '\n');

  // Query companies with aggregated state and NAICS data
  const rows = await db.execute(sql`
    SELECT
      c.name,
      c.sector,
      c.facility_count,
      c.status,
      c.naics_codes,
      (SELECT string_agg(DISTINCT f.state, '; ' ORDER BY f.state)
       FROM facilities f WHERE f.company_id = c.id) as states
    FROM companies c
    WHERE c.facility_count > 0 AND c.status != 'rejected'
    ORDER BY c.facility_count DESC
  `) as { name: string; sector: string | null; facility_count: number; status: string; naics_codes: string | null; states: string | null }[];

  let companyCount = 0;
  for (const row of rows) {
    const line = [
      csvEscape(row.name),
      csvEscape(row.sector || ''),
      row.facility_count?.toString() || '0',
      csvEscape(row.states || ''),
      csvEscape(row.naics_codes || ''),
      row.status,
    ].join(',');
    writeStream.write(line + '\n');
    companyCount++;
  }

  writeStream.end();
  await new Promise<void>((resolve) => writeStream.on('finish', resolve));
  const fileSize = statSync(filePath).size;

  await db.update(exportsTable).set({
    status: 'completed',
    facilityCount: 0,
    companyCount,
    filePath: filename,
    fileSize,
    completedAt: new Date(),
  }).where(eq(exportsTable.id, exportRecord.id));

  res.json({
    id: exportRecord.id,
    status: 'completed',
    format,
    facilityCount: 0,
    companyCount,
    filePath: filename,
    fileSize,
    filters: { ...filters, exportType: 'company' },
  });
}

function csvEscape(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
