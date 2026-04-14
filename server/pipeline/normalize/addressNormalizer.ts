/**
 * Address Normalization
 *
 * Standardizes street addresses for consistent matching across sources.
 */

const STREET_TYPE_MAP: Record<string, string> = {
  'ST': 'STREET', 'ST.': 'STREET',
  'AVE': 'AVENUE', 'AVE.': 'AVENUE',
  'BLVD': 'BOULEVARD', 'BLVD.': 'BOULEVARD',
  'DR': 'DRIVE', 'DR.': 'DRIVE',
  'RD': 'ROAD', 'RD.': 'ROAD',
  'LN': 'LANE', 'LN.': 'LANE',
  'CT': 'COURT', 'CT.': 'COURT',
  'CIR': 'CIRCLE', 'CIR.': 'CIRCLE',
  'PL': 'PLACE', 'PL.': 'PLACE',
  'TER': 'TERRACE', 'TERR': 'TERRACE',
  'PKY': 'PARKWAY', 'PKWY': 'PARKWAY',
  'HWY': 'HIGHWAY', 'HWY.': 'HIGHWAY',
  'FWY': 'FREEWAY',
  'TPKE': 'TURNPIKE', 'TPK': 'TURNPIKE',
  'WAY': 'WAY',
  'TRL': 'TRAIL',
  'SQ': 'SQUARE',
};

const DIRECTIONAL_MAP: Record<string, string> = {
  'N': 'NORTH', 'N.': 'NORTH',
  'S': 'SOUTH', 'S.': 'SOUTH',
  'E': 'EAST', 'E.': 'EAST',
  'W': 'WEST', 'W.': 'WEST',
  'NE': 'NORTHEAST', 'NE.': 'NORTHEAST',
  'NW': 'NORTHWEST', 'NW.': 'NORTHWEST',
  'SE': 'SOUTHEAST', 'SE.': 'SOUTHEAST',
  'SW': 'SOUTHWEST', 'SW.': 'SOUTHWEST',
};

/**
 * Normalize a street address for consistent comparison.
 * Returns uppercase, expanded abbreviations, no suite/unit numbers.
 */
export function normalizeAddress(raw: string | null): string | null {
  if (!raw) return null;

  let addr = raw.toUpperCase().trim();

  // Remove suite/unit/apt numbers (for matching purposes only)
  addr = addr.replace(/\b(SUITE|STE|UNIT|APT|#|ROOM|RM|BLDG|BUILDING|FLOOR|FL)\s*\.?\s*\S+/gi, '');

  // Expand directionals (must be word-bounded to avoid false positives)
  for (const [abbr, full] of Object.entries(DIRECTIONAL_MAP)) {
    const pattern = new RegExp(`\\b${abbr.replace('.', '\\.')}\\b`, 'g');
    addr = addr.replace(pattern, full);
  }

  // Expand street types (typically at end of address)
  const words = addr.split(/\s+/);
  const expanded = words.map(word => {
    const clean = word.replace(/[.,]$/, '');
    return STREET_TYPE_MAP[clean] || word;
  });
  addr = expanded.join(' ');

  // Collapse whitespace
  addr = addr.replace(/\s+/g, ' ').trim();

  return addr || null;
}

/**
 * Normalize a city name: trim, uppercase, clean common variations.
 */
export function normalizeCity(raw: string | null): string | null {
  if (!raw) return null;
  return raw.toUpperCase().trim().replace(/\s+/g, ' ') || null;
}

/**
 * Normalize a ZIP code to 5-digit format.
 */
export function normalizeZip(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^0-9-]/g, '');
  // Take first 5 digits
  const fiveDigit = cleaned.split('-')[0];
  if (fiveDigit.length === 5) return fiveDigit;
  if (fiveDigit.length > 5) return fiveDigit.substring(0, 5);
  return null;
}

/**
 * Get the 3-digit ZIP prefix (used for blocking in matching).
 */
export function getZipPrefix(zip: string | null): string | null {
  if (!zip || zip.length < 3) return null;
  return zip.substring(0, 3);
}
