-- Complete fix for snoozed_until column and trigger function
-- Run this in production Supabase SQL Editor

-- Step 1: Ensure the column exists
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- Step 2: Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_accounts_snoozed_until ON accounts(snoozed_until) 
WHERE snoozed_until IS NOT NULL;

-- Step 3: Drop and recreate the trigger function to force recompilation
-- This ensures PostgreSQL recognizes the new column
DROP FUNCTION IF EXISTS trigger_update_notifications_on_account_change() CASCADE;

CREATE OR REPLACE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if relevant fields changed
  -- Now that snoozed_until column exists, we can safely reference it
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.snoozed_until IS DISTINCT FROM NEW.snoozed_until)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate the trigger
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts;

CREATE TRIGGER trg_accounts_update_notifications
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_notifications_on_account_change();

-- Step 5: Verify everything is set up correctly
SELECT 
  'Column check' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'accounts' 
  AND column_name = 'snoozed_until'
UNION ALL
SELECT 
  'Trigger check' as check_type,
  trigger_name as column_name,
  'trigger' as data_type
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
  AND trigger_name = 'trg_accounts_update_notifications'
UNION ALL
SELECT 
  'Function check' as check_type,
  proname as column_name,
  'function' as data_type
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

