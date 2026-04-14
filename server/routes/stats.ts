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

    // Build category aggregations from subsector data
    const { INDUSTRY_CATEGORIES } = await import('@shared/naics.js');
    const categoryMap = new Map<string, { key: string; label: string; facilityCount: number; companyCount: number; subsectors: string[] }>();
    for (const cat of INDUSTRY_CATEGORIES) {
      categoryMap.set(cat.key, { key: cat.key, label: cat.label, facilityCount: 0, companyCount: 0, subsectors: [] });
    }
    // Map each subsector to its category
    for (const row of subsectors) {
      const sub = String(row.subsector);
      let matched = false;
      // Check 4-digit prefixes first (e.g. 3364 → Aerospace), then 3-digit
      for (const cat of INDUSTRY_CATEGORIES) {
        for (const prefix of cat.naicsPrefixes) {
          if (sub.startsWith(prefix) || prefix.startsWith(sub)) {
            const entry = categoryMap.get(cat.key)!;
            entry.facilityCount += Number(row.facility_count);
            entry.companyCount += Number(row.company_count);
            if (!entry.subsectors.includes(sub)) entry.subsectors.push(sub);
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }
    // For 336 split (Aerospace vs Automobiles), use 4-digit query
    const transportSplit = await db.execute(sql`
      SELECT
        LEFT(primary_naics, 4) as prefix4,
        COUNT(*)::int as facility_count,
        COUNT(DISTINCT company_id)::int as company_count
      FROM facilities
      WHERE LEFT(primary_naics, 3) = '336' AND primary_naics IS NOT NULL
      GROUP BY LEFT(primary_naics, 4)
    `);
    // Reset the 336 counts and recalculate from 4-digit data
    const aero = categoryMap.get('aerospace')!;
    const auto = categoryMap.get('automobiles')!;
    aero.facilityCount = 0; aero.companyCount = 0;
    auto.facilityCount = 0; auto.companyCount = 0;
    for (const row of transportSplit) {
      const p4 = String(row.prefix4);
      if (p4 === '3364') {
        aero.facilityCount += Number(row.facility_count);
        aero.companyCount += Number(row.company_count);
      } else {
        auto.facilityCount += Number(row.facility_count);
        auto.companyCount += Number(row.company_count);
      }
    }

    const categories = Array.from(categoryMap.values())
      .filter(c => c.facilityCount > 0)
      .sort((a, b) => b.facilityCount - a.facilityCount);

    res.json({
      categories,
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

/**
 * GET /stats/coverage — Compare our facility data to Census CBP establishment counts.
 * Shows where we have good coverage vs gaps.
 */
statsRouter.get('/coverage', async (_req, res) => {
  try {
    // Get Census CBP totals by state
    const censusByState = await db.execute(sql`
      SELECT
        raw_state as state,
        SUM(census_establishment_count)::int as census_establishments,
        SUM(census_employees)::int as census_employees,
        SUM(census_annual_payroll)::int as census_payroll
      FROM raw_records
      WHERE source = 'census_cbp' AND census_establishment_count IS NOT NULL AND raw_state IS NOT NULL
      GROUP BY raw_state
      ORDER BY SUM(census_establishment_count) DESC
    `);

    // Get our facility counts by state
    const ourByState = await db.execute(sql`
      SELECT state, count(*)::int as facility_count
      FROM facilities
      WHERE state IS NOT NULL
      GROUP BY state
    `);

    const ourMap = new Map<string, number>();
    for (const r of ourByState) {
      ourMap.set(String(r.state), Number(r.facility_count));
    }

    // Build coverage analysis
    const stateCoverage = censusByState.map((r: Record<string, unknown>) => {
      const state = String(r.state);
      const censusCount = Number(r.census_establishments);
      const ourCount = ourMap.get(state) || 0;
      const coverageRatio = censusCount > 0 ? Math.round((ourCount / censusCount) * 100) : 0;

      return {
        state,
        censusEstablishments: censusCount,
        censusEmployees: Number(r.census_employees) || 0,
        censusPayroll: Number(r.census_payroll) || 0,
        ourFacilities: ourCount,
        coveragePercent: Math.min(coverageRatio, 999), // Cap at 999% for display
        gap: Math.max(censusCount - ourCount, 0),
      };
    }).sort((a, b) => b.censusEstablishments - a.censusEstablishments);

    // Summary stats
    const totalCensus = stateCoverage.reduce((s, r) => s + r.censusEstablishments, 0);
    const totalOurs = stateCoverage.reduce((s, r) => s + r.ourFacilities, 0);
    const totalEmployees = stateCoverage.reduce((s, r) => s + r.censusEmployees, 0);

    res.json({
      summary: {
        censusEstablishments: totalCensus,
        ourFacilities: totalOurs,
        overallCoverage: totalCensus > 0 ? Math.round((totalOurs / totalCensus) * 100) : 0,
        totalManufacturingEmployees: totalEmployees,
      },
      byState: stateCoverage,
    });
  } catch (err) {
    console.error('Error fetching coverage:', err);
    res.status(500).json({ error: 'Failed to fetch coverage stats' });
  }
});
