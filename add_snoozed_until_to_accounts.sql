-- Add snoozed_until field to accounts table
-- This allows accounts to be temporarily hidden from neglected accounts list

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- Add index for faster queries when filtering neglected accounts
CREATE INDEX IF NOT EXISTS idx_accounts_snoozed_until ON accounts(snoozed_until) 
WHERE snoozed_until IS NOT NULL;

