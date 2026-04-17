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
  //   "275 MATHILDA LLC-ICOP" (allow -TAIL after corp suffix)
  //   "3105 W 27TH LLC" (allow digits in body)
  new RegExp(`^\\d{3,}\\s+[A-Za-z][A-Za-z0-9 .,'&/-]{0,40}\\s+(${CORP_SUFFIX})([-\\s][A-Za-z0-9]+)*\\s*$`, 'i'),

  // "NxM" dimension-style prefix + RE signal: "20X24 HOLDINGS LLC"
  new RegExp(`^\\d+\\s*[xX×]\\s*\\d+\\s+.*\\b(${REAL_ESTATE_SIGNALS})\\b`, 'i'),

  // Government fleet management:
  //   "39TH LSD - CITY OF CHICAGO FLEET MGMT"
  /\bCITY OF [A-Z]+\s+FLEET\s+(MGMT|MANAGEMENT)\b/i,

  // Standalone driveways / gravel yards:
  //   "38 CABOT BLVD GRAVEL DRIVEWAY"
  /\bGRAVEL\s+(DRIVEWAY|YARD|LOT|PIT)\b/i,

  // Just "<digits> <digits> LLC" or "<digits> LLC" — pure numeric stub.
  //   "1855 LLC" / "300 LLC" / "999 INC"
  new RegExp(`^\\d{2,}(\\s+\\d+)*\\s+(${CORP_SUFFIX})\\s*$`, 'i'),

  // Ordinal-street pattern: "34TH STREET LLC", "240TH ST LLC",
  // "156TH COMMERCIAL AVENUE LLC" (street word may be 1-2 tokens away).
  new RegExp(`^\\d{1,4}(ST|ND|RD|TH)\\s+([A-Z][A-Za-z]*\\s+){0,2}(${STREET_WORDS})\\b`, 'i'),

  // Slash- or dash-separated address numbers: "10/120 S Riverside Plaza LLC",
  // "1611-1621 Lakeland Avenue"
  new RegExp(`^\\d+[/\\\\-]\\d+.*\\b(${CORP_SUFFIX})\\b`, 'i'),

  // "(FORMER ...)" — defunct operation that should not appear in a live
  // manufacturing map.
  /^\(FORMER\b/i,

  // Trailing "FORMER" / "(FORMER)" — defunct facility markers with
  // no successor name. Distinct from "(FORMER ROCKETDYNE)" parenthetical
  // which is a historical reference on a still-operating site.
  /(^|\s)FORMER\s*$/i,
  /\(FORMER\)\s*$/i,

  // Trailing "- COMPLAINT" / "- INCIDENT" / "- RESPONSE" — EPA regulatory
  // filing markers, not actual manufacturing facilities.
  /-\s*(COMPLAINT|INCIDENT|RESPONSE|INVESTIGATION|CLAIM|VIOLATION)\s*$/i,

  // Asphalt / cement / mixing plant equipment codes:
  //   "180TPH HMAP, GCP3-3857" (180 tons/hour Hot Mix Asphalt Plant)
  //   "200TPH HMA PLANT - GCP3-9078"
  //   "96-00 ASPHALT MIXING PLANT, GCP3-3242"
  /^\d+[\s-]*(TPH|T\.P\.H\.)\b/i,
  /\bGCP\d+-\d+/i,
  /^\d+-\d+\s+ASPHALT\s+MIXING\s+PLANT/i,

  // Small business patterns that slipped through NAICS:
  //   "151 TIRE SYSTEMS" (tire shop, not mfg)
  //   "2 & 92 TRUCK PARTS INC"
  //   "#411 - FOUNTAIN VALLEY" (gas station chain)
  /^\d+\s+TIRE\s+(SYSTEMS|SERVICES|CENTER|CO|INC|LLC|SHOP)\b/i,
  /\bTRUCK\s+PARTS\s+(INC|LLC|CORP|CO)\b/i,
  /^#\d+\s*[-–]\s*[A-Z]/i,
  /^#\d+\s*$/,

  // Pure 1-3 digit company names ("1", "011") — no useful identity.
  /^\d{1,3}\s*$/,

  // "AZ DOT" / "CA DOT" / "TX DOT" — state DOT facilities.
  /\b(AZ|CA|TX|FL|NY|IL|OH|GA|WA|OR|CO|PA|MI|NJ|VA|NC)\s+DOT\b/i,

  // 2-digit house# + real-estate signal (narrower than the 3-digit
  // pattern; only fires when there's an explicit RE keyword so we
  // don't collide with "4 WAY ELECTRIC INC"-type real companies).
  new RegExp(`^\\d{1,2}\\s+[A-Za-z][A-Za-z .,'&/-]{0,40}\\b(${REAL_ESTATE_SIGNALS})\\b`, 'i'),

  // Pure numeric name + corporate suffix: "713, INC", "1859, INC", "300 LLC"
  /^\d+\s*,?\s*(LLC|L\.L\.C\.|INC|INC\.|CORP|CORP\.|LP|L\.P\.|LTD)\.?\s*$/i,

  // Equipment / regulated-unit code as name suffix. EPA attaches these
  // for specific emission sources. "(VES/STRIPPER)", "(RTO 1)", etc.
  /\((VES|STRIPPER|TANK|GENSET|TOWER|KILN|BOILER|FURNACE|INCINERATOR|SCRUBBER|REACTOR|RTO|FGD|ESP|SCR|DRUM|BAGHOUSE|FLARE)[\s/0-9]*[^)]*\)\s*$/i,

  // Landfill / wastewater treatment — infrastructure, not mfg. Exclude
  // WASTE MANAGEMENT parent co names (those are the service company,
  // already caught by the TRUCKING/HAULING patterns elsewhere).
  /\bLANDFILL\s*$/i,
  /\b(WASTEWATER\s+TREATMENT|WASTEWATER\s+PLANT|WWTP|WASTE\s+TREATMENT\s+(PLANT|FACILITY))\b/i,

  // "X, CITY OF" / "X, VILLAGE OF" / "X, TOWN OF" — reversed-form
  // government entities ("ARKADELPHIA, CITY OF", "BECKEMEYER, VILLAGE OF").
  /,\s*(CITY|TOWN|VILLAGE|BOROUGH|TOWNSHIP)\s+OF\s*$/i,

  // "COUNTY OF X" / specific government prefixes that aren't private mfg.
  /^COUNTY\s+OF\s+[A-Z]/i,
  /^(U\.?S\.?\s+)?(NATIONAL GUARD|US NAVY|US AIR FORCE|US ARMY)\s+-\s*/i,
  // Public housing, recreation centers, parks
  /\b(RECREATION CENTER|COMMUNITY CENTER|SENIOR CENTER|PUBLIC HOUSING|HOUSING AUTHORITY)\b/i,

  // Waste-management service operators. Covers BFI, Allied Waste, WM,
  // Republic Services, "Waste Systems of North America" style names.
  /\bWASTE\s+(SYSTEMS|SERVICES|MANAGEMENT|MGT|MGMT|INDUSTRIES)\s+OF\b/i,
  /^(BFI|WM|ALLIED|REPUBLIC|WASTE MANAGEMENT)\s+.*\bWASTE\b/i,

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

  // Bare "TRUCKING" / "HAULING" as standalone word — catches "Arm Trucking",
  // "70 W Trucking" that lack corporate suffix. These never appear in real
  // mfg names.
  /\bTRUCKING\b/i,
  /\bHAULING\b/i,

  // Specific service categories that uniquely identify non-mfg:
  /\bPEST\s+CONTROL\b/i,
  /\bELEVATOR\s+SERVICE\b/i,
  /\bRAIL\s+SERVICE\b/i,
  /\bSEALING\s+SERVICES?\b/i,
  /\bJANITORIAL\s+(SERVICE|SERVICES|CO|INC|LLC)\b/i,
  /\bEXTERMINATOR\b/i,
  /\bLAWN\s+CARE\b/i,
  /\bSECURITY\s+(SERVICE|SERVICES|GUARD)\b/i,
  /\b(FENCE|FENCING)\s+(CO|CORP|INC|LLC)\b/i,
  /\bCATERING\s+(CO|INC|LLC|SERVICE)\b/i,
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
  `^\\d{3,}\\s+[A-Za-z][A-Za-z0-9 .,'&/-]{0,40}\\s+(${CORP_SUFFIX})([-\\s][A-Za-z0-9]+)*\\s*$`,
  `^\\d+\\s*[xX×]\\s*\\d+\\s+.*\\y(${REAL_ESTATE_SIGNALS})\\y`,
  `\\yCITY OF [A-Z]+\\s+FLEET\\s+(MGMT|MANAGEMENT)\\y`,
  `\\yGRAVEL\\s+(DRIVEWAY|YARD|LOT|PIT)\\y`,
  `^\\d{2,}(\\s+\\d+)*\\s+(${CORP_SUFFIX})\\s*$`,
  `^\\d{1,4}(ST|ND|RD|TH)\\s+([A-Z][A-Za-z]*\\s+){0,2}(${STREET_WORDS})\\y`,
  `^\\d+[/\\\\-]\\d+.*\\y(${CORP_SUFFIX})\\y`,
  `^\\(FORMER\\y`,
  `(^|\\s)FORMER\\s*$`,
  `\\(FORMER\\)\\s*$`,
  `-\\s*(COMPLAINT|INCIDENT|RESPONSE|INVESTIGATION|CLAIM|VIOLATION)\\s*$`,
  `^\\d+[\\s-]*(TPH|T\\.P\\.H\\.)\\y`,
  `\\yGCP\\d+-\\d+`,
  `^\\d+-\\d+\\s+ASPHALT\\s+MIXING\\s+PLANT`,
  `^\\d+\\s+TIRE\\s+(SYSTEMS|SERVICES|CENTER|CO|INC|LLC|SHOP)\\y`,
  `\\yTRUCK\\s+PARTS\\s+(INC|LLC|CORP|CO)\\y`,
  `^#\\d+\\s*[-–]\\s*[A-Z]`,
  `^#\\d+\\s*$`,
  `^\\d{1,3}\\s*$`,
  `\\y(AZ|CA|TX|FL|NY|IL|OH|GA|WA|OR|CO|PA|MI|NJ|VA|NC)\\s+DOT\\y`,
  `^\\d{1,2}\\s+[A-Za-z][A-Za-z .,'&/-]{0,40}\\y(${REAL_ESTATE_SIGNALS})\\y`,
  `^\\d+\\s*,?\\s*(LLC|L\\.L\\.C\\.|INC|INC\\.|CORP|CORP\\.|LP|L\\.P\\.|LTD)\\.?\\s*$`,
  `\\((VES|STRIPPER|TANK|GENSET|TOWER|KILN|BOILER|FURNACE|INCINERATOR|SCRUBBER|REACTOR|RTO|FGD|ESP|SCR|DRUM|BAGHOUSE|FLARE)[\\s/0-9]*[^)]*\\)\\s*$`,
  `\\yLANDFILL\\s*$`,
  `\\y(WASTEWATER\\s+TREATMENT|WASTEWATER\\s+PLANT|WWTP|WASTE\\s+TREATMENT\\s+(PLANT|FACILITY))\\y`,
  `,\\s*(CITY|TOWN|VILLAGE|BOROUGH|TOWNSHIP)\\s+OF\\s*$`,
  `^COUNTY\\s+OF\\s+[A-Z]`,
  `\\y(RECREATION CENTER|COMMUNITY CENTER|SENIOR CENTER|PUBLIC HOUSING|HOUSING AUTHORITY)\\y`,
  `\\yWASTE\\s+(SYSTEMS|SERVICES|MANAGEMENT|MGT|MGMT|INDUSTRIES)\\s+OF\\y`,
  `^(BFI|WM|ALLIED|REPUBLIC|WASTE MANAGEMENT)\\s+.*\\yWASTE\\y`,
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
  `\\yTRUCKING\\y`,
  `\\yHAULING\\y`,
  `\\yPEST\\s+CONTROL\\y`,
  `\\yELEVATOR\\s+SERVICE\\y`,
  `\\yRAIL\\s+SERVICE\\y`,
  `\\ySEALING\\s+SERVICES?\\y`,
  `\\yJANITORIAL\\s+(SERVICE|SERVICES|CO|INC|LLC)\\y`,
  `\\yEXTERMINATOR\\y`,
  `\\yLAWN\\s+CARE\\y`,
  `\\ySECURITY\\s+(SERVICE|SERVICES|GUARD)\\y`,
  `\\y(FENCE|FENCING)\\s+(CO|CORP|INC|LLC)\\y`,
  `\\yCATERING\\s+(CO|INC|LLC|SERVICE)\\y`,
];

export const EPA_PREFIX_PG = `^\\d+\\s*-\\s*[A-Z]`;
export const DBA_PG = `\\yDBA\\y`;
