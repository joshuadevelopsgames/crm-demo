-- Create duplicate_at_risk_estimates table for tracking bad data
-- This table tracks accounts with multiple at-risk estimates that have
-- the same department and address, indicating potential data quality issues

CREATE TABLE IF NOT EXISTS duplicate_at_risk_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  account_name text,
  division text,
  address text,
  estimate_ids text[] NOT NULL,
  estimate_numbers text[],
  contract_ends date[],
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  notes text
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_duplicate_account ON duplicate_at_risk_estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_resolved ON duplicate_at_risk_estimates(resolved_at);
CREATE INDEX IF NOT EXISTS idx_duplicate_detected ON duplicate_at_risk_estimates(detected_at);
CREATE INDEX IF NOT EXISTS idx_duplicate_unresolved ON duplicate_at_risk_estimates(account_id, resolved_at) WHERE resolved_at IS NULL;

-- Enable Row Level Security
ALTER TABLE duplicate_at_risk_estimates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS duplicate_estimates_authenticated_all ON duplicate_at_risk_estimates;
DROP POLICY IF EXISTS duplicate_estimates_service_role_all ON duplicate_at_risk_estimates;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY duplicate_estimates_authenticated_all ON duplicate_at_risk_estimates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy to allow service role (for API operations)
CREATE POLICY duplicate_estimates_service_role_all ON duplicate_at_risk_estimates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE duplicate_at_risk_estimates IS 'Tracks accounts with multiple at-risk estimates sharing the same department and address, indicating potential data quality issues that need review';
COMMENT ON COLUMN duplicate_at_risk_estimates.estimate_ids IS 'Array of estimate IDs that are duplicates';
COMMENT ON COLUMN duplicate_at_risk_estimates.estimate_numbers IS 'Array of estimate numbers for display';
COMMENT ON COLUMN duplicate_at_risk_estimates.contract_ends IS 'Array of contract end dates for the duplicate estimates';
COMMENT ON COLUMN duplicate_at_risk_estimates.resolved_at IS 'Timestamp when this duplicate issue was resolved (NULL = unresolved)';
COMMENT ON COLUMN duplicate_at_risk_estimates.resolved_by IS 'User ID or identifier of who resolved this issue';

