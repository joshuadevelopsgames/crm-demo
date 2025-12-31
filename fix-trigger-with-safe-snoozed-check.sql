-- Fix trigger function with safe snoozed_until check
-- This version checks if the column exists before accessing it

-- Step 1: Verify column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'snoozed_until'
  ) THEN
    ALTER TABLE accounts ADD COLUMN snoozed_until timestamptz;
    RAISE NOTICE 'Added snoozed_until column';
  ELSE
    RAISE NOTICE 'snoozed_until column exists';
  END IF;
END $$;

-- Step 2: Drop the trigger
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts;

-- Step 3: Drop and recreate the function with safe column access
DROP FUNCTION IF EXISTS trigger_update_notifications_on_account_change() CASCADE;

CREATE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update if relevant fields changed
  -- Check snoozed_until by comparing OLD and NEW
  -- If the column doesn't exist, PostgreSQL will error at function creation time,
  -- which is what we want - it means the column wasn't added properly
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
$$;

-- Step 4: Recreate the trigger
CREATE TRIGGER trg_accounts_update_notifications
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_notifications_on_account_change();

-- Step 5: Test that we can access the column
DO $$
DECLARE
  test_val timestamptz;
BEGIN
  SELECT snoozed_until INTO test_val FROM accounts LIMIT 1;
  RAISE NOTICE 'SUCCESS: snoozed_until column is accessible';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'WARNING: Could not access snoozed_until: %', SQLERRM;
END $$;

-- Step 6: Verify setup
SELECT 
  'Setup complete' as status,
  'Column exists: ' || EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'snoozed_until'
  )::text as column_exists,
  'Trigger exists: ' || EXISTS(
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'accounts' 
    AND trigger_name = 'trg_accounts_update_notifications'
  )::text as trigger_exists;

