-- Fix missing ICP columns in accounts table
-- This will add icp_required and icp_status columns if they don't exist

-- Add ICP status fields to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_required BOOLEAN DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_status TEXT DEFAULT 'required';

-- Set residential accounts to N/A by default (if they don't have a status set)
UPDATE accounts 
SET icp_status = 'na', icp_required = false 
WHERE classification = 'residential' 
  AND (icp_status IS NULL OR icp_status = 'required');

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_accounts_icp_status ON accounts(icp_status);

-- Verify the columns were added
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('icp_required', 'icp_status')
ORDER BY column_name;

-- Expected results:
-- icp_required: boolean, default true
-- icp_status: text, default 'required'

