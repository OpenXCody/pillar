import { pgTable, pgEnum, uuid, text, varchar, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────

export const dataSourceEnum = pgEnum('data_source', [
  'epa_echo', 'epa_tri', 'osha', 'usda_fsis', 'faa', 'nhtsa', 'manual',
]);

export const runStatusEnum = pgEnum('run_status', [
  'pending', 'fetching', 'normalizing', 'matching', 'merging', 'completed', 'failed',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'pending', 'confirmed', 'rejected', 'auto_matched',
]);

export const matchTypeEnum = pgEnum('match_type', [
  'geo_name', 'address_exact', 'frs_id', 'cross_source',
]);

export const exportStatusEnum = pgEnum('export_status', [
  'pending', 'generating', 'completed', 'failed',
]);

export const companyStatusEnum = pgEnum('company_status', [
  'unverified', 'verified', 'rejected',
]);

// ─── Source Runs ─────────────────────────────────────────────────────

export const sourceRuns = pgTable('source_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: dataSourceEnum('source').notNull(),
  status: runStatusEnum('status').default('pending').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  totalFetched: integer('total_fetched').default(0).notNull(),
  newRecords: integer('new_records').default(0).notNull(),
  updatedRecords: integer('updated_records').default(0).notNull(),
  matchesFound: integer('matches_found').default(0).notNull(),
  goldenRecordsCreated: integer('golden_records_created').default(0).notNull(),
  goldenRecordsUpdated: integer('golden_records_updated').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  errorLog: text('error_log'),
  fetchParams: text('fetch_params'),
  durationMs: integer('duration_ms'),
}, (table) => ({
  sourceIdx: index('source_runs_source_idx').on(table.source),
  statusIdx: index('source_runs_status_idx').on(table.status),
  startedIdx: index('source_runs_started_idx').on(table.startedAt),
}));

// ─── Raw Records ─────────────────────────────────────────────────────

export const rawRecords = pgTable('raw_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: dataSourceEnum('source').notNull(),
  sourceRunId: uuid('source_run_id').references(() => sourceRuns.id, { onDelete: 'set null' }),
  sourceRecordId: text('source_record_id'),

  // Common fields
  rawName: text('raw_name'),
  rawAddress: text('raw_address'),
  rawCity: text('raw_city'),
  rawState: varchar('raw_state', { length: 2 }),
  rawZip: varchar('raw_zip', { length: 10 }),
  rawCounty: text('raw_county'),
  rawLatitude: text('raw_latitude'),
  rawLongitude: text('raw_longitude'),
  rawNaicsCode: varchar('raw_naics_code', { length: 6 }),
  rawNaicsDescription: text('raw_naics_description'),
  rawSicCode: varchar('raw_sic_code', { length: 4 }),

  // EPA fields
  registryId: text('registry_id'),
  programIds: text('program_ids'),

  // TRI fields
  triParentCompanyName: text('tri_parent_company_name'),
  triParentDuns: text('tri_parent_duns'),
  triFacilityId: text('tri_facility_id'),

  // OSHA fields (V2)
  oshaActivityId: text('osha_activity_id'),
  oshaEmployeeCount: integer('osha_employee_count'),
  oshaInspectionDate: timestamp('osha_inspection_date'),

  // FSIS fields (V2)
  fsisEstNumber: text('fsis_est_number'),
  fsisActivities: text('fsis_activities'),
  fsisSizeCategory: text('fsis_size_category'),

  // FAA fields
  faaApprovalType: text('faa_approval_type'),  // PC, PMA, TSOA
  faaCertNumber: text('faa_cert_number'),
  faaHolderNumber: text('faa_holder_number'),

  // NHTSA fields
  nhtsaMfrId: text('nhtsa_mfr_id'),
  nhtsaVehicleTypes: text('nhtsa_vehicle_types'),

  // Linkage to golden record
  facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'set null' }),

  // Raw data preservation
  rawJson: text('raw_json'),

  // Processing timestamps
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  normalizedAt: timestamp('normalized_at'),
  matchedAt: timestamp('matched_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('raw_records_source_idx').on(table.source),
  sourceRunIdx: index('raw_records_source_run_idx').on(table.sourceRunId),
  sourceRecordIdx: index('raw_records_source_record_idx').on(table.source, table.sourceRecordId),
  registryIdx: index('raw_records_registry_idx').on(table.registryId),
  stateIdx: index('raw_records_state_idx').on(table.rawState),
  naicsIdx: index('raw_records_naics_idx').on(table.rawNaicsCode),
  facilityIdx: index('raw_records_facility_idx').on(table.facilityId),
  nameIdx: index('raw_records_name_idx').on(table.rawName),
  zipIdx: index('raw_records_zip_idx').on(table.rawZip),
}));

// ─── Companies ───────────────────────────────────────────────────────

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  nameVariants: text('name_variants'),
  dunsNumber: text('duns_number'),
  sector: text('sector'),
  naicsCodes: text('naics_codes'),
  status: companyStatusEnum('status').default('unverified').notNull(),
  facilityCount: integer('facility_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: uniqueIndex('companies_name_idx').on(table.name),
  dunsIdx: index('companies_duns_idx').on(table.dunsNumber),
  statusIdx: index('companies_status_idx').on(table.status),
}));

// ─── Facilities (Golden Records) ─────────────────────────────────────

export const facilities = pgTable('facilities', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: text('name').notNull(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  companyName: text('company_name'),

  address: text('address'),
  city: text('city'),
  state: varchar('state', { length: 2 }),
  zip: varchar('zip', { length: 10 }),
  county: text('county'),
  latitude: text('latitude'),
  longitude: text('longitude'),

  primaryNaics: varchar('primary_naics', { length: 6 }),
  primaryNaicsDescription: text('primary_naics_description'),
  allNaicsCodes: text('all_naics_codes'),
  primarySic: varchar('primary_sic', { length: 4 }),

  employeeCount: integer('employee_count'),
  employeeCountSource: dataSourceEnum('employee_count_source'),
  epaRegistryId: text('epa_registry_id'),
  parentCompanyFromTri: text('parent_company_from_tri'),
  fsisEstNumber: text('fsis_est_number'),
  fsisSizeCategory: text('fsis_size_category'),

  faaApprovalTypes: text('faa_approval_types'),    // JSON array: ["PC","PMA","TSOA"]
  nhtsaMfrId: text('nhtsa_mfr_id'),

  sourceCount: integer('source_count').default(1).notNull(),
  sources: text('sources'),
  confidence: integer('confidence').default(50).notNull(),
  lastVerifiedAt: timestamp('last_verified_at'),

  exportedToArchangel: integer('exported_to_archangel').default(0).notNull(),
  archangelFactoryId: text('archangel_factory_id'),
  lastExportedAt: timestamp('last_exported_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('facilities_company_idx').on(table.companyId),
  stateIdx: index('facilities_state_idx').on(table.state),
  naicsIdx: index('facilities_primary_naics_idx').on(table.primaryNaics),
  nameIdx: index('facilities_name_idx').on(table.name),
  zipIdx: index('facilities_zip_idx').on(table.zip),
  registryIdx: index('facilities_registry_idx').on(table.epaRegistryId),
  sourceCountIdx: index('facilities_source_count_idx').on(table.sourceCount),
  exportedIdx: index('facilities_exported_idx').on(table.exportedToArchangel),
  companyNameIdx: index('facilities_company_name_idx').on(table.companyName),
}));

// ─── Facility Sources (Attribution) ──────────────────────────────────

export const facilitySources = pgTable('facility_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  facilityId: uuid('facility_id').notNull().references(() => facilities.id, { onDelete: 'cascade' }),
  rawRecordId: uuid('raw_record_id').notNull().references(() => rawRecords.id, { onDelete: 'cascade' }),
  source: dataSourceEnum('source').notNull(),
  sourceRecordId: text('source_record_id'),
  fieldsProvided: text('fields_provided'),
  linkedAt: timestamp('linked_at').defaultNow().notNull(),
}, (table) => ({
  facilityIdx: index('facility_sources_facility_idx').on(table.facilityId),
  rawRecordIdx: index('facility_sources_raw_record_idx').on(table.rawRecordId),
  uniqueLink: uniqueIndex('facility_sources_unique_idx').on(table.facilityId, table.rawRecordId),
}));

// ─── Match Candidates ────────────────────────────────────────────────

export const matchCandidates = pgTable('match_candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  recordAId: uuid('record_a_id').notNull().references(() => rawRecords.id, { onDelete: 'cascade' }),
  recordBId: uuid('record_b_id').notNull().references(() => rawRecords.id, { onDelete: 'cascade' }),
  facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'cascade' }),
  rawRecordId: uuid('raw_record_id').references(() => rawRecords.id, { onDelete: 'cascade' }),
  matchType: matchTypeEnum('match_type').notNull(),
  status: matchStatusEnum('status').default('pending').notNull(),
  confidenceScore: integer('confidence_score').notNull(),
  scoreBreakdown: text('score_breakdown'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  sourceRunId: uuid('source_run_id').references(() => sourceRuns.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('match_candidates_status_idx').on(table.status),
  confidenceIdx: index('match_candidates_confidence_idx').on(table.confidenceScore),
  facilityIdx: index('match_candidates_facility_idx').on(table.facilityId),
  recordAIdx: index('match_candidates_record_a_idx').on(table.recordAId),
  recordBIdx: index('match_candidates_record_b_idx').on(table.recordBId),
}));

// ─── NAICS Reference ─────────────────────────────────────────────────

export const naicsCodes = pgTable('naics_codes', {
  code: varchar('code', { length: 6 }).primaryKey(),
  title: text('title').notNull(),
  level: integer('level').notNull(),
  parentCode: varchar('parent_code', { length: 6 }),
  isManufacturing: integer('is_manufacturing').default(0).notNull(),
}, (table) => ({
  parentIdx: index('naics_codes_parent_idx').on(table.parentCode),
  mfgIdx: index('naics_codes_mfg_idx').on(table.isManufacturing),
}));

// ─── SIC-NAICS Crosswalk ─────────────────────────────────────────────

export const sicNaicsCrosswalk = pgTable('sic_naics_crosswalk', {
  id: uuid('id').defaultRandom().primaryKey(),
  sicCode: varchar('sic_code', { length: 4 }).notNull(),
  sicDescription: text('sic_description'),
  naicsCode: varchar('naics_code', { length: 6 }).notNull(),
  naicsDescription: text('naics_description'),
}, (table) => ({
  sicIdx: index('crosswalk_sic_idx').on(table.sicCode),
  naicsIdx: index('crosswalk_naics_idx').on(table.naicsCode),
}));

// ─── Exports ─────────────────────────────────────────────────────────

export const exports = pgTable('exports', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: exportStatusEnum('status').default('pending').notNull(),
  format: text('format').default('csv').notNull(),
  facilityCount: integer('facility_count').default(0).notNull(),
  companyCount: integer('company_count').default(0).notNull(),
  filters: text('filters'),
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ─── Relations ───────────────────────────────────────────────────────

export const sourceRunsRelations = relations(sourceRuns, ({ many }) => ({
  rawRecords: many(rawRecords),
  matchCandidates: many(matchCandidates),
}));

export const rawRecordsRelations = relations(rawRecords, ({ one, many }) => ({
  sourceRun: one(sourceRuns, { fields: [rawRecords.sourceRunId], references: [sourceRuns.id] }),
  facility: one(facilities, { fields: [rawRecords.facilityId], references: [facilities.id] }),
  facilitySources: many(facilitySources),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  facilities: many(facilities),
}));

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  company: one(companies, { fields: [facilities.companyId], references: [companies.id] }),
  facilitySources: many(facilitySources),
}));

export const facilitySourcesRelations = relations(facilitySources, ({ one }) => ({
  facility: one(facilities, { fields: [facilitySources.facilityId], references: [facilities.id] }),
  rawRecord: one(rawRecords, { fields: [facilitySources.rawRecordId], references: [rawRecords.id] }),
}));
