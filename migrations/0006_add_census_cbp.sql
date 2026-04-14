-- Add Census CBP to data_source enum
ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'census_cbp';

-- Add Census CBP fields to raw_records
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS census_county_fips varchar(5);
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS census_establishment_count integer;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS census_annual_payroll integer;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS census_employees integer;

-- Index on county FIPS for coverage analysis queries
CREATE INDEX IF NOT EXISTS raw_records_census_county_fips_idx ON raw_records (census_county_fips) WHERE census_county_fips IS NOT NULL;
