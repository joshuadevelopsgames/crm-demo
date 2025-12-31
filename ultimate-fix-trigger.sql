-- Ultimate fix: Drop by OID and force complete recreation
-- This bypasses any signature/caching issues

-- Step 1: Show ALL functions with this name (including their OIDs)
SELECT 
  'ALL FUNCTIONS WITH THIS NAME' as step,
  oid,
  proname,
  pg_get_function_identity_arguments(oid) as arguments,
  pg_get_functiondef(oid) as full_definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Step 2: Drop trigger first
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts CASCADE;

-- Step 3: Drop function by OID (most reliable method)
DO $$
DECLARE
  func_oid oid;
  func_def text;
BEGIN
  FOR func_oid IN 
    SELECT oid FROM pg_proc 
    WHERE proname = 'trigger_update_notifications_on_account_change'
  LOOP
    -- Get the function definition for logging
    SELECT pg_get_functiondef(oid) INTO func_def FROM pg_proc WHERE oid = func_oid;
    RAISE NOTICE 'Dropping function OID: %, Definition: %', func_oid, func_def;
    
    -- Drop by OID
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- Step 4: Force a commit/sync point
COMMIT;

-- Step 5: Verify it's completely gone
DO $$
DECLARE
  func_count int;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname = 'trigger_update_notifications_on_account_change';
  
  IF func_count > 0 THEN
    RAISE EXCEPTION 'Function still exists! Count: %', func_count;
  ELSE
    RAISE NOTICE '✅ Function successfully removed';
  END IF;
END $$;

-- Step 6: Recreate with a completely clean definition
-- Using a different dollar-quote tag to avoid any issues
CREATE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $clean_func$
BEGIN
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  RETURN NEW;
END;
$clean_func$;

-- Step 7: Final verification - check the actual source code
SELECT 
  'FINAL VERIFICATION' as step,
  oid,
  proname,
  CASE 
    WHEN prosrc LIKE '%snoozed_until%' OR prosrc LIKE '%snoozed%' THEN '❌ FAILED'
    ELSE '✅ SUCCESS'
  END as status,
  prosrc as actual_source_code
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Step 8: Show full definition for manual inspection
SELECT 
  'FULL DEFINITION' as step,
  pg_get_functiondef(oid) as complete_definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

