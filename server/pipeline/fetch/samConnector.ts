/**
 * SAM.gov Entity Management API Connector
 *
 * Fetches manufacturer data from the System for Award Management (SAM.gov)
 * Entity Management API. Includes federal contractors and entities registered
 * with SAM that have manufacturing NAICS codes (31-33).
 *
 * API: https://api.sam.gov/entity-information/v3/entities
 * API key required (free registration at https://sam.gov/content/home)
 * Key parameter: api_key
 * Rate limit: ~10 requests/minute (free tier)
 * ~Thousands of US manufacturing entities.
 */

import { db } from '../../db/index.js';
import { rawRecords, sourceRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { updateProgress } from '../orchestrator.js';

const SAM_API_BASE = 'https://api.sam.gov/entity-information/v3/entities';
const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 6000; // 6s between requests (~10 req/min)

interface SamEntity {
  entityRegistration: {
    ueiSAM: string;
    ueiDUNS: string | null;
    entityEFTIndicator: string | null;
    cageCode: string | null;
    dodaac: string | null;
    legalBusinessName: string;
    dbaName: string | null;
    registrationStatus: string;
    registrationDate: string | null;
    lastUpdateDate: string | null;
    registrationExpirationDate: string | null;
    activationDate: string | null;
    ueiStatus: string | null;
    entityURL: string | null;
    entityDivisionName: string | null;
    entityDivisionNumber: string | null;
    entityStartDate: string | null;
    fiscalYearEndCloseDate: string | null;
    submissionDate: string | null;
  };
  coreData?: {
    entityInformation?: {
      entityURL: string | null;
      entityDivisionName: string | null;
      entityDivisionNumber: string | null;
      entityStartDate: string | null;
      fiscalYearEndCloseDate: string | null;
      submissionDate: string | null;
    };
    physicalAddress?: {
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      stateOrProvinceCode: string | null;
      zipCode: string | null;
      zipCodePlus4: string | null;
      countryCode: string | null;
    };
    mailingAddress?: {
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      stateOrProvinceCode: string | null;
      zipCode: string | null;
      countryCode: string | null;
    };
    generalInformation?: {
      entityStructureCode: string | null;
      entityStructureDesc: string | null;
      entityTypeCode: string | null;
      entityTypeDesc: string | null;
      profitStructureCode: string | null;
      profitStructureDesc: string | null;
      organizationStructureCode: string | null;
      organizationStructureDesc: string | null;
      stateOfIncorporationCode: string | null;
      countryOfIncorporationCode: string | null;
    };
    businessTypes?: {
      businessTypeList?: Array<{
        businessTypeCode: string;
        businessTypeDesc: string;
      }>;
      sbaBusinessTypeList?: Array<{
        sbaBusinessTypeCode: string;
        sbaBusinessTypeDesc: string;
      }>;
    };
  };
  assertions?: {
    goodsAndServices?: {
      primaryNaics: string | null;
      naicsList?: Array<{
        naicsCode: string;
        naicsDescription: string | null;
        sbaSmallBusiness: string | null;
        naicsException: string | null;
      }>;
    };
  };
}

interface SamApiResponse {
  totalRecords: number;
  entityData: SamEntity[];
  links?: Array<{ rel: string; href: string }>;
}

export interface SamGovFetchResult {
  totalFetched: number;
  inserted: number;
  errors: string[];
}

/**
 * Fetch a page from the SAM.gov Entity Management API with retry on 429.
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pillar-Data-Pipeline/1.0)' },
    });

    if (res.status === 429) {
      if (attempt < maxRetries) {
        const delay = Math.min(RATE_LIMIT_DELAY * Math.pow(2, attempt), 60000);
        console.log(`[SAM] Rate limited (429), retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }

    if (res.status === 403) {
      throw new Error('SAM.gov API returned 403 Forbidden — check your API key');
    }

    return res;
  }

  throw new Error('SAM.gov API: max retries exceeded');
}

/**
 * Fetch a single page of SAM.gov entities filtered to manufacturing NAICS.
 */
async function fetchSamPage(apiKey: string, page: number): Promise<{ entities: SamEntity[]; totalRecords: number }> {
  const url = `${SAM_API_BASE}?api_key=${apiKey}&registrationStatus=A&physicalAddress.countryCode=USA&naicsCode=31*&page=${page}&size=${PAGE_SIZE}`;

  const res = await fetchWithRetry(url);

  if (!res.ok) {
    if (res.status === 404) return { entities: [], totalRecords: 0 };
    const body = await res.text().catch(() => '');
    throw new Error(`SAM.gov API error: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }

  const data: SamApiResponse = await res.json();
  return {
    entities: data.entityData || [],
    totalRecords: data.totalRecords || 0,
  };
}

/**
 * Fetch all US manufacturing entities from SAM.gov across all pages.
 */
async function fetchAllSamEntities(apiKey: string): Promise<SamEntity[]> {
  const allEntities: SamEntity[] = [];
  let page = 0;
  let totalRecords = 0;

  console.log('[SAM] Fetching manufacturing entities (NAICS 31-33)...');

  // First page to get total count
  const firstPage = await fetchSamPage(apiKey, page);
  totalRecords = firstPage.totalRecords;
  allEntities.push(...firstPage.entities);

  console.log(`[SAM] Total available: ${totalRecords.toLocaleString()} entities`);

  if (firstPage.entities.length === 0) {
    return allEntities;
  }

  page++;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  // Fetch remaining pages
  while (page < totalPages) {
    updateProgress('fetching', 5 + Math.round((page / totalPages) * 55),
      `Fetching SAM.gov page ${page + 1} / ${totalPages}... (${allEntities.length.toLocaleString()} so far)`);

    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

    try {
      const result = await fetchSamPage(apiKey, page);

      if (result.entities.length === 0) {
        console.log(`[SAM] Empty page at ${page}, stopping pagination`);
        break;
      }

      allEntities.push(...result.entities);

      if (page % 10 === 0) {
        console.log(`[SAM] Progress: ${allEntities.length.toLocaleString()} / ${totalRecords.toLocaleString()}`);
      }
    } catch (err) {
      console.log(`[SAM] Error on page ${page}: ${String(err).slice(0, 120)}`);
      // Continue to next page on error — don't abort entire fetch
    }

    page++;

    // Safety: cap at 500 pages (50K entities) to avoid runaway fetches
    if (page >= 500) {
      console.log('[SAM] Reached page limit (500), stopping');
      break;
    }
  }

  console.log(`[SAM] Fetched ${allEntities.length.toLocaleString()} entities across ${page} pages`);
  return allEntities;
}

/**
 * Extract the primary NAICS code from a SAM entity.
 * Prefers the explicit primaryNaics field, falls back to first in list.
 */
function extractNaicsCode(entity: SamEntity): string | null {
  const assertions = entity.assertions;
  if (!assertions?.goodsAndServices) return null;

  if (assertions.goodsAndServices.primaryNaics) {
    return assertions.goodsAndServices.primaryNaics;
  }

  const naicsList = assertions.goodsAndServices.naicsList;
  if (naicsList && naicsList.length > 0) {
    return naicsList[0].naicsCode;
  }

  return null;
}

/**
 * Extract NAICS description from a SAM entity.
 */
function extractNaicsDescription(entity: SamEntity): string | null {
  const naicsList = entity.assertions?.goodsAndServices?.naicsList;
  if (!naicsList || naicsList.length === 0) return null;

  const primaryCode = entity.assertions?.goodsAndServices?.primaryNaics;
  if (primaryCode) {
    const match = naicsList.find(n => n.naicsCode === primaryCode);
    if (match?.naicsDescription) return match.naicsDescription;
  }

  return naicsList[0]?.naicsDescription || null;
}

/**
 * Extract business types as a JSON string.
 */
function extractBusinessTypes(entity: SamEntity): string | null {
  const btList = entity.coreData?.businessTypes?.businessTypeList;
  if (!btList || btList.length === 0) return null;
  return JSON.stringify(btList.map(bt => bt.businessTypeDesc));
}

/**
 * Insert SAM records into raw_records in batches.
 */
async function insertSamRecords(entities: SamEntity[], runId: string): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    const batch = entities.slice(i, i + BATCH_SIZE).map(entity => {
      const reg = entity.entityRegistration;
      const phys = entity.coreData?.physicalAddress;
      const addressParts = [phys?.addressLine1, phys?.addressLine2].filter(Boolean);

      return {
        source: 'sam_gov' as const,
        sourceRunId: runId,
        sourceRecordId: `sam_${reg.ueiSAM}`,
        rawName: reg.legalBusinessName || reg.dbaName || null,
        rawAddress: addressParts.length > 0 ? addressParts.join(', ') : null,
        rawCity: phys?.city || null,
        rawState: phys?.stateOrProvinceCode || null,
        rawZip: phys?.zipCode || null,
        rawNaicsCode: extractNaicsCode(entity),
        rawNaicsDescription: extractNaicsDescription(entity),
        samCageCode: reg.cageCode || null,
        samUeiNumber: reg.ueiSAM || null,
        samBusinessTypes: extractBusinessTypes(entity),
        rawJson: null,
      };
    });

    try {
      await db.insert(rawRecords).values(batch);
      inserted += batch.length;
    } catch (err) {
      errors.push(`Batch insert error at offset ${i}: ${err}`);
    }

    updateProgress('fetching', 60 + Math.round((i / entities.length) * 30),
      `Inserting SAM.gov records... ${inserted.toLocaleString()}`);
  }

  return { inserted, errors };
}

/**
 * Full SAM.gov fetch pipeline.
 */
export async function fetchSamGov(runId: string): Promise<SamGovFetchResult> {
  const startTime = Date.now();
  const apiKey = process.env.SAM_GOV_API_KEY;

  if (!apiKey) {
    console.log('[SAM] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[SAM] No SAM_GOV_API_KEY environment variable found.');
    console.log('[SAM] To use the SAM.gov connector:');
    console.log('[SAM]   1. Register at https://sam.gov/content/home');
    console.log('[SAM]   2. Request a public API key from https://open.gsa.gov/api/entity-api/');
    console.log('[SAM]   3. Set SAM_GOV_API_KEY in your .env file');
    console.log('[SAM]   4. Re-run this sync');
    console.log('[SAM] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'completed',
      completedAt: new Date(),
      totalFetched: 0,
      newRecords: 0,
      errorCount: 1,
      errorLog: JSON.stringify(['No SAM_GOV_API_KEY — set the environment variable and re-sync']),
      durationMs,
    }).where(eq(sourceRuns.id, runId));

    return { totalFetched: 0, inserted: 0, errors: ['No SAM_GOV_API_KEY configured'] };
  }

  try {
    await db.update(sourceRuns).set({ status: 'fetching' }).where(eq(sourceRuns.id, runId));

    // Fetch all pages
    const allEntities = await fetchAllSamEntities(apiKey);

    if (allEntities.length === 0) {
      const durationMs = Date.now() - startTime;
      await db.update(sourceRuns).set({
        status: 'completed',
        completedAt: new Date(),
        totalFetched: 0,
        newRecords: 0,
        errorCount: 1,
        errorLog: JSON.stringify(['SAM.gov returned 0 entities — check API key permissions']),
        durationMs,
      }).where(eq(sourceRuns.id, runId));
      return { totalFetched: 0, inserted: 0, errors: ['No entities returned'] };
    }

    // Deduplicate by UEI
    const seen = new Map<string, SamEntity>();
    for (const entity of allEntities) {
      const uei = entity.entityRegistration.ueiSAM;
      if (uei && !seen.has(uei)) {
        seen.set(uei, entity);
      }
    }
    const unique = Array.from(seen.values());
    console.log(`[SAM] ${allEntities.length} raw → ${unique.length} unique entities`);

    // Insert
    const { inserted, errors } = await insertSamRecords(unique, runId);

    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'completed',
      completedAt: new Date(),
      totalFetched: unique.length,
      newRecords: inserted,
      errorCount: errors.length,
      errorLog: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      durationMs,
    }).where(eq(sourceRuns.id, runId));

    console.log(`[SAM] Fetch complete in ${(durationMs / 1000).toFixed(1)}s: ${inserted} inserted`);
    return { totalFetched: unique.length, inserted, errors };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await db.update(sourceRuns).set({
      status: 'failed',
      completedAt: new Date(),
      errorLog: JSON.stringify([String(err)]),
      durationMs,
    }).where(eq(sourceRuns.id, runId));
    throw err;
  }
}
