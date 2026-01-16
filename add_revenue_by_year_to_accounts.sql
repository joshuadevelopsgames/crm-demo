-- Migration: Add revenue_by_year field to accounts table
-- This stores revenue per year, calculated during import
-- Format: { "2024": 50000, "2025": 75000, ... }
-- Per Revenue Logic spec R25: Calculated during import for all years

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS revenue_by_year jsonb;

-- Index for efficient queries on revenue_by_year
CREATE INDEX IF NOT EXISTS idx_accounts_revenue_by_year 
ON accounts USING gin (revenue_by_year);

-- Comment on the column
COMMENT ON COLUMN accounts.revenue_by_year IS 'Historical revenue by year, stored as JSONB. Format: {"2024": 50000, "2025": 75000, ...}. Calculated during import for all years. Per Revenue Logic spec R25.';
