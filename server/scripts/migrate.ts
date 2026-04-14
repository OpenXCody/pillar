import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function migrate() {
  console.log('Creating Pillar schema...');

  // Enums
  await sql`DO $$ BEGIN
    CREATE TYPE data_source AS ENUM ('epa_echo', 'epa_tri', 'osha', 'usda_fsis', 'manual');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  await sql`DO $$ BEGIN
    CREATE TYPE run_status AS ENUM ('pending', 'fetching', 'normalizing', 'matching', 'merging', 'completed', 'failed');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  await sql`DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('pending', 'confirmed', 'rejected', 'auto_matched');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  await sql`DO $$ BEGIN
    CREATE TYPE match_type AS ENUM ('geo_name', 'address_exact', 'frs_id', 'cross_source');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  await sql`DO $$ BEGIN
    CREATE TYPE export_status AS ENUM ('pending', 'generating', 'completed', 'failed');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log('  Enums created');

  // source_runs
  await sql`CREATE TABLE IF NOT EXISTS source_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source data_source NOT NULL,
    status run_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP NOT NULL DEFAULT now(),
    completed_at TIMESTAMP,
    total_fetched INTEGER NOT NULL DEFAULT 0,
    new_records INTEGER NOT NULL DEFAULT 0,
    updated_records INTEGER NOT NULL DEFAULT 0,
    matches_found INTEGER NOT NULL DEFAULT 0,
    golden_records_created INTEGER NOT NULL DEFAULT 0,
    golden_records_updated INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    error_log TEXT,
    fetch_params TEXT,
    duration_ms INTEGER
  )`;
  await sql`CREATE INDEX IF NOT EXISTS source_runs_source_idx ON source_runs (source)`;
  await sql`CREATE INDEX IF NOT EXISTS source_runs_status_idx ON source_runs (status)`;
  await sql`CREATE INDEX IF NOT EXISTS source_runs_started_idx ON source_runs (started_at)`;
  console.log('  source_runs created');

  // companies (before facilities since facilities references it)
  await sql`CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_variants TEXT,
    duns_number TEXT,
    sector TEXT,
    naics_codes TEXT,
    facility_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS companies_name_idx ON companies (name)`;
  await sql`CREATE INDEX IF NOT EXISTS companies_duns_idx ON companies (duns_number)`;
  console.log('  companies created');

  // facilities (golden records)
  await sql`CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_name TEXT,
    address TEXT,
    city TEXT,
    state VARCHAR(2),
    zip VARCHAR(10),
    county TEXT,
    latitude TEXT,
    longitude TEXT,
    primary_naics VARCHAR(6),
    primary_naics_description TEXT,
    all_naics_codes TEXT,
    primary_sic VARCHAR(4),
    employee_count INTEGER,
    employee_count_source data_source,
    epa_registry_id TEXT,
    parent_company_from_tri TEXT,
    fsis_est_number TEXT,
    fsis_size_category TEXT,
    source_count INTEGER NOT NULL DEFAULT 1,
    sources TEXT,
    confidence INTEGER NOT NULL DEFAULT 50,
    last_verified_at TIMESTAMP,
    exported_to_archangel INTEGER NOT NULL DEFAULT 0,
    archangel_factory_id TEXT,
    last_exported_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_company_idx ON facilities (company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_state_idx ON facilities (state)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_primary_naics_idx ON facilities (primary_naics)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_name_idx ON facilities (name)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_zip_idx ON facilities (zip)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_registry_idx ON facilities (epa_registry_id)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_source_count_idx ON facilities (source_count)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_exported_idx ON facilities (exported_to_archangel)`;
  await sql`CREATE INDEX IF NOT EXISTS facilities_company_name_idx ON facilities (company_name)`;
  console.log('  facilities created');

  // raw_records
  await sql`CREATE TABLE IF NOT EXISTS raw_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source data_source NOT NULL,
    source_run_id UUID REFERENCES source_runs(id) ON DELETE SET NULL,
    source_record_id TEXT,
    raw_name TEXT,
    raw_address TEXT,
    raw_city TEXT,
    raw_state VARCHAR(2),
    raw_zip VARCHAR(10),
    raw_county TEXT,
    raw_latitude TEXT,
    raw_longitude TEXT,
    raw_naics_code VARCHAR(6),
    raw_naics_description TEXT,
    raw_sic_code VARCHAR(4),
    registry_id TEXT,
    program_ids TEXT,
    tri_parent_company_name TEXT,
    tri_parent_duns TEXT,
    tri_facility_id TEXT,
    osha_activity_id TEXT,
    osha_employee_count INTEGER,
    osha_inspection_date TIMESTAMP,
    fsis_est_number TEXT,
    fsis_activities TEXT,
    fsis_size_category TEXT,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    raw_json TEXT,
    fetched_at TIMESTAMP NOT NULL DEFAULT now(),
    normalized_at TIMESTAMP,
    matched_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_source_idx ON raw_records (source)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_source_run_idx ON raw_records (source_run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_source_record_idx ON raw_records (source, source_record_id)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_registry_idx ON raw_records (registry_id)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_state_idx ON raw_records (raw_state)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_naics_idx ON raw_records (raw_naics_code)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_facility_idx ON raw_records (facility_id)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_name_idx ON raw_records (raw_name)`;
  await sql`CREATE INDEX IF NOT EXISTS raw_records_zip_idx ON raw_records (raw_zip)`;
  console.log('  raw_records created');

  // facility_sources
  await sql`CREATE TABLE IF NOT EXISTS facility_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    raw_record_id UUID NOT NULL REFERENCES raw_records(id) ON DELETE CASCADE,
    source data_source NOT NULL,
    source_record_id TEXT,
    fields_provided TEXT,
    linked_at TIMESTAMP NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS facility_sources_facility_idx ON facility_sources (facility_id)`;
  await sql`CREATE INDEX IF NOT EXISTS facility_sources_raw_record_idx ON facility_sources (raw_record_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS facility_sources_unique_idx ON facility_sources (facility_id, raw_record_id)`;
  console.log('  facility_sources created');

  // match_candidates
  await sql`CREATE TABLE IF NOT EXISTS match_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_a_id UUID NOT NULL REFERENCES raw_records(id) ON DELETE CASCADE,
    record_b_id UUID NOT NULL REFERENCES raw_records(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    raw_record_id UUID REFERENCES raw_records(id) ON DELETE CASCADE,
    match_type match_type NOT NULL,
    status match_status NOT NULL DEFAULT 'pending',
    confidence_score INTEGER NOT NULL,
    score_breakdown TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    source_run_id UUID REFERENCES source_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS match_candidates_status_idx ON match_candidates (status)`;
  await sql`CREATE INDEX IF NOT EXISTS match_candidates_confidence_idx ON match_candidates (confidence_score)`;
  await sql`CREATE INDEX IF NOT EXISTS match_candidates_facility_idx ON match_candidates (facility_id)`;
  await sql`CREATE INDEX IF NOT EXISTS match_candidates_record_a_idx ON match_candidates (record_a_id)`;
  await sql`CREATE INDEX IF NOT EXISTS match_candidates_record_b_idx ON match_candidates (record_b_id)`;
  console.log('  match_candidates created');

  // naics_codes
  await sql`CREATE TABLE IF NOT EXISTS naics_codes (
    code VARCHAR(6) PRIMARY KEY,
    title TEXT NOT NULL,
    level INTEGER NOT NULL,
    parent_code VARCHAR(6),
    is_manufacturing INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE INDEX IF NOT EXISTS naics_codes_parent_idx ON naics_codes (parent_code)`;
  await sql`CREATE INDEX IF NOT EXISTS naics_codes_mfg_idx ON naics_codes (is_manufacturing)`;
  console.log('  naics_codes created');

  // sic_naics_crosswalk
  await sql`CREATE TABLE IF NOT EXISTS sic_naics_crosswalk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sic_code VARCHAR(4) NOT NULL,
    sic_description TEXT,
    naics_code VARCHAR(6) NOT NULL,
    naics_description TEXT
  )`;
  await sql`CREATE INDEX IF NOT EXISTS crosswalk_sic_idx ON sic_naics_crosswalk (sic_code)`;
  await sql`CREATE INDEX IF NOT EXISTS crosswalk_naics_idx ON sic_naics_crosswalk (naics_code)`;
  console.log('  sic_naics_crosswalk created');

  // exports
  await sql`CREATE TABLE IF NOT EXISTS exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status export_status NOT NULL DEFAULT 'pending',
    format TEXT NOT NULL DEFAULT 'csv',
    facility_count INTEGER NOT NULL DEFAULT 0,
    company_count INTEGER NOT NULL DEFAULT 0,
    filters TEXT,
    file_path TEXT,
    file_size INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    completed_at TIMESTAMP
  )`;
  console.log('  exports created');

  console.log('\nAll tables created successfully!');
  await sql.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
