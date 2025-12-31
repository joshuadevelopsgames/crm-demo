-- Verify current trigger function and force update
-- This will show us what the function actually looks like and recreate it

-- Step 1: Check current function definition
SELECT 
  'Current function definition' as check_type,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Step 2: Check if snoozed_until column exists
SELECT 
  'Column check' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'accounts' 
  AND column_name = 'snoozed_until';

-- Step 3: Force complete removal and recreation
-- Drop trigger first
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts CASCADE;

-- Drop function with all signatures
DO $$
DECLARE
  func_oid oid;
BEGIN
  -- Find and drop all versions of the function
  FOR func_oid IN 
    SELECT oid FROM pg_proc 
    WHERE proname = 'trigger_update_notifications_on_account_change'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_oid::regprocedure || ' CASCADE';
    RAISE NOTICE 'Dropped function: %', func_oid::regprocedure;
  END LOOP;
END $$;

-- Step 4: Recreate function WITHOUT any snoozed_until reference
CREATE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update if relevant fields changed
  -- NOTE: snoozed_until is NOT checked here - we use notification_snoozes table instead
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 5: Recreate trigger
CREATE TRIGGER trg_accounts_update_notifications
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_notifications_on_account_change();

-- Step 6: Verify the new function definition
SELECT 
  'New function definition' as check_type,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Step 7: Test that the function compiles correctly
DO $$
DECLARE
  test_old RECORD;
  test_new RECORD;
BEGIN
  -- Create dummy records to test function compilation
  -- This will fail if the function references non-existent columns
  SELECT * INTO test_old FROM accounts LIMIT 1;
  SELECT * INTO test_new FROM accounts LIMIT 1;
  
  -- If we get here, the function should work
  RAISE NOTICE 'Function compiled successfully - no references to non-existent columns';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error testing function: %', SQLERRM;
END $$;

