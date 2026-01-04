-- Migration: Simplify ICP status to two options (required or na)
-- Convert all 'not_required' records to 'na' since they mean the same thing

-- Update all accounts with 'not_required' status to 'na'
UPDATE accounts 
SET icp_status = 'na', 
    icp_required = false
WHERE icp_status = 'not_required';

-- Update the column comment to reflect the new two-option system
COMMENT ON COLUMN accounts.icp_status IS 'ICP status: required (ICP scorecard required) or na (ICP scorecard not required)';

-- Verify the migration
SELECT 
  icp_status,
  COUNT(*) as count
FROM accounts
GROUP BY icp_status
ORDER BY icp_status;

-- Expected results:
-- na: [count of accounts that don't require ICP]
-- required: [count of accounts that require ICP]
-- (should be no 'not_required' records)

