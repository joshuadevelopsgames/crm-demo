-- Migration: Add total_estimates_by_year field to accounts table
-- This stores total estimate counts (won + lost) per year, similar to revenue_by_year
-- Format: { "2024": 15, "2025": 23, ... }
-- Per Estimates spec R20-R23: Pre-calculated during import to avoid on-the-fly filtering

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS total_estimates_by_year jsonb;

-- Index for efficient queries on total_estimates_by_year
CREATE INDEX IF NOT EXISTS idx_accounts_total_estimates_by_year 
ON accounts USING gin (total_estimates_by_year);

-- Comment on the column
COMMENT ON COLUMN accounts.total_estimates_by_year IS 'Total estimates count (won + lost, excluding archived) by year, stored as JSONB. Format: {"2024": 15, "2025": 23, ...}. Calculated during import for all years. Per Estimates spec R20-R23.';

