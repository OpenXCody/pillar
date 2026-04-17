// Detects "address-stub" facility/company names: property-owner LLCs,
// street-named shell entities, and similar real-estate artifacts that
// masquerade as manufacturers in EPA ECHO and related federal datasets.
//
// The cost of a false positive (dropping a real manufacturer whose name
// happens to start with a house number) is much lower than the cost of
// showing an obvious address-stub in a demo. Bias: aggressive drop.
//
// Used by:
//   - Pillar ECHO connector (reject at ingest)
//   - Archangel import-pillar-bulk (reject on re-import)
//   - Archangel one-off cleanup script (purge existing rows)

const STREET_WORDS = [
  'AVENUE', 'AVE',
  'STREET', 'ST',
  'ROAD', 'RD',
  'DRIVE', 'DR',
  'LANE', 'LN',
  'WAY',
  'BLVD', 'BOULEVARD',
  'COURT', 'CT',
  'CIRCLE', 'CIR',
  'CRESCENT',
  'PLACE', 'PL',
  'PARKWAY', 'PKWY',
  'TERRACE',
  'TRAIL',
  'HIGHWAY', 'HWY',
  'ROUTE', 'RTE',
  'SQUARE', 'SQ',
  'MEWS',
  'POINT', 'PT',
  'ALLEY',
  'WALK',
  'ROW',
  'LOOP',
  'RUN',
  'PASS',
  'CROSSING',
  'PLAZA',
].join('|');

const REAL_ESTATE_SIGNALS = [
  'ASSOCIATES', 'ASSOCIATION',
  'PARTNERS', 'PARTNERSHIP',
  'VENTURES', 'VENTURE',
  'INVESTORS', 'INVESTMENT', 'INVESTMENTS',
  'HOLDINGS',
  'PROPERTIES', 'PROPERTY',
  'REALTY', 'REAL ESTATE',
  'OWNER', 'OWNERS',
  'TENANTS',
  'LANDLORD',
  'LESSOR',
].join('|');

const CORP_SUFFIX = `LLC|L\\.L\\.C\\.|INC|INC\\.|CORP|CORP\\.|CORPORATION|LP|L\\.P\\.|LTD|LIMITED|CO\\.?|COMPANY`;

// Pattern groups. PostgreSQL uses \y for word boundary; JavaScript uses \b.
// We keep both exports for callers to choose based on engine.
export const ADDRESS_STUB_PATTERNS_JS: RegExp[] = [
  // Explicit "PROPERTY OWNER" / "OWNR" / "PROPERTY HOLDER" anywhere.
  /\bPROPERTY\s+(OWNER|OWNR|HOLDER)S?\b/i,

  // House-number + "@" indicator (site-at-business-park stubs).
  //   "1 COMMERCE DRIVE @ BARRINGTON BUSINESS CENTER"
  //   "410 OBERLIN AVENUE SOUTH BLDG @ LAKEWOOD IND CAMPUS"
  /^\d+\s+.+@/,

  // House-number + street-word anywhere in the name.
  //   "1015 SHARY CIRCLE, CONCORD CA"
  //   "3821 RIVER RD INC"
  //   "100 N CRESCENT LLC"
  new RegExp(`^\\d{3,}\\s+.*\\b(${STREET_WORDS})\\b`, 'i'),

  // House-number + real-estate-signal word.
  //   "2700 REAL ESTATE HOLDINGS"
  //   "850 ASSOCIATES LLC"
  //   "111 W 7 OWNER LLC"
  new RegExp(`^\\d{3,}\\s+.*\\b(${REAL_ESTATE_SIGNALS})\\b`, 'i'),

  // House-number + short name + corporate suffix at end.
  //   "10218 TOLUCA LLC"
  //   "1116 MURPHY LLC"
  //   "100 SOUTH LA BREA LLC"
  //   "1855 LLC"
  new RegExp(`^\\d{3,}\\s+[A-Za-z][A-Za-z .,'&/-]{0,40}\\s+(${CORP_SUFFIX})\\s*$`, 'i'),

  // Just "<digits> <digits> LLC" or "<digits> LLC" — pure numeric stub.
  //   "1855 LLC" / "300 LLC" / "999 INC"
  new RegExp(`^\\d{2,}(\\s+\\d+)*\\s+(${CORP_SUFFIX})\\s*$`, 'i'),

  // Ordinal-street pattern: "34TH STREET LLC", "240TH ST LLC"
  /^\d{1,4}(ST|ND|RD|TH)\s+(STREET|ST|AVENUE|AVE)\b/i,

  // Slash- or dash-separated address numbers: "10/120 S Riverside Plaza LLC",
  // "1611-1621 Lakeland Avenue"
  new RegExp(`^\\d+[/\\\\-]\\d+.*\\b(${CORP_SUFFIX})\\b`, 'i'),

  // "(FORMER ...)" — defunct operation that should not appear in a live
  // manufacturing map.
  /^\(FORMER\b/i,

  // Service-business patterns. Keeping this tight — each regex needs
  // to rarely fire on real manufacturers. Generic words like "roofing",
  // "transmission", "parts", and "truck" are intentionally NOT solo
  // keywords because they collide with real mfg (Atlas Roofing makes
  // shingles, Mack makes trucks, "Parts Co" can be a parts manufacturer).
  /\bAUTO\s+(REPAIR|BODY|REPAIRING|SALES|SVC|DEALER|DEALERSHIP|DETAIL|TIRE|GLASS)\b/i,
  /\b(TRUCK|AUTO)\s+REPAIR\b/i,
  /\b(TRUCKING|HAULING|FREIGHT)\s+(CO|CORP|INC|LLC|LTD|SERVICES?|LINE|LINES)\b/i,
  /\b(GAS|SERVICE|FUEL)\s+STATION\b/i,
  /\b(FUEL\s+(STOP|MART)|TRUCK\s+STOP|CAR\s+WASH|TRAVEL\s+(CENTER|CENTRE))\b/i,
  /\b(DRY\s+CLEAN|DRY\s+CLEANERS|LAUNDRY)\s+(CO|LLC|INC|SERVICES?)\b/i,
  /\b(SELF|MINI|PUBLIC)\s+STORAGE\b/i,
  /\bRECYCLING\s+(CENTER|INC|CORP|LLC)\b/i,
  /\b(DISPOSAL|SALVAGE|JUNK|LANDFILL)\s+(CO|CORP|INC|LLC|SERVICES?)\b/i,
  /\b(PAINTING|LANDSCAPING|PAVING|EXCAVATING|EXCAVATION)\s+(CONTRACTOR|CONTRACTORS|CO|CORP|INC|LLC|SERVICES?)\b/i,
  /\bASPHALT\s+CONTRACTORS\b/i,
  /\b(RENTAL|RENTALS|LEASING)\s+(CO|CORP|INC|LLC|SERVICES?)\b/i,
  /\b(FORMER|CLOSED|ABANDONED|DEFUNCT|DEMOLISHED)\s+(FACILITY|PLANT|SITE|LOCATION|OPERATION)\b/i,
  /-\s*FORMER\s+SITE\s+OF\b/i,
  /\bMOBIL\s+(SERVICE|STATION)\b/i,
  /\b(DAY\s+PARTS)\s+(INC|CORP|LLC|CO)\b/i,
];

// EPA registry-prefix format: "95578 - CATERPILLAR INC". The bare digits
// at the start look like a house number but the "- NAME" tail is a real
// company. Preserve these rows; the display-layer formatter strips the
// prefix.
const EPA_PREFIX_JS = /^\d+\s*-\s*[A-Z]/;

// "DBA <real company>" — always a real operating business at that address.
const DBA_JS = /\bDBA\b/i;

/**
 * True if the given facility name looks like an address-stub / property
 * holder / shell LLC that should be rejected from the manufacturing
 * dataset.
 */
export function isAddressStub(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;

  // Protect rows that clearly name a real operating business.
  if (EPA_PREFIX_JS.test(trimmed)) return false;
  if (DBA_JS.test(trimmed)) return false;

  return ADDRESS_STUB_PATTERNS_JS.some((re) => re.test(trimmed));
}

// PostgreSQL-engine regexes (use \y for word boundary). Exported as raw
// strings so SQL scripts can substitute them into `~` operators.
export const ADDRESS_STUB_PATTERNS_PG: string[] = [
  `\\yPROPERTY\\s+(OWNER|OWNR|HOLDER)S?\\y`,
  `^\\d+\\s+.+@`,
  `^\\d{3,}\\s+.*\\y(${STREET_WORDS})\\y`,
  `^\\d{3,}\\s+.*\\y(${REAL_ESTATE_SIGNALS})\\y`,
  `^\\d{3,}\\s+[A-Za-z][A-Za-z .,'&/-]{0,40}\\s+(${CORP_SUFFIX})\\s*$`,
  `^\\d{2,}(\\s+\\d+)*\\s+(${CORP_SUFFIX})\\s*$`,
  `^\\d{1,4}(ST|ND|RD|TH)\\s+(STREET|ST|AVENUE|AVE)\\y`,
  `^\\d+[/\\\\-]\\d+.*\\y(${CORP_SUFFIX})\\y`,
  `^\\(FORMER\\y`,
  // Service-business patterns — tightened to avoid real-mfg collisions:
  `\\yAUTO\\s+(REPAIR|BODY|REPAIRING|SALES|SVC|DEALER|DEALERSHIP|DETAIL|TIRE|GLASS)\\y`,
  `\\y(TRUCK|AUTO)\\s+REPAIR\\y`,
  `\\y(TRUCKING|HAULING|FREIGHT)\\s+(CO|CORP|INC|LLC|LTD|SERVICES?|LINE|LINES)\\y`,
  `\\y(GAS|SERVICE|FUEL)\\s+STATION\\y`,
  `\\y(FUEL\\s+(STOP|MART)|TRUCK\\s+STOP|CAR\\s+WASH|TRAVEL\\s+(CENTER|CENTRE))\\y`,
  `\\y(DRY\\s+CLEAN|DRY\\s+CLEANERS|LAUNDRY)\\s+(CO|LLC|INC|SERVICES?)\\y`,
  `\\y(SELF|MINI|PUBLIC)\\s+STORAGE\\y`,
  `\\yRECYCLING\\s+(CENTER|INC|CORP|LLC)\\y`,
  `\\y(DISPOSAL|SALVAGE|JUNK|LANDFILL)\\s+(CO|CORP|INC|LLC|SERVICES?)\\y`,
  `\\y(PAINTING|LANDSCAPING|PAVING|EXCAVATING|EXCAVATION)\\s+(CONTRACTOR|CONTRACTORS|CO|CORP|INC|LLC|SERVICES?)\\y`,
  `\\yASPHALT\\s+CONTRACTORS\\y`,
  `\\y(RENTAL|RENTALS|LEASING)\\s+(CO|CORP|INC|LLC|SERVICES?)\\y`,
  `\\y(FORMER|CLOSED|ABANDONED|DEFUNCT|DEMOLISHED)\\s+(FACILITY|PLANT|SITE|LOCATION|OPERATION)\\y`,
  `-\\s*FORMER\\s+SITE\\s+OF\\y`,
  `\\yMOBIL\\s+(SERVICE|STATION)\\y`,
  `\\y(DAY\\s+PARTS)\\s+(INC|CORP|LLC|CO)\\y`,
];

export const EPA_PREFIX_PG = `^\\d+\\s*-\\s*[A-Z]`;
export const DBA_PG = `\\yDBA\\y`;
