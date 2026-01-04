-- Create at_risk_accounts table
-- This table tracks which accounts are currently at-risk and should show renewal notifications
-- Accounts are added when they become at-risk and removed when snoozed or no longer at-risk

CREATE TABLE IF NOT EXISTS at_risk_accounts (
  account_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  renewal_date date NOT NULL,
  days_until_renewal int NOT NULL,
  expiring_estimate_id text,
  expiring_estimate_number text,
  added_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_at_risk_accounts_renewal_date ON at_risk_accounts(renewal_date);
CREATE INDEX IF NOT EXISTS idx_at_risk_accounts_days_until ON at_risk_accounts(days_until_renewal);
CREATE INDEX IF NOT EXISTS idx_at_risk_accounts_added_at ON at_risk_accounts(added_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_at_risk_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_at_risk_accounts_updated_at
  BEFORE UPDATE ON at_risk_accounts 
  FOR EACH ROW EXECUTE FUNCTION set_at_risk_accounts_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE at_risk_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policy: all authenticated users can read at-risk accounts
CREATE POLICY at_risk_accounts_authenticated_read ON at_risk_accounts
  FOR SELECT TO authenticated 
  USING (true);

-- Only service role can insert/update/delete (managed by triggers and service functions)
CREATE POLICY at_risk_accounts_service_all ON at_risk_accounts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE at_risk_accounts IS 'Tracks accounts that are currently at-risk (have estimates expiring within 6 months). Accounts are automatically added/removed based on estimate renewal dates and snooze status.';

