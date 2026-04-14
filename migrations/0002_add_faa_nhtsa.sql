-- Add FAA and NHTSA to data_source enum
ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'faa';
ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'nhtsa';

-- Add FAA fields to raw_records
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS faa_approval_type text;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS faa_cert_number text;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS faa_holder_number text;

-- Add NHTSA fields to raw_records
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS nhtsa_mfr_id text;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS nhtsa_vehicle_types text;

-- Add FAA/NHTSA fields to facilities golden records
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS faa_approval_types text;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS nhtsa_mfr_id text;
