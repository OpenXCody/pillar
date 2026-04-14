export type DataSource = 'epa_echo' | 'epa_tri' | 'osha' | 'usda_fsis' | 'manual';
export type RunStatus = 'pending' | 'fetching' | 'normalizing' | 'matching' | 'merging' | 'completed' | 'failed';
export type MatchStatus = 'pending' | 'confirmed' | 'rejected' | 'auto_matched';
export type MatchType = 'geo_name' | 'address_exact' | 'frs_id' | 'cross_source';
export type ExportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface SourceInfo {
  key: DataSource;
  name: string;
  description: string;
  color: string;
}

export const DATA_SOURCES: Record<DataSource, SourceInfo> = {
  epa_echo: {
    key: 'epa_echo',
    name: 'EPA ECHO',
    description: 'Enforcement & Compliance History — broadest facility coverage with coordinates',
    color: '#60A5FA',
  },
  epa_tri: {
    key: 'epa_tri',
    name: 'EPA TRI',
    description: 'Toxics Release Inventory — parent company names and chemical reporting facilities',
    color: '#34D399',
  },
  osha: {
    key: 'osha',
    name: 'OSHA',
    description: 'Establishment inspection data with employee counts',
    color: '#FBBF24',
  },
  usda_fsis: {
    key: 'usda_fsis',
    name: 'USDA FSIS',
    description: 'Meat, poultry, and egg processing plant directory',
    color: '#F87171',
  },
  manual: {
    key: 'manual',
    name: 'Manual',
    description: 'Manually entered or corrected records',
    color: '#A78BFA',
  },
};

export interface Company {
  id: string;
  name: string;
  nameVariants: string | null;
  dunsNumber: string | null;
  sector: string | null;
  naicsCodes: string | null;
  facilityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDetail extends Company {
  facilities: Facility[];
}

export interface Facility {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  latitude: string | null;
  longitude: string | null;
  primaryNaics: string | null;
  primaryNaicsDescription: string | null;
  employeeCount: number | null;
  sourceCount: number;
  sources: DataSource[];
  confidence: number;
  epaRegistryId: string | null;
  exportedToArchangel: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FacilitySourceAttribution {
  source: DataSource;
  sourceRecordId: string | null;
  fieldsProvided: string[];
  linkedAt: string;
}

export interface FacilityDetail extends Facility {
  facilitySources: FacilitySourceAttribution[];
}

export interface RawRecord {
  id: string;
  source: DataSource;
  sourceRecordId: string | null;
  rawName: string | null;
  rawAddress: string | null;
  rawCity: string | null;
  rawState: string | null;
  rawZip: string | null;
  rawLatitude: string | null;
  rawLongitude: string | null;
  rawNaicsCode: string | null;
  registryId: string | null;
  triParentCompanyName: string | null;
  facilityId: string | null;
  fetchedAt: string;
  normalizedAt: string | null;
  matchedAt: string | null;
}

export interface SourceRun {
  id: string;
  source: DataSource;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  totalFetched: number;
  newRecords: number;
  updatedRecords: number;
  matchesFound: number;
  goldenRecordsCreated: number;
  goldenRecordsUpdated: number;
  errorCount: number;
  durationMs: number | null;
}

export interface MatchCandidate {
  id: string;
  recordAId: string;
  recordBId: string;
  facilityId: string | null;
  matchType: MatchType;
  status: MatchStatus;
  confidenceScore: number;
  scoreBreakdown: {
    nameScore: number;
    geoScore: number;
    addressScore: number;
    naicsScore: number;
  } | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface ExportRecord {
  id: string;
  status: ExportStatus;
  format: string;
  facilityCount: number;
  companyCount: number;
  filters: Record<string, unknown> | null;
  filePath: string | null;
  fileSize: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total?: number;
}

export interface StatsOverview {
  totalFacilities: number;
  totalCompanies: number;
  totalRawRecords: number;
  multiSourceCount: number;
  pendingReviews: number;
  bySource: Record<DataSource, number>;
  byState: { state: string; count: number }[];
}
