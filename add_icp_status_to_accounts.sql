-- Add ICP status fields to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_required BOOLEAN DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_status TEXT DEFAULT 'required';

-- Set residential accounts to N/A by default
UPDATE accounts 
SET icp_status = 'na', icp_required = false 
WHERE classification = 'residential' AND (icp_status IS NULL OR icp_status = 'required');

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_accounts_icp_status ON accounts(icp_status);

-- Add comment for documentation
COMMENT ON COLUMN accounts.icp_status IS 'ICP status: required, not_required, or na';
COMMENT ON COLUMN accounts.icp_required IS 'Whether ICP scorecard is required for this account';

