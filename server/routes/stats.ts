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

    // US states only — exclude non-state territories (GU, VI, MP, AS, XF, etc.)
    const US_STATES_SET = new Set([
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
      'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
      'DC','PR',
    ]);
    const allStates = await db
      .select({ state: facilities.state, count: count() })
      .from(facilities)
      .where(sql`${facilities.state} IS NOT NULL`)
      .groupBy(facilities.state)
      .orderBy(sql`count(*) DESC`);
    const topStates = allStates.filter(r => r.state && US_STATES_SET.has(r.state));

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

/**
 * GET /stats/industries — NAICS industry breakdown across all facilities
 */
statsRouter.get('/industries', async (_req, res) => {
  try {
    // Get all NAICS codes with counts
    const naicsList = await db.execute(sql`
      SELECT
        primary_naics as code,
        primary_naics_description as description,
        COUNT(*)::int as facility_count,
        COUNT(DISTINCT company_id)::int as company_count,
        LEFT(primary_naics, 3) as subsector
      FROM facilities
      WHERE primary_naics IS NOT NULL AND primary_naics != ''
      GROUP BY primary_naics, primary_naics_description
      ORDER BY COUNT(*) DESC
    `);

    // Get 2-digit sector summaries (31, 32, 33)
    const sectors = await db.execute(sql`
      SELECT
        LEFT(primary_naics, 2) as sector,
        COUNT(*)::int as facility_count,
        COUNT(DISTINCT company_id)::int as company_count
      FROM facilities
      WHERE primary_naics IS NOT NULL AND LEFT(primary_naics, 2) IN ('31', '32', '33')
      GROUP BY LEFT(primary_naics, 2)
      ORDER BY COUNT(*) DESC
    `);

    // Get 3-digit subsector summaries
    const subsectors = await db.execute(sql`
      SELECT
        LEFT(primary_naics, 3) as subsector,
        COUNT(*)::int as facility_count,
        COUNT(DISTINCT company_id)::int as company_count
      FROM facilities
      WHERE primary_naics IS NOT NULL AND LEFT(primary_naics, 2) IN ('31', '32', '33')
      GROUP BY LEFT(primary_naics, 3)
      ORDER BY COUNT(*) DESC
    `);

    // Top states per major NAICS group
    const topStatesByNaics = await db.execute(sql`
      SELECT
        LEFT(primary_naics, 3) as subsector,
        state,
        COUNT(*)::int as count
      FROM facilities
      WHERE primary_naics IS NOT NULL AND state IS NOT NULL
      GROUP BY LEFT(primary_naics, 3), state
      ORDER BY LEFT(primary_naics, 3), COUNT(*) DESC
    `);

    // Group top states per subsector (top 5 each)
    const statesBySubsector: Record<string, Array<{ state: string; count: number }>> = {};
    for (const row of topStatesByNaics) {
      const sub = String(row.subsector);
      if (!statesBySubsector[sub]) statesBySubsector[sub] = [];
      if (statesBySubsector[sub].length < 5) {
        statesBySubsector[sub].push({ state: String(row.state), count: Number(row.count) });
      }
    }

    res.json({
      industries: naicsList.map((r: Record<string, unknown>) => ({
        code: r.code,
        description: r.description,
        facilityCount: r.facility_count,
        companyCount: r.company_count,
        subsector: r.subsector,
      })),
      sectors: sectors.map((r: Record<string, unknown>) => ({
        sector: r.sector,
        facilityCount: r.facility_count,
        companyCount: r.company_count,
      })),
      subsectors: subsectors.map((r: Record<string, unknown>) => ({
        subsector: r.subsector,
        facilityCount: r.facility_count,
        companyCount: r.company_count,
        topStates: statesBySubsector[String(r.subsector)] || [],
      })),
    });
  } catch (err) {
    console.error('Error fetching industries:', err);
    res.status(500).json({ error: 'Failed to fetch industries' });
  }
});
