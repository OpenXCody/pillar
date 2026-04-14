/**
 * NAICS Code Validation and SIC-NAICS Crosswalk
 */

import { isManufacturingNaics, getNaicsDescription } from '@shared/naics.js';

/**
 * Validate and clean a NAICS code.
 * Returns the code if valid manufacturing, null otherwise.
 */
export function validateNaicsCode(raw: string | null): string | null {
  if (!raw) return null;

  // Clean: remove whitespace, take first code if multiple
  const cleaned = raw.trim().split(/[\s,]+/)[0];

  // Must be 2-6 digits
  if (!/^\d{2,6}$/.test(cleaned)) return null;

  // Must be manufacturing
  if (!isManufacturingNaics(cleaned)) return null;

  return cleaned;
}

/**
 * Get a human-readable description for a NAICS code.
 */
export function describeNaics(code: string | null): string | null {
  if (!code) return null;
  const desc = getNaicsDescription(code);
  return desc !== `NAICS ${code}` ? desc : null;
}

export { isManufacturingNaics };
