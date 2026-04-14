/**
 * Name Normalization
 *
 * Cleans facility and company names from raw records.
 * Uses the shared companyNormalization system from Archangel,
 * extended with additional rules for the EPA/OSHA universe.
 */

import {
  normalizeCompanyName,
  cleanCompanyName,
  extractCompanyFromFacilityName,
  isBlockedCompanyName,
} from '@shared/companyNormalization.js';

export interface NormalizedNames {
  facilityName: string;
  companyName: string | null;
}

/**
 * Normalize a facility name: trim, collapse whitespace, remove artifacts.
 */
/** Decode common HTML entities that appear in federal data */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&AMP;/gi, '&')
    .replace(/&LT;/gi, '<')
    .replace(/&GT;/gi, '>')
    .replace(/&QUOT;/gi, '"')
    .replace(/&APOS;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code)));
}

export function normalizeFacilityName(raw: string | null): string | null {
  if (!raw) return null;

  let name = decodeHtmlEntities(raw)
    .trim()
    .replace(/\s+/g, ' ')
    // Remove trailing punctuation artifacts
    .replace(/[,;.]+$/, '')
    // Remove parenthetical location duplicates like "BOEING (EVERETT)"
    // but keep meaningful ones like "DIVISION (AEROSPACE)"
    .trim();

  return name || null;
}

/**
 * Extract and normalize a company name from available data.
 *
 * Priority:
 * 1. TRI parent company name (cleanest source)
 * 2. Extract from facility name (pattern-based)
 * 3. Facility name itself as fallback (cleaned)
 */
export function resolveCompanyName(
  triParentCompany: string | null,
  facilityName: string | null,
): string | null {
  // TRI parent company is the best source
  if (triParentCompany) {
    const normalized = normalizeCompanyName(triParentCompany);
    if (normalized && !isBlockedCompanyName(normalized)) return normalized;
  }

  // Try to extract from facility name
  if (facilityName) {
    const extracted = extractCompanyFromFacilityName(facilityName);
    if (extracted && !isBlockedCompanyName(extracted)) return extracted;

    // Last resort: try normalizing the facility name itself
    // (only works if the facility is named after the company)
    const normalized = normalizeCompanyName(facilityName);
    const cleaned = cleanCompanyName(facilityName);
    if (normalized && normalized !== cleaned) {
      // The normalizer matched a known company pattern
      return normalized;
    }
  }

  return null;
}

export { normalizeCompanyName, cleanCompanyName };
