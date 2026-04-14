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
  { patterns: [/\bOWENS[\s-]?CORNING\b/i], canonical: 'Owens Corning' },
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
  { patterns: [/\bGENERAL\s+ELECTRIC\b/i, /\bGE\s+AEROSPACE\b/i, /\bGE\s+VERNOVA\b/i, /\bGE\s+AVIATION\b/i, /\bGE\s+HEALTHCARE\b/i], canonical: 'General Electric' },
  { patterns: [/\bEATON\b/i], canonical: 'Eaton' },
  { patterns: [/\bSCHNEIDER\s+ELECTRIC\b/i], canonical: 'Schneider Electric' },
  { patterns: [/\bABB\b/i], canonical: 'ABB' },
  { patterns: [/\bSIEMENS\b/i], canonical: 'Siemens' },
  { patterns: [/\bHUBBELL\b/i], canonical: 'Hubbell' },
  { patterns: [/\bAMPHENOL\b/i], canonical: 'Amphenol' },
  { patterns: [/\bTE\s+CONNECTIVITY\b/i], canonical: 'TE Connectivity' },
  { patterns: [/\bBELDEN\b/i], canonical: 'Belden' },
  { patterns: [/\bACUITY\s+BRANDS\b/i], canonical: 'Acuity Brands' },

  // Construction Materials & Aggregates
  { patterns: [/\bCEMEX\b/i], canonical: 'CEMEX' },
  { patterns: [/\bVULCAN\s+MATERIAL/i], canonical: 'Vulcan Materials' },
  { patterns: [/\bMARTIN\s+MARIETTA\b/i], canonical: 'Martin Marietta' },
  { patterns: [/\bLAFARGE\b/i, /\bLAFARGEHOLCIM\b/i], canonical: 'Lafarge' },
  { patterns: [/\bHOLCIM\b/i], canonical: 'Holcim' },
  { patterns: [/\bOLDCASTLE\b/i], canonical: 'Oldcastle (CRH)' },
  { patterns: [/\bARGOS\s+USA\b/i, /\bARGOS\s+CEMENT\b/i, /\bARGOS\s+READY\b/i], canonical: 'Argos USA' },
  { patterns: [/\bKNIFE\s+RIVER\b/i], canonical: 'Knife River' },
  { patterns: [/\bAGGREGATE\s+INDUSTRIES\b/i], canonical: 'Aggregate Industries' },
  { patterns: [/\bHANSON\s+AGGREGATE/i, /\bHANSON\s+PIPE/i, /\bHANSON\s+BUILDING/i], canonical: 'Hanson' },
  { patterns: [/\bASH\s+GROVE\b/i], canonical: 'Ash Grove Cement' },
  { patterns: [/\bBUZZI\s+UNICEM\b/i, /\bBUZZI\b/i], canonical: 'Buzzi Unicem' },
  { patterns: [/\bARCOSA\b/i], canonical: 'Arcosa' },
  { patterns: [/\bDRAGON\s+PRODUCTS\b/i], canonical: 'Dragon Products' },
  { patterns: [/\bGENERAL\s+SHALE\b/i], canonical: 'General Shale' },
  { patterns: [/\bFORTERRA\b/i], canonical: 'Forterra' },
  { patterns: [/\bTHOMAS\s+CONCRETE\b/i], canonical: 'Thomas Concrete' },
  { patterns: [/\bSMYRNA\s+READY\b/i], canonical: 'Smyrna Ready Mix' },
  { patterns: [/\bSHELLY\s+MATERIALS\b/i, /\bSHELLY\s+(&|AND)\s+SANDS\b/i], canonical: 'Shelly Materials' },
  { patterns: [/\bHOLLIDAY\s+ROCK\b/i], canonical: 'Holliday Rock' },
  { patterns: [/\bVCNA\b/i], canonical: 'VCNA Prairie' },
  { patterns: [/\bSAINT[\s-]?GOBAIN\b/i, /\bST[\s-]?GOBAIN\b/i], canonical: 'Saint-Gobain' },
  { patterns: [/\bCERTAINTEED\b/i], canonical: 'CertainTeed' },
  { patterns: [/\bJOHNS\s+MANVILLE\b/i], canonical: 'Johns Manville' },
  { patterns: [/\bCARDINAL\s+GLASS\b/i, /\bCARDINAL\s+CG\b/i], canonical: 'Cardinal Glass' },
  { patterns: [/\bGEORGIA[\s-]?PACIFIC\b/i], canonical: 'Georgia-Pacific' },

  // Food & Beverage
  { patterns: [/\bNESTLE\b/i, /\bNESTL[EÉ]\b/i], canonical: 'Nestle' },
  { patterns: [/\bSMITHFIELD\b/i], canonical: 'Smithfield Foods' },
  { patterns: [/\bJBS\s+(USA|SWIFT|PACK|SOUDERTON|GREEN\s+BAY|TOLLESON|MARSHALLTOWN)/i], canonical: 'JBS' },
  { patterns: [/\bPILGRIM'?S?\s+PRIDE\b/i, /\bPILGRIM'?S?\b/i], canonical: "Pilgrim's Pride" },
  { patterns: [/\bPERDUE\s+FARM/i, /\bPERDUE\b/i], canonical: 'Perdue Farms' },
  { patterns: [/\bHORMEL\b/i], canonical: 'Hormel' },
  { patterns: [/\bCONAGRA\b/i], canonical: 'Conagra Brands' },
  { patterns: [/\bSARA\s+LEE\b/i], canonical: 'Sara Lee' },
  { patterns: [/\bMCCORMICK\s+(&|AND)\b/i, /\bMCCORMICK\s+SPICE/i, /\bMCCORMICK\s+FLAVOR/i], canonical: 'McCormick' },
  { patterns: [/\bHERSHEY\b/i], canonical: 'Hershey' },
  { patterns: [/\bARDENT\s+MILLS\b/i], canonical: 'Ardent Mills' },
  { patterns: [/\bBLUETRITON\b/i], canonical: 'BlueTriton Brands' },

  // Chemicals (additional)
  { patterns: [/\bCELANESE\b/i], canonical: 'Celanese' },
  { patterns: [/\bOLIN\s+CORP/i, /\bOLIN\s+CHEMICAL/i, /\bOLIN\s+CHLOR/i, /\bOLIN\s+BRASS/i], canonical: 'Olin' },
  { patterns: [/\bCHEMOURS\b/i], canonical: 'Chemours' },
  { patterns: [/\bHEXION\b/i], canonical: 'Hexion' },
  { patterns: [/\bAXALTA\b/i], canonical: 'Axalta' },
  { patterns: [/\bVALSPAR\b/i], canonical: 'Valspar' },
  { patterns: [/\bHENKEL\b/i], canonical: 'Henkel' },
  { patterns: [/\bSIKA\b/i], canonical: 'Sika' },
  { patterns: [/\bCABOT\s+CORP/i, /\bCABOT\b/i], canonical: 'Cabot' },
  { patterns: [/\bSENSIENT\b/i], canonical: 'Sensient Technologies' },
  { patterns: [/\bSUN\s+CHEMICAL\b/i], canonical: 'Sun Chemical' },
  { patterns: [/\bHYDRITE\b/i], canonical: 'Hydrite Chemical' },

  // Packaging (additional)
  { patterns: [/\bBERRY\s+GLOBAL\b/i, /\bBERRY\s+PLASTICS\b/i], canonical: 'Berry Global' },
  { patterns: [/\bSONOCO\b/i], canonical: 'Sonoco' },
  { patterns: [/\bWESTROCK\b/i, /\bMEADWESTVACO\b/i], canonical: 'WestRock' },
  { patterns: [/\bSMURFIT\b/i], canonical: 'Smurfit Westrock' },
  { patterns: [/\bGRAPHIC\s+PACKAGING\b/i], canonical: 'Graphic Packaging' },
  { patterns: [/\bSILGAN\b/i], canonical: 'Silgan' },
  { patterns: [/\bGRAHAM\s+PACKAGING\b/i], canonical: 'Graham Packaging' },
  { patterns: [/\bARDAGH\b/i], canonical: 'Ardagh Group' },
  { patterns: [/\bPACTIV\b/i], canonical: 'Pactiv' },
  { patterns: [/\bBOISE\s+CASCADE\b/i], canonical: 'Boise Cascade' },
  { patterns: [/\bBEMIS\b/i], canonical: 'Bemis' },
  { patterns: [/\bAPTAR\b/i, /\bAPTARGROUP\b/i], canonical: 'AptarGroup' },

  // Industrial & Diversified (additional)
  { patterns: [/\bTHERMO\s+FISHER\b/i], canonical: 'Thermo Fisher Scientific' },
  { patterns: [/\bAMETEK\b/i], canonical: 'AMETEK' },
  { patterns: [/\bFLOWSERVE\b/i], canonical: 'Flowserve' },
  { patterns: [/\bNORDSON\b/i], canonical: 'Nordson' },
  { patterns: [/\bGRACO\b/i], canonical: 'Graco' },
  { patterns: [/\bKENNAMETAL\b/i], canonical: 'Kennametal' },
  { patterns: [/\bLINCOLN\s+ELECTRIC\b/i], canonical: 'Lincoln Electric' },
  { patterns: [/\bTIMKEN\b/i], canonical: 'Timken' },
  { patterns: [/\bTEREX\b/i], canonical: 'Terex' },
  { patterns: [/\bWABTEC\b/i], canonical: 'Wabtec' },
  { patterns: [/\bMODINE\b/i], canonical: 'Modine' },
  { patterns: [/\bSPX\s+CORP/i, /\bSPX\s+FLOW\b/i, /\bSPX\s+TECH/i], canonical: 'SPX' },
  { patterns: [/\bPENTAIR\b/i], canonical: 'Pentair' },
  { patterns: [/\bXYLEM\b/i], canonical: 'Xylem' },
  { patterns: [/\bMATERION\b/i], canonical: 'Materion' },
  { patterns: [/\bWORTHINGTON\s+(INDUSTRIES|CYLINDERS|STEEL)\b/i], canonical: 'Worthington Industries' },
  { patterns: [/\bCURTISS[\s-]?WRIGHT\b/i], canonical: 'Curtiss-Wright' },
  { patterns: [/\bJABIL\b/i], canonical: 'Jabil' },
  { patterns: [/\bCELESTICA\b/i], canonical: 'Celestica' },
  { patterns: [/\bKOHLER\b/i], canonical: 'Kohler' },
  { patterns: [/\bMANITOWOC\b/i], canonical: 'Manitowoc' },
  { patterns: [/\bOSHKOSH\s+(CORP|TRUCK|DEFENSE)/i], canonical: 'Oshkosh' },
  { patterns: [/\bLEGGETT\s*(&|AND)\s*PLATT\b/i, /\bLEGGETT\b/i], canonical: 'Leggett & Platt' },
  { patterns: [/\bMARMON\b/i], canonical: 'Marmon Group' },
  { patterns: [/\bSIERRA\s+PACIFIC\b/i], canonical: 'Sierra Pacific Industries' },
  { patterns: [/\bKUBOTA\b/i], canonical: 'Kubota' },
  { patterns: [/\bNAVISTAR\b/i], canonical: 'Navistar' },

  // Tires & Rubber
  { patterns: [/\bGOODYEAR\b/i], canonical: 'Goodyear' },
  { patterns: [/\bBRIDGESTONE\b/i, /\bFIRESTONE\b/i], canonical: 'Bridgestone' },
  { patterns: [/\bMICHELIN\b/i], canonical: 'Michelin' },
  { patterns: [/\bCOOPER\s+TIRE\b/i], canonical: 'Cooper Tire' },
  { patterns: [/\bTRELLEBORG\b/i], canonical: 'Trelleborg' },

  // Auto Parts (additional)
  { patterns: [/\bBORG\s*WARNER\b/i, /\bBORGWARNER\b/i], canonical: 'BorgWarner' },
  { patterns: [/\bDANA\s+(INC|CORP|HOLD)/i], canonical: 'Dana' },

  // Energy & Oilfield Services (additional)
  { patterns: [/\bHALLIBURTON\b/i], canonical: 'Halliburton' },
  { patterns: [/\bHOLLYFRONTIER\b/i, /\bHOLLY\s+FRONTIER\b/i, /\bHF\s+SINCLAIR\b/i], canonical: 'HF Sinclair' },

  // Industrial Gases
  { patterns: [/\bAIR\s+LIQUIDE\b/i], canonical: 'Air Liquide' },
  { patterns: [/\bLINDE\b/i, /\bPRAXAIR\b/i], canonical: 'Linde' },

  // Environmental Services
  { patterns: [/\bWASTE\s+MANAGEMENT\b/i, /\bWM\s+OF\b/i], canonical: 'Waste Management' },
  { patterns: [/\bREPUBLIC\s+SERVICES\b/i], canonical: 'Republic Services' },
  { patterns: [/\bVEOLIA\b/i], canonical: 'Veolia' },

  // Printing & Publishing
  { patterns: [/\bRR\s+DONNELLEY\b/i, /\bR\.?R\.?\s+DONNELLEY\b/i, /\bDONNELLEY\b/i], canonical: 'RR Donnelley' },
  { patterns: [/\bMINUTEMAN\s+PRESS\b/i], canonical: 'Minuteman Press' },
  { patterns: [/\bSIR\s+SPEEDY\b/i], canonical: 'Sir Speedy' },
  { patterns: [/\bAVERY\s+DENNISON\b/i], canonical: 'Avery Dennison' },

  // Retail & Convenience
  { patterns: [/\bKROGER\b/i], canonical: 'Kroger' },
  { patterns: [/\bDOLLAR\s+GENERAL\b/i], canonical: 'Dollar General' },
  { patterns: [/\bDOLLAR\s+TREE\b/i, /\bFAMILY\s+DOLLAR\b/i], canonical: 'Dollar Tree' },
  { patterns: [/\bCIRCLE\s+K\b/i], canonical: 'Circle K' },
  { patterns: [/\bSPEEDWAY\b/i], canonical: 'Speedway' },
  { patterns: [/\bWINN[\s-]?DIXIE\b/i], canonical: 'Winn-Dixie' },
  { patterns: [/\bGRAINGER\b/i], canonical: 'Grainger' },
  { patterns: [/\bLES\s+SCHWAB\b/i], canonical: 'Les Schwab' },
  { patterns: [/\bMAVERIK\b/i], canonical: 'Maverik' },
  { patterns: [/\bSAVE[\s-]?A[\s-]?LOT\b/i], canonical: 'Save-A-Lot' },

  // HVAC & Building Products
  { patterns: [/\bTRANE\b/i], canonical: 'Trane' },
  { patterns: [/\bCARRIER\s+(CORP|GLOBAL|TRANS)/i], canonical: 'Carrier' },
  { patterns: [/\bLENNOX\b/i], canonical: 'Lennox' },
  { patterns: [/\bDAIKIN\b/i], canonical: 'Daikin' },
  { patterns: [/\bCHARLOTTE\s+PIPE\b/i], canonical: 'Charlotte Pipe' },

  // Appliances
  { patterns: [/\bWHIRLPOOL\b/i, /\bMAYTAG\b/i], canonical: 'Whirlpool' },
  { patterns: [/\bELECTROLUX\b/i], canonical: 'Electrolux' },

  // Medical & Pharma (additional)
  { patterns: [/\bGSK\b/i, /\bGLAXO\s*SMITH\s*KLINE\b/i], canonical: 'GSK' },

  // Batteries
  { patterns: [/\bEXIDE\b/i], canonical: 'Exide Technologies' },

  // Diversified Industrial Services
  { patterns: [/\bTYCO\b/i], canonical: 'Tyco' },
  { patterns: [/\bSWISHER\b/i], canonical: 'Swisher' },

  // Glass
  { patterns: [/\bOWENS[\s-]?ILLINOIS\b/i, /\bO[\s-]?I\s+GLASS\b/i], canonical: 'O-I Glass' },

  // Agriculture
  { patterns: [/\bSYNGENTA\b/i], canonical: 'Syngenta' },
  { patterns: [/\bFMC\s+CORP/i], canonical: 'FMC' },

  // Coatings & Paint (additional)
  { patterns: [/\bDUNN[\s-]?EDWARDS\b/i], canonical: 'Dunn-Edwards' },

  // Concrete (named regional chains)
  { patterns: [/\bAPAC\b/i], canonical: 'APAC' },

  // Contract Manufacturing
  { patterns: [/\bFREUDENBERG[\s-]?NOK\b/i, /\bFREUDENBERG\b/i], canonical: 'Freudenberg' },

  // Westinghouse
  { patterns: [/\bWESTINGHOUSE\b/i], canonical: 'Westinghouse' },

  // Aerospace (additional)
  { patterns: [/\bTRIUMPH\s+GROUP\b/i, /\bTRIUMPH\s+AEROSTRUCTURES\b/i, /\bTRIUMPH\s+THERMAL\b/i, /\bTRIUMPH\s+ACTUATION\b/i, /\bTRIUMPH\s+GEAR\b/i], canonical: 'Triumph Group' },
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

  // 1. Direct rule match against the full facility name
  for (const rule of COMPANY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(facilityName)) return rule.canonical;
    }
  }

  // 2. Try splitting on various separator patterns and checking the left side
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

  // 3. Colon separator: "COMPANY:FACILITY" or "COMPANY: FACILITY"
  const colonIdx = facilityName.indexOf(':');
  if (colonIdx > 2) {
    const potentialCompany = facilityName.substring(0, colonIdx).trim();
    // Only use if the left side is a recognizable company name
    const normalized = normalizeCompanyName(potentialCompany);
    if (normalized !== cleanCompanyName(potentialCompany)) return normalized;
  }

  // 4. Hash/number pattern: "COMPANY NAME #123" or "COMPANY #123 LOCATION"
  const hashMatch = facilityName.match(/^(.+?)\s+#\d+/i);
  if (hashMatch) {
    const potentialCompany = hashMatch[1].trim();
    const normalized = normalizeCompanyName(potentialCompany);
    if (normalized !== cleanCompanyName(potentialCompany)) return normalized;
  }

  // 5. "COMPANY CITY PLANT" / "COMPANY LOCATION FACILITY" patterns
  //    Only match if removing trailing location+facility words yields a known company
  const facilityTrailers = /\s+(?:PLANT|FACILITY|FACTORY|WORKS|MILL|MINE|QUARRY|PIT|TERMINAL|WAREHOUSE|DIST(?:RIBUTION)?\s+CENTER|SHOP|YARD|DEPOT|STATION|REFINERY|SMELTER|FOUNDRY|FORGE|DIVISION|DIV)\s*(?:#?\d+)?$/i;
  const stripped = facilityName.replace(facilityTrailers, '').trim();
  if (stripped !== facilityName) {
    // Remove a potential city name from the end (single capitalized word)
    const withoutCity = stripped.replace(/\s+[A-Z][A-Za-z]+$/, '').trim();
    if (withoutCity.length > 2) {
      const normalized = normalizeCompanyName(withoutCity);
      if (normalized !== cleanCompanyName(withoutCity)) return normalized;
    }
    // Also try the stripped version directly (no city removal)
    const normalizedDirect = normalizeCompanyName(stripped);
    if (normalizedDirect !== cleanCompanyName(stripped)) return normalizedDirect;
  }

  // 6. Hyphenated pattern: "COMPANY-DIVISION" (but not single-letter hyphens like "A-1")
  const hyphenMatch = facilityName.match(/^([A-Z][A-Za-z]{2,}(?:\s+[A-Za-z]+)*)-([A-Z][A-Za-z]{2,}.*)$/);
  if (hyphenMatch) {
    const potentialCompany = hyphenMatch[1].trim();
    const normalized = normalizeCompanyName(potentialCompany);
    if (normalized !== cleanCompanyName(potentialCompany)) return normalized;
  }

  return null;
}
