-- Remove the snoozed_until column from accounts table
-- We've migrated to notification-specific snoozing using the notification_snoozes table

-- Step 1: Drop the index if it exists
DROP INDEX IF EXISTS idx_accounts_snoozed_until;

-- Step 2: Drop the column
ALTER TABLE accounts DROP COLUMN IF EXISTS snoozed_until;

-- Step 3: Verify it's gone
SELECT 
  'Verification' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'accounts' AND column_name = 'snoozed_until'
    ) THEN '❌ Column still exists'
    ELSE '✅ Column successfully removed'
  END as status;

