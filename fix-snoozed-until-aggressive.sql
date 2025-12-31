-- Aggressive fix for snoozed_until trigger issue
-- This script completely removes and recreates everything to force PostgreSQL to recognize the column

-- Step 1: Verify column exists (if not, add it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'snoozed_until'
  ) THEN
    ALTER TABLE accounts ADD COLUMN snoozed_until timestamptz;
    RAISE NOTICE 'Added snoozed_until column';
  ELSE
    RAISE NOTICE 'snoozed_until column already exists';
  END IF;
END $$;

-- Step 2: Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_accounts_snoozed_until ON accounts(snoozed_until) 
WHERE snoozed_until IS NOT NULL;

-- Step 3: Drop the trigger FIRST (before dropping the function)
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts;

-- Step 4: Drop the function (CASCADE will handle any remaining dependencies)
DROP FUNCTION IF EXISTS trigger_update_notifications_on_account_change() CASCADE;

-- Step 5: Wait a moment (PostgreSQL doesn't have sleep, but we can use a dummy query)
-- Actually, we don't need to wait - just proceed

-- Step 6: Recreate the function with explicit column reference
CREATE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update if relevant fields changed
  -- Explicitly check each field to ensure PostgreSQL recognizes them
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  
  -- Check snoozed_until separately - use explicit column check
  -- This ensures PostgreSQL recognizes the column exists
  IF (OLD.snoozed_until IS DISTINCT FROM NEW.snoozed_until) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 7: Recreate the trigger
CREATE TRIGGER trg_accounts_update_notifications
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_notifications_on_account_change();

-- Step 8: Force PostgreSQL to recognize the schema change by querying the column
DO $$
DECLARE
  test_value timestamptz;
BEGIN
  -- This query forces PostgreSQL to validate the column exists
  SELECT snoozed_until INTO test_value 
  FROM accounts 
  LIMIT 1;
  RAISE NOTICE 'Column snoozed_until is accessible';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error accessing snoozed_until column: %', SQLERRM;
END $$;

-- Step 9: Verify everything
SELECT 
  'Column' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts' 
  AND column_name = 'snoozed_until'
UNION ALL
SELECT 
  'Trigger' as check_type,
  trigger_name as column_name,
  'trigger' as data_type,
  'N/A' as is_nullable
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
  AND trigger_name = 'trg_accounts_update_notifications'
UNION ALL
SELECT 
  'Function' as check_type,
  proname as column_name,
  'function' as data_type,
  'N/A' as is_nullable
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

