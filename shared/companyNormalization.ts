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
  { patterns: [/\bHILCORP\b/i], canonical: 'Hilcorp' },
  { patterns: [/\bEOG\s+RESOURCES\b/i, /\bEOG\b/i], canonical: 'EOG Resources' },
  { patterns: [/\bXTO\s+ENERGY\b/i, /\bXTO\b/i], canonical: 'XTO Energy' },
  { patterns: [/\bARCHROCK\b/i], canonical: 'Archrock' },
  { patterns: [/\bEXTERRAN\b/i], canonical: 'Exterran' },
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
  { patterns: [/\bSPIRIT\s+AERO\b/i], canonical: 'Spirit AeroSystems' },
  { patterns: [/\bHOWMET\b/i], canonical: 'Howmet Aerospace' },
  { patterns: [/\bARCONIC\b/i], canonical: 'Arconic' },
  { patterns: [/\bALCOA\b/i], canonical: 'Alcoa' },
  { patterns: [/\bNOVELIS\b/i], canonical: 'Novelis' },
  { patterns: [/\bL3\s+TECHNOLOGIES\b/i, /\bL-?3\s+COMM/i, /\bL-?3\s+WARRIOR\b/i], canonical: 'L3Harris' },

  // Industrial Equipment & Automation
  { patterns: [/\bAPPLIED\s+MATERIALS\b/i], canonical: 'Applied Materials' },
  { patterns: [/\bINGERSOLL[\s-]?RAND\b/i, /\bINGERSOLL\b/i], canonical: 'Ingersoll Rand' },
  { patterns: [/\bATLAS\s+COPCO\b/i], canonical: 'Atlas Copco' },
  { patterns: [/\bSANDVIK\b/i], canonical: 'Sandvik' },
  { patterns: [/\bALSTOM\b/i], canonical: 'Alstom' },
  { patterns: [/\bAGCO\b/i], canonical: 'AGCO' },
  { patterns: [/\bABB\b/], canonical: 'ABB' },
  { patterns: [/\bSCHNEIDER\s+ELECTRIC\b/i, /\bSCHNEIDER\s+SQUARE\b/i], canonical: 'Schneider Electric' },
  { patterns: [/\bWESTLAKE\s+CHEMICAL\b/i, /\bWESTLAKE\s+VINYLS\b/i, /\bWESTLAKE\s+PIPE\b/i, /\bWESTLAKE\s+POLYMERS\b/i], canonical: 'Westlake Chemical' },
  { patterns: [/\bMAGNA\s+INT/i, /\bMAGNA\s+SEATING\b/i, /\bMAGNA\s+MIRROR/i, /\bMAGNA\s+STEYR\b/i, /\bMAGNA\s+CLOSURES\b/i, /\bMAGNA\s+POWER/i, /\bMAGNA\s+ELECT/i], canonical: 'Magna International' },
  { patterns: [/\bPHILLIPS\s+66\b/i, /\bPHILLIPS\s+PETROLEUM\b/i, /\bCONOCO\s*PHILLIPS\b/i], canonical: 'Phillips 66' },

  // Gas & Industrial Supply
  { patterns: [/\bAIRGAS\b/i], canonical: 'Airgas' },

  // Food & Beverage (additional)
  { patterns: [/\bFOSTER\s+FARMS\b/i], canonical: 'Foster Farms' },
  { patterns: [/\bTRIDENT\s+SEAFOODS\b/i], canonical: 'Trident Seafoods' },
  { patterns: [/\bFRITO[\s-]?LAY\b/i], canonical: 'Frito-Lay' },
  { patterns: [/\bANHEUSER[\s-]?BUSCH\b/i, /\bAB\s+INBEV\b/i], canonical: 'Anheuser-Busch' },
  { patterns: [/\bMOLSON\s+COORS\b/i, /\bMILLERCOORS\b/i], canonical: 'Molson Coors' },
  { patterns: [/\bKEURIG\b/i, /\bDR\s+PEPPER\b/i], canonical: 'Keurig Dr Pepper' },

  // Convenience Stores & Chains
  { patterns: [/\bJACKSON'?S\s+FOOD\b/i], canonical: "Jackson's Food Stores" },
  { patterns: [/\bLESLIE'?S\s+POOL\b/i, /\bLESLIE'?S\s+SWIMMING\b/i], canonical: "Leslie's Pool Supplies" },
  { patterns: [/\bSTINKER\s+STO/i, /\bSTINKER\s+#/i, /\bSTINKER\b/i], canonical: 'Stinker Stores' },
  { patterns: [/\bSUPER\s+PANTRY\b/i], canonical: 'Super Pantry' },
  { patterns: [/\bROAD\s+RANGER\b/i], canonical: 'Road Ranger' },
  { patterns: [/\bBRIDENT\s+DENTAL\b/i], canonical: 'Brident Dental' },
  { patterns: [/\bEXPRESS\s+LANE\s+(?:OIL|TIRE|SERVICE|CAR)/i], canonical: 'Express Lane' },

  // Concrete & Aggregates (regional chains)
  { patterns: [/\bROBERTSON'?S\s+READY\b/i], canonical: "Robertson's Ready Mix" },
  { patterns: [/\bGENEVA\s+ROCK\b/i], canonical: 'Geneva Rock' },
  { patterns: [/\bLAKESIDE\s+INDUSTRIES\b/i], canonical: 'Lakeside Industries' },
  { patterns: [/\bSOUTHERN\s+CONCRETE\b/i], canonical: 'Southern Concrete' },

  // Building Products & Home Improvement
  { patterns: [/\bPELLA\s+(?:CORP|WINDOW|DOOR)/i, /\bPELLA\b/i], canonical: 'Pella' },
  { patterns: [/\bMARVIN\s+(?:WINDOW|DOOR|LUMBER)/i], canonical: 'Marvin Windows' },
  { patterns: [/\bMASONITE\b/i], canonical: 'Masonite' },
  { patterns: [/\bARMSTRONG\s+(?:FLOORING|WORLD|CEILING|CABINET|INT)/i, /\bARMSTRONG\s+\w+\s+(?:PLANT|FACILITY|FACTORY)/i], canonical: 'Armstrong' },
  { patterns: [/\bMOHAWK\s+(?:INDUSTR|CARPET|FLOORING|HOME)/i, /\bDALTILE\b/i], canonical: 'Mohawk Industries' },
  { patterns: [/\bSHAW\s+(?:INDUSTR|CARPET|FLOORING|PLANT)/i], canonical: 'Shaw Industries' },

  // Consumer Products
  { patterns: [/\bPROCTER\s*(?:&|AND)\s*GAMBLE\b/i, /\bP\s*&\s*G\b/], canonical: 'Procter & Gamble' },
  { patterns: [/\bCOLGATE[\s-]?PALMOLIVE\b/i, /\bCOLGATE\b/i], canonical: 'Colgate-Palmolive' },
  { patterns: [/\bKIMBERLY[\s-]?CLARK\b/i], canonical: 'Kimberly-Clark' },
  { patterns: [/\bCHURCH\s*(?:&|AND)\s*DWIGHT\b/i], canonical: 'Church & Dwight' },
  { patterns: [/\bCLOROX\b/i], canonical: 'Clorox' },
  { patterns: [/\bSC\s+JOHNSON\b/i, /\bS\.?C\.?\s+JOHNSON\b/i], canonical: 'SC Johnson' },

  // Medical Devices & Pharma (additional)
  { patterns: [/\bMEDTRONIC\b/i], canonical: 'Medtronic' },
  { patterns: [/\bSTRYKER\b/i], canonical: 'Stryker' },
  { patterns: [/\bBECTON\s+DICKINSON\b/i, /\bBD\s+MEDICAL\b/i], canonical: 'Becton Dickinson' },
  { patterns: [/\bZIMMER\s*BIOMET\b/i, /\bZIMMER\s+(?:SURG|INC|HOLD|SPINE|DENTAL)/i], canonical: 'Zimmer Biomet' },
  { patterns: [/\bBOSTON\s+SCIENTIFIC\b/i], canonical: 'Boston Scientific' },
  { patterns: [/\bBAXTER\s+(?:INT|HEALTH|PHARM)/i], canonical: 'Baxter International' },

  // Coatings & Sealants (additional)
  { patterns: [/\bRPM\s+(?:INT|WOOD|IND)/i, /\bRUST[\s-]?OLEUM\b/i], canonical: 'RPM International' },
  { patterns: [/\bDAP\s+(?:PROD|INC|MANUFACT)/i], canonical: 'DAP Products' },
  { patterns: [/\bBOSTIK\b/i], canonical: 'Bostik' },

  // Railroad & Transportation Equipment
  { patterns: [/\bPROGRESS\s+RAIL\b/i], canonical: 'Progress Rail' },
  { patterns: [/\bTRINITY\s+INDUSTR/i, /\bTRINITY\s+RAIL\b/i, /\bTRINITY\s+MARINE\b/i], canonical: 'Trinity Industries' },
  { patterns: [/\bFOREST\s+RIVER\b/i, /\bSTARCRAFT\s+BUS\b/i], canonical: 'Forest River' },
  { patterns: [/\bFLEETWOOD\s+(?:HOME|ENTER)/i], canonical: 'Fleetwood Homes' },
  { patterns: [/\bGREENBRIER\b/i], canonical: 'Greenbrier' },
  { patterns: [/\bNEW\s+FLYER\b/i], canonical: 'New Flyer' },
  { patterns: [/\bWABASH\s+NATIONAL\b/i], canonical: 'Wabash National' },

  // Glass & Ceramics
  { patterns: [/\bAGC\s+(?:GLASS|SOLAR|FLAT|AUTO)/i, /\bAGC\s+\w+\s+PLANT\b/i], canonical: 'AGC Glass' },
  { patterns: [/\bGUARDIAN\s+(?:GLASS|INDUSTR)/i], canonical: 'Guardian Glass' },
  { patterns: [/\bVITRO\b/i], canonical: 'Vitro' },

  // Steel & Metals (additional)
  { patterns: [/\bGERDAU\b/i], canonical: 'Gerdau' },
  { patterns: [/\bRHI\s+MAGNESITA\b/i], canonical: 'RHI Magnesita' },
  { patterns: [/\bSUZUKI\s+GARPHYTTAN\b/i], canonical: 'Suzuki Garphyttan' },
  { patterns: [/\bMETALSA\b/i], canonical: 'Metalsa' },
  { patterns: [/\bRUGER\b/i, /\bSTURM[\s,]+RUGER\b/i], canonical: 'Sturm, Ruger & Co.' },
  { patterns: [/\bSMITH\s+(?:&|AND)\s+WESSON\b/i], canonical: 'Smith & Wesson' },
  { patterns: [/\bOLYMPUS\s+STEEL\b/i], canonical: 'Olympic Steel' },
  { patterns: [/\bCARPENTER\s+TECH/i], canonical: 'Carpenter Technology' },
  { patterns: [/\bHAYNES\s+INT/i], canonical: 'Haynes International' },
  { patterns: [/\bSCHAEFFLER\b/i], canonical: 'Schaeffler' },
  { patterns: [/\bSKF\b/i], canonical: 'SKF' },

  // Automotive (additional)
  { patterns: [/\bLEAR\s+CORP/i, /\bLEAR\b/i], canonical: 'Lear' },
  { patterns: [/\bDENSO\b/i], canonical: 'Denso' },
  { patterns: [/\bAIRIN\b/i, /\bAISIN\b/i], canonical: 'Aisin' },
  { patterns: [/\bCONTINENTAL\s+(?:AUTO|AG|TIRE|BRAKE)/i], canonical: 'Continental AG' },
  { patterns: [/\bAPTIV\b/i, /\bDELPHI\b/i], canonical: 'Aptiv' },
  { patterns: [/\bGENTEX\b/i], canonical: 'Gentex' },
  { patterns: [/\bMARTHA\s+STEWART\b/i], canonical: 'Martha Stewart' },
  { patterns: [/\bMODINE\s+MANUFACTURING\b/i], canonical: 'Modine' },
  { patterns: [/\bSUPERIOR\s+INDUSTRIES\b/i], canonical: 'Superior Industries' },
  { patterns: [/\bDORMAN\b/i], canonical: 'Dorman Products' },
  { patterns: [/\bMARTINREA\b/i], canonical: 'Martinrea' },

  // Plastics & Rubber (additional)
  { patterns: [/\bRPC\s+GROUP\b/i], canonical: 'RPC Group' },
  { patterns: [/\bIPEX\b/i], canonical: 'IPEX' },
  { patterns: [/\bGOLEX\b/i], canonical: 'Golex' },

  // Paper/Forestry (additional)
  { patterns: [/\bSAPIPI\b/i, /\bSAPPI\b/i], canonical: 'Sappi' },
  { patterns: [/\bCLEARWATER\s+PAPER\b/i], canonical: 'Clearwater Paper' },
  { patterns: [/\bRESSOLUTE\s+FOREST\b/i, /\bRESOLUTE\s+FOREST\b/i], canonical: 'Resolute Forest Products' },
  { patterns: [/\bVERSO\b/i], canonical: 'Verso' },

  // Textiles & Apparel
  { patterns: [/\bHANES\s*BRANDS\b/i, /\bHANES\b/i], canonical: 'Hanesbrands' },
  { patterns: [/\bPVH\s+CORP/i, /\bCALVIN\s+KLEIN\b/i, /\bTOMMY\s+HILFIGER\b/i], canonical: 'PVH' },
  { patterns: [/\bVF\s+CORP/i, /\bWRANGLER\b/i], canonical: 'VF Corporation' },
  { patterns: [/\bMILLIKEN\s+(?:&|AND)\s+CO/i, /\bMILLIKEN\b/i], canonical: 'Milliken' },

  // Semiconductors (additional)
  { patterns: [/\bQORVO\b/i], canonical: 'Qorvo' },
  { patterns: [/\bMARVELL\s+TECH/i, /\bMARVELL\b/i], canonical: 'Marvell' },
  { patterns: [/\bSKYWORKS\b/i], canonical: 'Skyworks' },
  { patterns: [/\bWOLFSPEED\b/i, /\bCREE\b/i], canonical: 'Wolfspeed' },

  // Furniture & Wood Products
  { patterns: [/\bHERMAN\s+MILLER\b/i, /\bMILLERKNOLL\b/i], canonical: 'MillerKnoll' },
  { patterns: [/\bSTEELCASE\b/i], canonical: 'Steelcase' },
  { patterns: [/\bHAWORTH\b/i], canonical: 'Haworth' },
  { patterns: [/\bASHLEY\s+FURNITURE\b/i, /\bASHLEY\s+INDUSTR/i], canonical: 'Ashley Furniture' },
  { patterns: [/\bLA[\s-]?Z[\s-]?BOY\b/i], canonical: 'La-Z-Boy' },

  // Recreational Vehicles
  { patterns: [/\bTHOR\s+INDUSTR/i, /\bAIRSTREAM\b/i], canonical: 'Thor Industries' },
  { patterns: [/\bWINNEBAGO\b/i], canonical: 'Winnebago' },
  { patterns: [/\bPOLARIS\s+(?:INDUSTR|INC|CORP)/i, /\bPOLARIS\b/i], canonical: 'Polaris' },
  { patterns: [/\bBRP\b/i, /\bBOMBARDIER\s+REC/i], canonical: 'BRP' },

  // Defense (additional)
  { patterns: [/\bGDLS\b/i, /\bGENERAL\s+DYNAMICS\s+LAND/i], canonical: 'General Dynamics' },
  { patterns: [/\bELBIT\b/i], canonical: 'Elbit Systems' },

  // Machinery & Pumps
  { patterns: [/\bSULZER\b/i], canonical: 'Sulzer' },
  { patterns: [/\bGRUNDFOS\b/i], canonical: 'Grundfos' },
  { patterns: [/\bNIDEC\b/i], canonical: 'Nidec' },
  { patterns: [/\bBALDOR\b/i], canonical: 'Baldor Electric' },
  { patterns: [/\bREXNORD\b/i], canonical: 'Rexnord' },
  { patterns: [/\bBAKER\s+HUGHES\b/i], canonical: 'Baker Hughes' },
  { patterns: [/\bFLOWER\s+FOODS\b/i, /\bFLOWERS\s+BAKING\b/i, /\bFLOWERS\s+FOODS\b/i], canonical: 'Flowers Foods' },

  // Utilities & Energy Equipment
  { patterns: [/\bVESTAS\b/i], canonical: 'Vestas' },
  { patterns: [/\bGE\s+WIND\b/i], canonical: 'GE Vernova' },
  { patterns: [/\bNEXTERA\b/i], canonical: 'NextEra Energy' },

  // Dairy & Meat (additional)
  { patterns: [/\bDEAN\s+FOODS\b/i], canonical: 'Dean Foods' },
  { patterns: [/\bLAND\s+O[\s']?LAKES\b/i], canonical: "Land O'Lakes" },
  { patterns: [/\bCACIQUE\b/i], canonical: 'Cacique' },
  { patterns: [/\bGOYA\b/i], canonical: 'Goya Foods' },
  { patterns: [/\bDANONE\b/i, /\bDANNON\b/i], canonical: 'Danone' },
  { patterns: [/\bSCHREIBER\s+FOOD/i], canonical: 'Schreiber Foods' },
  { patterns: [/\bLEPRINO\s+FOOD/i], canonical: 'Leprino Foods' },
  { patterns: [/\bSAPUTO\b/i], canonical: 'Saputo' },
  { patterns: [/\bKAFTA\b/i], canonical: 'Kraft Heinz' },
  { patterns: [/\bKRAFT[\s-]?HEINZ\b/i, /\bKRAFT\s+FOOD/i, /\bHEINZ\b/i, /\bOSCAR\s+MAYER\b/i], canonical: 'Kraft Heinz' },
  { patterns: [/\bMAPLE\s+LEAF\b/i], canonical: 'Maple Leaf Foods' },
  { patterns: [/\bCAMPBELL\s+SOUP\b/i, /\bCAMPBELL'?S?\b/i], canonical: 'Campbell Soup' },
  { patterns: [/\bHILLSHIRE\b/i], canonical: 'Hillshire Brands' },
  { patterns: [/\bINTERSTATE\s+BAKER/i, /\bINTERSTATE\s+BRAND/i], canonical: 'Interstate Brands' },
  { patterns: [/\bBIMBO\s+BAKE/i, /\bBIMBO\b/i], canonical: 'Grupo Bimbo' },
  { patterns: [/\bRICH\s+PRODUCTS\b/i, /\bRICH'?S?\s+(?:FOOD|PROD|INC)/i], canonical: 'Rich Products' },
  { patterns: [/\bSARALEE\b/i, /\bSARA\s+LEE\s+FOOD/i, /\bSARA\s+LEE\s+BAKE/i], canonical: 'Sara Lee' },
  { patterns: [/\bCHOBANI\b/i], canonical: 'Chobani' },

  // Snacks & Confectionery
  { patterns: [/\bMARS\s+(?:INC|PET|FOOD|WRIGLEY|CHOC)/i, /\bM&M[\s/]?MARS\b/i], canonical: 'Mars' },
  { patterns: [/\bFERRERA\b/i, /\bFERRARA\s+CANDY\b/i], canonical: 'Ferrara Candy' },
  { patterns: [/\bRUSSELL\s+STOVER\b/i], canonical: 'Russell Stover' },

  // Wine & Spirits
  { patterns: [/\bE\s*&?\s*J\s+GALLO\b/i, /\bGALLO\s+WINER/i], canonical: 'E. & J. Gallo' },
  { patterns: [/\bBROWN[\s-]?FORMAN\b/i], canonical: 'Brown-Forman' },
  { patterns: [/\bCONSTELLATION\s+BRAND/i], canonical: 'Constellation Brands' },
  { patterns: [/\bDIAGEO\b/i], canonical: 'Diageo' },
  { patterns: [/\bBEAM\s+SUNTORY\b/i, /\bJIM\s+BEAM\b/i], canonical: 'Beam Suntory' },
  { patterns: [/\bJACK\s+DANIEL/i], canonical: 'Brown-Forman' },

  // Animal Feed & Pet Food
  { patterns: [/\bPURINA\b/i, /\bRALSTON\s+PURINA\b/i], canonical: 'Purina' },
  { patterns: [/\bKENT\s+(?:FEED|PET|NUTRITION)/i], canonical: 'Kent Nutrition' },
  { patterns: [/\bNUTRIEN\b/i], canonical: 'Nutrien' },
  { patterns: [/\bMOSAIC\s+(?:CO|FERT|PHOSPH)/i, /\bMOSAIC\b/i], canonical: 'Mosaic' },

  // Lumber & Building Materials (additional)
  { patterns: [/\bWEST\s+FRASER\b/i], canonical: 'West Fraser' },
  { patterns: [/\bLOUISIANA[\s-]?PACIFIC\b/i, /\bLP\s+BUILD/i], canonical: 'Louisiana-Pacific' },
  { patterns: [/\bTREX\b/i], canonical: 'Trex' },
  { patterns: [/\bJAMES\s+HARDIE\b/i], canonical: 'James Hardie' },
  { patterns: [/\bUSG\s+CORP/i, /\bUSG\b/i], canonical: 'USG' },
  { patterns: [/\bKNAUF\b/i], canonical: 'Knauf' },

  // Wire & Cable
  { patterns: [/\bSOUTHWIRE\b/i], canonical: 'Southwire' },
  { patterns: [/\bGENERAL\s+CABLE\b/i], canonical: 'General Cable' },
  { patterns: [/\bENCORE\s+WIRE\b/i], canonical: 'Encore Wire' },

  // Electronics & Sensors
  { patterns: [/\bFLEX\s+LTD\b/i, /\bFLEXTRONICS\b/i], canonical: 'Flex' },
  { patterns: [/\bSENSATA\b/i], canonical: 'Sensata Technologies' },
  { patterns: [/\bAMPHENOL\b/i], canonical: 'Amphenol' },
  { patterns: [/\bMOLEX\b/i], canonical: 'Molex' },
  { patterns: [/\bVISHAY\b/i], canonical: 'Vishay' },
  { patterns: [/\bKEYSIGHT\b/i], canonical: 'Keysight' },
];

/**
 * Values that should never become company names — null/NA variants,
 * placeholder strings, single characters, all-numeric.
 */
const BLOCKED_COMPANY_VALUES = new Set([
  'na', 'n/a', 'n.a', 'n.a.', 'n a', 'none', 'null', 'unknown', 'tbd',
  'test', 'temp', 'pending', 'not available', 'not applicable',
  'unspecified', 'unassigned', 'no name', 'no company', '-', '--', '.',
  'various', 'other', 'misc', 'general', 'private', 'individual',
]);

export function isBlockedCompanyName(name: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length <= 1) return true;
  if (BLOCKED_COMPANY_VALUES.has(trimmed.toLowerCase())) return true;
  if (/^[\d\s.,-]+$/.test(trimmed)) return true;
  return false;
}

export function normalizeCompanyName(rawName: string): string | null {
  if (!rawName || typeof rawName !== 'string') return null;
  const trimmed = rawName.trim();
  if (isBlockedCompanyName(trimmed)) return null;
  for (const rule of COMPANY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) return rule.canonical;
    }
  }
  return cleanCompanyName(trimmed);
}

export function cleanCompanyName(name: string): string | null {
  if (!name) return null;
  let cleaned = name
    .replace(/,?\s+\b(INC\.?|INCORPORATED|LLC|L\.L\.C\.?|LTD\.?|LIMITED|CORP\.?|CORPORATION|CO\.?|COMPANY|L\.?P\.?|GROUP|HOLDINGS?)$/gi, '')
    .replace(/^THE\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (isBlockedCompanyName(cleaned)) return null;
  return toTitleCase(cleaned);
}

function toTitleCase(str: string): string {
  const lowercaseWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of']);
  const uppercaseWords = new Set(['USA', 'US', 'UK', 'LLC', 'LLP', 'IBM', 'GE', 'GM', 'HP', 'IT', 'AI', 'ABB', 'PPG', 'ADM', 'BMX', 'BMS', 'BD', 'EOG', 'XTO', 'BHP', 'FMC', 'RPM', 'SPX', 'SKF', 'USG', 'CRH', 'BRP', 'JBS', 'GSK', 'RTX']);
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

/**
 * Words that indicate a name is NOT a company (government, education, etc.)
 */
const NON_COMPANY_INDICATORS = /\b(?:COUNTY|CITY\s+OF|STATE\s+OF|DEPT\s+OF|DEPARTMENT|UNIVERSITY|SCHOOL|DISTRICT|MUNICIPAL|BOROUGH|TOWNSHIP|VILLAGE\s+OF|BUREAU|COMMISSION|AUTHORITY|AGENCY|COUNCIL|CHURCH|LIBRARY|HOSPITAL|CLINIC|MEDICAL\s+CENTER|FIRE\s+DEPT|POLICE|SHERIFF|COURT)\b/i;

/**
 * Corporate suffixes that signal a name is a company
 */
const CORPORATE_SUFFIXES = /,?\s*\b(INC\.?|INCORPORATED|LLC|L\.?L\.?C\.?|LTD\.?|LIMITED|CORP\.?|CORPORATION|CO\.?|COMPANY|L\.?P\.?|HOLDINGS?|ENTERPRISES?|INDUSTRIES?\b|INTERNATIONAL|MANUFACTURING|MFG\.?)\s*$/i;

/**
 * Detect if a name has corporate-like structure (has a suffix or is multi-word with a recognizable pattern)
 */
function hasCorporateStructure(name: string): boolean {
  return CORPORATE_SUFFIXES.test(name);
}

/**
 * Detect equipment/model patterns on the right side of a separator.
 * If the text after " - " looks like equipment (model numbers, HP ratings,
 * serial numbers), the left side is the operator, not the equipment brand.
 */
const EQUIPMENT_PATTERN = /\b(\d{3,4}\s*HP|G\d{3,4}|C-?\d{1,2}\b|3\d{3}|D-?\d{2}|NO\d{3,4}|SN\s*[A-Z0-9]|UNIT\s*#|PORTABLE|GENERAT|COMPRESSOR|ENGINE\b|FLEET\b|\d+\s*EA\.?\s)/i;

export function extractCompanyFromFacilityName(facilityName: string): string | null {
  if (!facilityName) return null;

  // Skip government/educational facilities
  if (NON_COMPANY_INDICATORS.test(facilityName)) return null;

  // 1. SEPARATOR CHECK FIRST — prevents equipment brand misattribution.
  //    "ARCHROCK - CATERPILLAR G3516" → Archrock (not Caterpillar)
  //    "CATERPILLAR INC - MAPLETON" → Caterpillar (left side IS the company)
  const separators = [' - ', ' – ', ' — '];
  for (const sep of separators) {
    const idx = facilityName.indexOf(sep);
    if (idx > 0) {
      const leftSide = facilityName.substring(0, idx).trim();
      const rightSide = facilityName.substring(idx + sep.length).trim();

      // If the right side has equipment/model patterns, the LEFT side is the real operator
      if (EQUIPMENT_PATTERN.test(rightSide)) {
        const normalized = normalizeCompanyName(leftSide);
        if (normalized && !isBlockedCompanyName(normalized)) return normalized;
        const cleaned = cleanCompanyName(leftSide);
        if (cleaned && !isBlockedCompanyName(cleaned)) return cleaned;
      }

      // Otherwise, use the left side as the company (normal separator behavior)
      const normalized = normalizeCompanyName(leftSide);
      if (normalized !== leftSide && normalized) return normalized;
      const cleaned = cleanCompanyName(leftSide);
      if (cleaned && !isBlockedCompanyName(cleaned)) return cleaned;
    }
  }

  // Also check " / " and ", " separators (less likely to be equipment)
  for (const sep of [' / ', ', ']) {
    const idx = facilityName.indexOf(sep);
    if (idx > 0) {
      const potentialCompany = facilityName.substring(0, idx).trim();
      const normalized = normalizeCompanyName(potentialCompany);
      if (normalized !== potentialCompany && normalized) return normalized;
      const cleaned = cleanCompanyName(potentialCompany);
      if (cleaned && !isBlockedCompanyName(cleaned)) return cleaned;
    }
  }

  // 2. Direct rule match against the full facility name
  //    (now AFTER separator check so "ARCHROCK - CATERPILLAR" won't match Caterpillar)
  for (const rule of COMPANY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(facilityName)) return rule.canonical;
    }
  }

  // 3. "DIVISION OF [COMPANY]" / "SUBSIDIARY OF [COMPANY]"
  const divisionOf = facilityName.match(/\b(?:DIVISION|SUBSIDIARY|UNIT|BRANCH|DEPT)\s+OF\s+(.+)$/i);
  if (divisionOf) {
    const parent = divisionOf[1].trim();
    const normalized = normalizeCompanyName(parent);
    if (normalized !== cleanCompanyName(parent)) return normalized;
    if (hasCorporateStructure(parent)) return cleanCompanyName(parent);
  }

  const aCompanyOf = facilityName.match(/^(.+?)\s+(?:A\s+)?(?:DIVISION|SUBSIDIARY)\s+OF/i);
  if (aCompanyOf) {
    const afterOf = facilityName.replace(aCompanyOf[0], '').trim();
    if (afterOf) {
      const normalized = normalizeCompanyName(afterOf);
      if (normalized !== cleanCompanyName(afterOf)) return normalized;
      if (hasCorporateStructure(afterOf)) return cleanCompanyName(afterOf);
    }
  }

  // 4. "DBA [NAME]" pattern — use the DBA as the company
  const dbaMatch = facilityName.match(/\bDBA\s+(.+)$/i);
  if (dbaMatch) {
    const dbaName = dbaMatch[1].trim();
    const normalized = normalizeCompanyName(dbaName);
    if (normalized !== cleanCompanyName(dbaName)) return normalized;
    if (hasCorporateStructure(dbaName)) return cleanCompanyName(dbaName);
  }

  // 5. Colon separator: "COMPANY:FACILITY" or "COMPANY: FACILITY"
  const colonIdx = facilityName.indexOf(':');
  if (colonIdx > 2) {
    const potentialCompany = facilityName.substring(0, colonIdx).trim();
    const normalized = normalizeCompanyName(potentialCompany);
    if (normalized !== cleanCompanyName(potentialCompany)) return normalized;
  }

  // 6. Hash/number pattern: "COMPANY NAME #123" or "COMPANY #123 LOCATION"
  const hashMatch = facilityName.match(/^(.+?)\s+#\d+/i);
  if (hashMatch) {
    const potentialCompany = hashMatch[1].trim();
    const normalized = normalizeCompanyName(potentialCompany);
    if (normalized !== cleanCompanyName(potentialCompany)) return normalized;
    if (hasCorporateStructure(potentialCompany)) return cleanCompanyName(potentialCompany);
  }

  // 7. "COMPANY CITY PLANT" / "COMPANY LOCATION FACILITY" patterns
  const facilityTrailers = /\s+(?:PLANT|FACILITY|FACTORY|WORKS|MILL|MINE|QUARRY|PIT|TERMINAL|WAREHOUSE|DIST(?:RIBUTION)?\s+CENTER|SHOP|YARD|DEPOT|STATION|REFINERY|SMELTER|FOUNDRY|FORGE|DIVISION|DIV)\s*(?:#?\d+)?$/i;
  const stripped = facilityName.replace(facilityTrailers, '').trim();
  if (stripped !== facilityName) {
    // Remove a potential city name from the end (single capitalized word)
    const withoutCity = stripped.replace(/\s+[A-Z][A-Za-z]+$/, '').trim();
    if (withoutCity.length > 2) {
      const normalized = normalizeCompanyName(withoutCity);
      if (normalized !== cleanCompanyName(withoutCity)) return normalized;
    }
    const normalizedDirect = normalizeCompanyName(stripped);
    if (normalizedDirect !== cleanCompanyName(stripped)) return normalizedDirect;
  }

  // 8. Hyphenated pattern: "COMPANY-DIVISION"
  const hyphenMatch = facilityName.match(/^([A-Z][A-Za-z]{2,}(?:\s+[A-Za-z]+)*)-([A-Z][A-Za-z]{2,}.*)$/);
  if (hyphenMatch) {
    const potentialCompany = hyphenMatch[1].trim();
    const normalized = normalizeCompanyName(potentialCompany);
    if (normalized !== cleanCompanyName(potentialCompany)) return normalized;
  }

  // 9. GENERIC CORPORATE NAME EXTRACTION
  //    If the facility name contains corporate suffixes (INC, LLC, CORP, etc.),
  //    the cleaned name is likely a valid company name.
  if (hasCorporateStructure(facilityName)) {
    return cleanCompanyName(facilityName);
  }

  // 10. Multi-word names ending in recognizable industry terms are likely companies
  //     e.g. "HORIZON STEEL", "PARTS FINISHING GROUP", "SUMMIT MARINE"
  const industryTerms = /\b(?:STEEL|METALS?|IRON|ALUMINUM|PLASTICS?|RUBBER|GLASS|CHEMICAL|LUMBER|TIMBER|CONCRETE|CEMENT|ASPHALT|PAVING|ROOFING|INSULATION|PACKAGING|PRINTING|MACHINING|WELDING|FOUNDRY|FABRICAT\w*|TOOL|DIE|MOLD|STAMPING|CASTING|FORGING|PLATING|COATING|FINISHING|ASSEMBLY|MANUFACTURING|MFG|PRODUCTS?|TECHNOLOGIES|SOLUTIONS|SYSTEMS|SERVICES|SUPPLY|SUPPLIES|COMPONENTS?|PARTS|EQUIPMENT|MACHINERY|ELECTRONICS?|AEROSPACE|AUTOMOTIVE|MARINE|AVIATION|DEFENSE|ENERGY|POWER|SOLAR)\s*$/i;
  if (industryTerms.test(facilityName) && facilityName.split(/\s+/).length >= 2) {
    return cleanCompanyName(facilityName);
  }

  return null;
}
