/**
 * Company Name Normalization System for Pillar
 *
 * Extended from Archangel's system to handle the much larger universe
 * of companies found in EPA/OSHA/federal data.
 */

export interface CompanyRule {
  patterns: RegExp[];
  canonical: string;
}

export const COMPANY_RULES: CompanyRule[] = [
  // Aerospace & Defense
  { patterns: [/\bBOEING\b/i, /\bTHE\s+BOEING\s+COMPANY\b/i, /\bBOEING\s+CO\.?\b/i], canonical: 'Boeing' },
  { patterns: [/\bLOCKHEED\s*MARTIN\b/i, /\bLOCKHEED\b/i, /\bLMT\b/i], canonical: 'Lockheed Martin' },
  { patterns: [/\bNORTHROP\s*GRUMMAN\b/i, /\bNORTHROP\b/i, /\bGRUMMAN\b/i, /\bNGC\b/i], canonical: 'Northrop Grumman' },
  { patterns: [/\bRAYTHEON\b/i, /\bRTX\b/i, /\bRAYTHEON\s+TECHNOLOGIES\b/i, /\bRAYTHEON\s+MISSILES\b/i], canonical: 'Raytheon' },
  { patterns: [/\bGENERAL\s+DYNAMICS\b/i, /\bGD\s+LAND\s+SYSTEMS\b/i, /\bGD\s+ELECTRIC\s+BOAT\b/i], canonical: 'General Dynamics' },
  { patterns: [/\bL3\s*HARRIS\b/i, /\bL3HARRIS\b/i, /\bHARRIS\s+CORP/i], canonical: 'L3Harris' },
  { patterns: [/\bBAE\s+SYSTEMS\b/i], canonical: 'BAE Systems' },
  { patterns: [/\bTEXTRON\b/i, /\bBEECHCRAFT\b/i, /\bCESSNA\b/i, /\bBELL\s+(HELICOPTER|TEXTRON)/i], canonical: 'Textron' },

  // Automotive
  { patterns: [/\bFORD\s+MOTOR\b/i, /\bFORD\b/i], canonical: 'Ford' },
  { patterns: [/\bGENERAL\s+MOTORS\b/i, /\bGM\s+MANUFACTURING\b/i, /\bCHEVROLET\b/i, /\bCADILLAC\b/i, /\bBUICK\b/i], canonical: 'General Motors' },
  { patterns: [/\bTESLA\b/i, /\bTESLA\s+MOTORS\b/i, /\bTESLA\s+ENERGY\b/i], canonical: 'Tesla' },
  { patterns: [/\bTOYOTA\b/i, /\bLEXUS\b/i], canonical: 'Toyota' },
  { patterns: [/\bHONDA\b/i, /\bACURA\b/i], canonical: 'Honda' },
  { patterns: [/\bSTELLANTIS\b/i, /\bCHRYSLER\b/i, /\bDODGE\b/i, /\bJEEP\b/i, /\bRAM\b/i, /\bFIAT\b/i], canonical: 'Stellantis' },
  { patterns: [/\bNISSAN\b/i, /\bINFINITI\b/i], canonical: 'Nissan' },
  { patterns: [/\bSUBARU\b/i, /\bFUJI\s+HEAVY\b/i], canonical: 'Subaru' },
  { patterns: [/\bBMW\b/i], canonical: 'BMW' },
  { patterns: [/\bVOLKSWAGEN\b/i, /\bVW\b/i], canonical: 'Volkswagen' },
  { patterns: [/\bHYUNDAI\b/i], canonical: 'Hyundai' },
  { patterns: [/\bKIA\b/i], canonical: 'Kia' },
  { patterns: [/\bRIVIAN\b/i], canonical: 'Rivian' },
  { patterns: [/\bLUCID\s+MOTORS\b/i, /\bLUCID\b/i], canonical: 'Lucid Motors' },

  // Heavy Equipment & Industrial
  { patterns: [/\bCATERPILLAR\b/i, /\bCAT\s+INC\b/i], canonical: 'Caterpillar' },
  { patterns: [/\bJOHN\s+DEERE\b/i, /\bDEERE\s+(&|AND)\s+CO/i, /\bDEERE\b/i], canonical: 'John Deere' },
  { patterns: [/\bCUMMINS\b/i], canonical: 'Cummins' },
  { patterns: [/\bPACCAR\b/i, /\bKENWORTH\b/i, /\bPETERBILT\b/i], canonical: 'PACCAR' },
  { patterns: [/\bHONEYWELL\b/i], canonical: 'Honeywell' },
  { patterns: [/\bEMERSON\s+ELECTRIC\b/i, /\bEMERSON\b/i], canonical: 'Emerson' },
  { patterns: [/\bPARKER\s+HANNIFIN\b/i, /\bPARKER\b/i], canonical: 'Parker Hannifin' },
  { patterns: [/\bILLINOIS\s+TOOL\s+WORKS\b/i, /\bITW\b/i], canonical: 'Illinois Tool Works' },
  { patterns: [/\bDANAHER\b/i], canonical: 'Danaher' },
  { patterns: [/\bDOVER\s+CORP/i, /\bDOVER\b/i], canonical: 'Dover' },
  { patterns: [/\bROCKWELL\s+AUTOMATION\b/i, /\bROCKWELL\b/i], canonical: 'Rockwell Automation' },

  // Technology & Semiconductors
  { patterns: [/\bAPPLE\s+INC\b/i, /\bAPPLE\b/i], canonical: 'Apple' },
  { patterns: [/\bINTEL\s+CORP/i, /\bINTEL\b/i], canonical: 'Intel' },
  { patterns: [/\bMICRON\s+TECHNOLOGY\b/i, /\bMICRON\b/i], canonical: 'Micron' },
  { patterns: [/\bTEXAS\s+INSTRUMENTS\b/i], canonical: 'Texas Instruments' },
  { patterns: [/\bGLOBALFOUNDRIES\b/i], canonical: 'GlobalFoundries' },
  { patterns: [/\bON\s+SEMICONDUCTOR\b/i, /\bONSEMI\b/i], canonical: 'onsemi' },
  { patterns: [/\bANALOG\s+DEVICES\b/i], canonical: 'Analog Devices' },
  { patterns: [/\bBROADCOM\b/i], canonical: 'Broadcom' },
  { patterns: [/\bCORNING\b/i], canonical: 'Corning' },

  // Steel & Metals
  { patterns: [/\bNUCOR\b/i], canonical: 'Nucor' },
  { patterns: [/\bU\.?S\.?\s+STEEL\b/i, /\bUNITED\s+STATES\s+STEEL\b/i], canonical: 'U.S. Steel' },
  { patterns: [/\bALCOA\b/i], canonical: 'Alcoa' },
  { patterns: [/\bSTEEL\s+DYNAMICS\b/i, /\bSDI\b/i], canonical: 'Steel Dynamics' },
  { patterns: [/\bCOMMERCIAL\s+METALS\b/i, /\bCMC\b/i], canonical: 'Commercial Metals' },
  { patterns: [/\bFREEPORT[\s-]*McMoRan\b/i, /\bFREEPORT\b/i], canonical: 'Freeport-McMoRan' },

  // Chemicals
  { patterns: [/\bDOW\s+(CHEMICAL|INC)\b/i, /\bDOW\b/i], canonical: 'Dow' },
  { patterns: [/\bDUPONT\b/i, /\bE\.?\s*I\.?\s*DU\s*PONT\b/i], canonical: 'DuPont' },
  { patterns: [/\bBASF\b/i], canonical: 'BASF' },
  { patterns: [/\bLYONDELLBASELL\b/i, /\bLYONDELL\b/i], canonical: 'LyondellBasell' },
  { patterns: [/\bPPG\s+INDUSTRIES\b/i, /\bPPG\b/i], canonical: 'PPG Industries' },
  { patterns: [/\bSHERWIN[\s-]*WILLIAMS\b/i], canonical: 'Sherwin-Williams' },
  { patterns: [/\bAIR\s+PRODUCTS\b/i], canonical: 'Air Products' },
  { patterns: [/\bECOLAB\b/i], canonical: 'Ecolab' },
  { patterns: [/\bHUNTSMAN\b/i], canonical: 'Huntsman' },
  { patterns: [/\bEASTMAN\s+CHEMICAL\b/i, /\bEASTMAN\b/i], canonical: 'Eastman Chemical' },

  // Consumer Goods & Food
  { patterns: [/\bPROCTER\s*(&|AND)\s*GAMBLE\b/i, /\bP\s*&\s*G\b/i], canonical: 'Procter & Gamble' },
  { patterns: [/\b3M\s+COMPANY\b/i, /\b3M\b/i], canonical: '3M' },
  { patterns: [/\bJOHNSON\s*(&|AND)\s*JOHNSON\b/i, /\bJ\s*&\s*J\b/i], canonical: 'Johnson & Johnson' },
  { patterns: [/\bKIMBERLY[\s-]*CLARK\b/i], canonical: 'Kimberly-Clark' },
  { patterns: [/\bCOLGATE[\s-]*PALMOLIVE\b/i, /\bCOLGATE\b/i], canonical: 'Colgate-Palmolive' },
  { patterns: [/\bGENERAL\s+MILLS\b/i], canonical: 'General Mills' },
  { patterns: [/\bKELLOGG\b/i, /\bKELLANOVA\b/i], canonical: 'Kellanova' },
  { patterns: [/\bMONDELEZ\b/i, /\bKRAFT\b/i, /\bNABISCO\b/i], canonical: 'Mondelez' },
  { patterns: [/\bTYSON\s+FOODS\b/i, /\bTYSON\b/i], canonical: 'Tyson Foods' },
  { patterns: [/\bARCHER[\s-]*DANIELS[\s-]*MIDLAND\b/i, /\bADM\b/i], canonical: 'ADM' },
  { patterns: [/\bCARGILL\b/i], canonical: 'Cargill' },
  { patterns: [/\bCOCA[\s-]*COLA\b/i, /\bCOKE\b/i], canonical: 'Coca-Cola' },
  { patterns: [/\bPEPSICO\b/i, /\bPEPSI\b/i, /\bFRITO[\s-]*LAY\b/i], canonical: 'PepsiCo' },
  { patterns: [/\bANHEUSER[\s-]*BUSCH\b/i, /\bAB\s+INBEV\b/i], canonical: 'Anheuser-Busch' },

  // Pharma & Medical
  { patterns: [/\bPFIZER\b/i], canonical: 'Pfizer' },
  { patterns: [/\bABBOTT\s+LAB/i, /\bABBOTT\b/i], canonical: 'Abbott' },
  { patterns: [/\bABBVIE\b/i], canonical: 'AbbVie' },
  { patterns: [/\bMERCK\b/i], canonical: 'Merck' },
  { patterns: [/\bELI\s+LILLY\b/i, /\bLILLY\b/i], canonical: 'Eli Lilly' },
  { patterns: [/\bBRISTOL[\s-]*MYERS\b/i, /\bBMS\b/i], canonical: 'Bristol-Myers Squibb' },
  { patterns: [/\bMEDTRONIC\b/i], canonical: 'Medtronic' },
  { patterns: [/\bSTRYKER\b/i], canonical: 'Stryker' },
  { patterns: [/\bBAXTER\b/i], canonical: 'Baxter' },
  { patterns: [/\bBECTON[\s,]*DICKINSON\b/i, /\bBD\b/i], canonical: 'BD' },

  // Energy & Refining
  { patterns: [/\bEXXON\s*MOBIL\b/i, /\bEXXON\b/i, /\bMOBIL\b/i], canonical: 'ExxonMobil' },
  { patterns: [/\bCHEVRON\s+CORP/i, /\bCHEVRON\b/i], canonical: 'Chevron' },
  { patterns: [/\bVALERO\b/i], canonical: 'Valero' },
  { patterns: [/\bMARATHON\s+PETROLEUM\b/i, /\bMARATHON\b/i], canonical: 'Marathon Petroleum' },
  { patterns: [/\bPHILLIPS\s+66\b/i], canonical: 'Phillips 66' },

  // Paper & Packaging
  { patterns: [/\bINTERNATIONAL\s+PAPER\b/i], canonical: 'International Paper' },
  { patterns: [/\bWEYERHAEUSER\b/i], canonical: 'Weyerhaeuser' },
  { patterns: [/\bPACKAGING\s+CORP/i, /\bPCA\b/i], canonical: 'Packaging Corp of America' },
  { patterns: [/\bBALL\s+CORP/i, /\bBALL\b/i], canonical: 'Ball Corporation' },
  { patterns: [/\bSEALED\s+AIR\b/i], canonical: 'Sealed Air' },

  // Electrical & Power Equipment
  { patterns: [/\bGENERAL\s+ELECTRIC\b/i, /\bGE\s+AEROSPACE\b/i, /\bGE\s+VERNOVA\b/i], canonical: 'General Electric' },
  { patterns: [/\bEATON\b/i], canonical: 'Eaton' },
  { patterns: [/\bSCHNEIDER\s+ELECTRIC\b/i], canonical: 'Schneider Electric' },
  { patterns: [/\bABB\b/i], canonical: 'ABB' },
  { patterns: [/\bSIEMENS\b/i], canonical: 'Siemens' },
];

export function normalizeCompanyName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return rawName;
  const trimmed = rawName.trim();
  for (const rule of COMPANY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) return rule.canonical;
    }
  }
  return cleanCompanyName(trimmed);
}

export function cleanCompanyName(name: string): string {
  if (!name) return name;
  let cleaned = name
    .replace(/,?\s*(INC\.?|INCORPORATED|LLC|L\.L\.C\.?|LTD\.?|LIMITED|CORP\.?|CORPORATION|CO\.?|COMPANY|L\.?P\.?|GROUP|HOLDINGS?)$/gi, '')
    .replace(/^THE\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return toTitleCase(cleaned);
}

function toTitleCase(str: string): string {
  const lowercaseWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of']);
  const uppercaseWords = new Set(['USA', 'US', 'UK', 'LLC', 'LLP', 'IBM', 'GE', 'GM', 'HP', 'IT', 'AI', 'ABB', 'PPG', 'ADM', 'BMX', 'BMS', 'BD']);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (uppercaseWords.has(upper)) return upper;
      if (index > 0 && lowercaseWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function extractCompanyFromFacilityName(facilityName: string): string | null {
  if (!facilityName) return null;
  for (const rule of COMPANY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(facilityName)) return rule.canonical;
    }
  }
  const separators = [' - ', ' – ', ' — ', ' / ', ', '];
  for (const sep of separators) {
    const idx = facilityName.indexOf(sep);
    if (idx > 0) {
      const potentialCompany = facilityName.substring(0, idx).trim();
      const normalized = normalizeCompanyName(potentialCompany);
      if (normalized !== potentialCompany) return normalized;
      return cleanCompanyName(potentialCompany);
    }
  }
  return null;
}
