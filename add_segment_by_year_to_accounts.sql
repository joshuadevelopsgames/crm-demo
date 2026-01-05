-- Migration: Add segment_by_year field to accounts table
-- This stores segments per year, similar to revenue_by_year
-- Format: { "2024": "A", "2025": "B", ... }

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS segment_by_year jsonb;

-- Index for efficient queries on segment_by_year
CREATE INDEX IF NOT EXISTS idx_accounts_segment_by_year 
ON accounts USING gin (segment_by_year);

-- Comment on the column
COMMENT ON COLUMN accounts.segment_by_year IS 'Historical revenue segments by year, stored as JSONB. Format: {"2024": "A", "2025": "B", ...}. Calculated during import for all years.';

