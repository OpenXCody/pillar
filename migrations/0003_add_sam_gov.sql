-- Add SAM.gov to data_source enum
ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'sam_gov';

-- Add SAM.gov fields to raw_records
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS sam_cage_code TEXT;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS sam_uei_number TEXT;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS sam_business_types TEXT;
