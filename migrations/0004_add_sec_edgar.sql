-- Add SEC EDGAR to data_source enum
ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'sec_edgar';

-- Add SEC EDGAR fields to raw_records
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS sec_cik text;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS sec_ticker text;
ALTER TABLE raw_records ADD COLUMN IF NOT EXISTS sec_sic_code text;
