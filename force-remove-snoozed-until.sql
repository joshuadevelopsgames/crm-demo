-- Force remove snoozed_until from trigger function
-- This script shows the current function and forces a complete recreation

-- Step 1: Show current function definition
SELECT 
  'CURRENT FUNCTION DEFINITION' as step,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Step 2: Drop trigger with CASCADE to remove all dependencies
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts CASCADE;

-- Step 3: Drop function with ALL possible signatures
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Drop all versions of the function
  FOR func_record IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'trigger_update_notifications_on_account_change'
  LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.proname || '(' || func_record.args || ') CASCADE';
      RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping function: %', SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 4: Verify function is gone
SELECT 
  'Functions remaining' as check_type,
  COUNT(*) as count,
  string_agg(proname || '(' || pg_get_function_identity_arguments(oid) || ')', ', ') as functions
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Step 5: Recreate function with EXPLICIT check that it doesn't reference snoozed_until
CREATE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  -- Only update if relevant fields changed
  -- EXPLICITLY NOT checking snoozed_until - we use notification_snoozes table instead
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$func$;

-- Step 6: Verify the new function does NOT reference snoozed_until
SELECT 
  'VERIFICATION' as step,
  proname,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%snoozed_until%' THEN '❌ FAILED: Still references snoozed_until!'
    WHEN pg_get_functiondef(oid) LIKE '%OLD.snoozed%' THEN '❌ FAILED: Still references OLD.snoozed!'
    WHEN pg_get_functiondef(oid) LIKE '%NEW.snoozed%' THEN '❌ FAILED: Still references NEW.snoozed!'
    ELSE '✅ SUCCESS: No snoozed_until reference found'
  END as verification_result,
  pg_get_functiondef(oid) as full_definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Step 7: Show the actual function body to verify
SELECT 
  'FUNCTION BODY CHECK' as step,
  CASE 
    WHEN prosrc LIKE '%snoozed_until%' THEN '❌ FAILED: Function body contains snoozed_until!'
    WHEN prosrc LIKE '%OLD.snoozed%' THEN '❌ FAILED: Function body contains OLD.snoozed!'
    WHEN prosrc LIKE '%NEW.snoozed%' THEN '❌ FAILED: Function body contains NEW.snoozed!'
    ELSE '✅ SUCCESS: Function body is clean'
  END as body_check,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

