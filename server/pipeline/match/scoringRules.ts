/**
 * Scoring Rules for facility matching.
 *
 * Composite score from 4 factors:
 * - Name similarity (35%)
 * - Geographic proximity (30%)
 * - Address match (20%)
 * - NAICS match (15%)
 */

import levenshtein from 'fast-levenshtein';
const levenshteinDistance = levenshtein.get;
import { haversineDistance } from '../normalize/geoValidator.js';
import { normalizeAddress, normalizeCity } from '../normalize/addressNormalizer.js';

export interface ScoreBreakdown {
  nameScore: number;
  geoScore: number;
  addressScore: number;
  naicsScore: number;
  composite: number;
}

const WEIGHTS = {
  name: 0.35,
  geo: 0.30,
  address: 0.20,
  naics: 0.15,
};

// Thresholds
export const AUTO_MATCH_THRESHOLD = 90;
export const REVIEW_THRESHOLD = 60;

/**
 * Compute name similarity score (0-100).
 * Uses Levenshtein distance normalized to string length.
 */
export function scoreNameSimilarity(nameA: string | null, nameB: string | null): number {
  if (!nameA || !nameB) return 0;

  const a = nameA.toUpperCase().trim();
  const b = nameB.toUpperCase().trim();

  if (a === b) return 100;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const similarity = 1 - (distance / maxLen);

  return Math.round(similarity * 100);
}

/**
 * Compute geographic proximity score (0-100).
 */
export function scoreGeoProximity(
  lat1: string | null, lng1: string | null,
  lat2: string | null, lng2: string | null,
): number {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;

  const la1 = parseFloat(lat1);
  const lo1 = parseFloat(lng1);
  const la2 = parseFloat(lat2);
  const lo2 = parseFloat(lng2);

  if (isNaN(la1) || isNaN(lo1) || isNaN(la2) || isNaN(lo2)) return 0;

  const distMeters = haversineDistance(la1, lo1, la2, lo2);

  if (distMeters < 100) return 100;    // < 100m
  if (distMeters < 500) return 85;     // < 500m
  if (distMeters < 1000) return 60;    // < 1km
  if (distMeters < 5000) return 30;    // < 5km
  return 0;                             // > 5km
}

/**
 * Compute address match score (0-100).
 */
export function scoreAddressMatch(
  addrA: string | null, cityA: string | null, zipA: string | null,
  addrB: string | null, cityB: string | null, zipB: string | null,
): number {
  const normAddrA = normalizeAddress(addrA);
  const normAddrB = normalizeAddress(addrB);
  const normCityA = normalizeCity(cityA);
  const normCityB = normalizeCity(cityB);
  const cleanZipA = zipA?.trim().substring(0, 5);
  const cleanZipB = zipB?.trim().substring(0, 5);

  let score = 0;

  // Street address match
  if (normAddrA && normAddrB && normAddrA === normAddrB) {
    score += 40;
  } else if (normAddrA && normAddrB) {
    // Partial street match using Levenshtein
    const similarity = scoreNameSimilarity(normAddrA, normAddrB);
    score += Math.round(similarity * 0.3);
  }

  // City match
  if (normCityA && normCityB && normCityA === normCityB) {
    score += 30;
  }

  // ZIP match
  if (cleanZipA && cleanZipB && cleanZipA === cleanZipB) {
    score += 30;
  } else if (cleanZipA && cleanZipB && cleanZipA.substring(0, 3) === cleanZipB.substring(0, 3)) {
    score += 15;
  }

  return Math.min(score, 100);
}

/**
 * Compute NAICS code match score (0-100).
 */
export function scoreNaicsMatch(naicsA: string | null, naicsB: string | null): number {
  if (!naicsA || !naicsB) return 0;

  // Exact 6-digit match
  if (naicsA === naicsB) return 100;

  // 4-digit prefix match
  if (naicsA.substring(0, 4) === naicsB.substring(0, 4)) return 70;

  // 3-digit subsector match
  if (naicsA.substring(0, 3) === naicsB.substring(0, 3)) return 50;

  // 2-digit sector match (both manufacturing)
  if (naicsA.substring(0, 2) === naicsB.substring(0, 2)) return 30;

  return 0;
}

/**
 * Compute composite match score from all factors.
 */
export function computeCompositeScore(
  recordA: { rawName: string | null; rawLatitude: string | null; rawLongitude: string | null; rawAddress: string | null; rawCity: string | null; rawZip: string | null; rawNaicsCode: string | null },
  recordB: { rawName: string | null; rawLatitude: string | null; rawLongitude: string | null; rawAddress: string | null; rawCity: string | null; rawZip: string | null; rawNaicsCode: string | null },
): ScoreBreakdown {
  const nameScore = scoreNameSimilarity(recordA.rawName, recordB.rawName);
  const geoScore = scoreGeoProximity(recordA.rawLatitude, recordA.rawLongitude, recordB.rawLatitude, recordB.rawLongitude);
  const addressScore = scoreAddressMatch(recordA.rawAddress, recordA.rawCity, recordA.rawZip, recordB.rawAddress, recordB.rawCity, recordB.rawZip);
  const naicsScore = scoreNaicsMatch(recordA.rawNaicsCode, recordB.rawNaicsCode);

  const composite = Math.round(
    nameScore * WEIGHTS.name +
    geoScore * WEIGHTS.geo +
    addressScore * WEIGHTS.address +
    naicsScore * WEIGHTS.naics
  );

  return { nameScore, geoScore, addressScore, naicsScore, composite };
}
