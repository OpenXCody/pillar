import { Router } from 'express';
import { db } from '../db/index.js';
import { facilities, companies } from '../db/schema.js';
import { sql, eq, count } from 'drizzle-orm';
import { STATE_CODE_TO_NAME, type StateCode } from '../../shared/states.js';

export const statesRouter = Router();

statesRouter.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase() as StateCode;
    const name = STATE_CODE_TO_NAME[code];
    if (!name) {
      return res.status(404).json({ error: 'Unknown state code' });
    }

    // Total facility count
    const [facilityCount] = await db
      .select({ count: count() })
      .from(facilities)
      .where(eq(facilities.state, code));

    // Distinct companies in state
    const companyCountResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${facilities.companyId})` })
      .from(facilities)
      .where(sql`${facilities.state} = ${code} AND ${facilities.companyId} IS NOT NULL`);
    const companyCount = companyCountResult[0]?.count ?? 0;

    // Top 15 NAICS codes
    const topNaics = await db
      .select({
        code: facilities.primaryNaics,
        description: facilities.primaryNaicsDescription,
        count: count(),
      })
      .from(facilities)
      .where(sql`${facilities.state} = ${code} AND ${facilities.primaryNaics} IS NOT NULL`)
      .groupBy(facilities.primaryNaics, facilities.primaryNaicsDescription)
      .orderBy(sql`count(*) DESC`)
      .limit(15);

    // Top 20 companies by facility count in this state
    const topCompanies = await db
      .select({
        id: companies.id,
        name: companies.name,
        count: count(),
      })
      .from(facilities)
      .innerJoin(companies, eq(facilities.companyId, companies.id))
      .where(eq(facilities.state, code))
      .groupBy(companies.id, companies.name)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    // Source breakdown — parse the JSON `sources` column and count
    const allSources = await db
      .select({ sources: facilities.sources })
      .from(facilities)
      .where(sql`${facilities.state} = ${code} AND ${facilities.sources} IS NOT NULL`);

    const sourceCounts: Record<string, number> = {};
    for (const row of allSources) {
      if (!row.sources) continue;
      try {
        const parsed: string[] = JSON.parse(row.sources);
        for (const s of parsed) {
          sourceCounts[s] = (sourceCounts[s] || 0) + 1;
        }
      } catch {
        // skip malformed JSON
      }
    }

    // Top 15 cities
    const topCities = await db
      .select({
        city: facilities.city,
        count: count(),
      })
      .from(facilities)
      .where(sql`${facilities.state} = ${code} AND ${facilities.city} IS NOT NULL`)
      .groupBy(facilities.city)
      .orderBy(sql`count(*) DESC`)
      .limit(15);

    // Add company count per city
    const cityCompanyCounts = await db
      .select({
        city: facilities.city,
        companyCount: sql<number>`COUNT(DISTINCT ${facilities.companyId})`,
      })
      .from(facilities)
      .where(sql`${facilities.state} = ${code} AND ${facilities.city} IS NOT NULL AND ${facilities.companyId} IS NOT NULL`)
      .groupBy(facilities.city);

    const cityCompanyMap: Record<string, number> = {};
    for (const row of cityCompanyCounts) {
      if (row.city) cityCompanyMap[row.city] = Number(row.companyCount);
    }

    res.json({
      code,
      name,
      totalFacilities: facilityCount.count,
      totalCompanies: Number(companyCount),
      topNaics: topNaics.map(r => ({
        code: r.code,
        description: r.description,
        count: r.count,
      })),
      topCompanies: topCompanies.map(r => ({
        id: r.id,
        name: r.name,
        count: r.count,
      })),
      bySource: sourceCounts,
      topCities: topCities.map(r => ({
        city: r.city!,
        count: r.count,
        companyCount: cityCompanyMap[r.city!] ?? 0,
      })),
    });
  } catch (err) {
    console.error('Error fetching state detail:', err);
    res.status(500).json({ error: 'Failed to fetch state detail' });
  }
});
