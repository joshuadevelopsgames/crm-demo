-- Diagnose the actual schema issue
-- The function is clean, so the error must be coming from elsewhere

-- Step 1: Check if snoozed_until column actually exists
SELECT 
  'Column Check' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'accounts' 
  AND column_name = 'snoozed_until';

-- Step 2: Check ALL triggers on accounts table
SELECT 
  'All Triggers' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement,
  action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
ORDER BY trigger_name;

-- Step 3: Check if trigger is enabled or disabled
SELECT 
  t.trigger_name,
  pt.tgenabled as enabled_code,
  CASE pt.tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
    ELSE 'UNKNOWN: ' || pt.tgenabled::text
  END as enabled_status
FROM information_schema.triggers t
JOIN pg_trigger pt ON pt.tgname = t.trigger_name
JOIN pg_class pc ON pc.oid = pt.tgrelid
JOIN pg_namespace pn ON pn.oid = pc.relnamespace
WHERE t.event_object_table = 'accounts'
  AND pn.nspname = 'public';

-- Step 4: Check if update_notification_state_for_account references snoozed_until
SELECT 
  'update_notification_state_for_account check' as check_type,
  CASE 
    WHEN prosrc LIKE '%snoozed_until%' THEN '❌ References snoozed_until'
    WHEN prosrc LIKE '%snoozed%' THEN '⚠️ References snoozed (but not snoozed_until)'
    ELSE '✅ Clean'
  END as status,
  length(prosrc) as source_length
FROM pg_proc
WHERE proname = 'update_notification_state_for_account';

-- Step 5: Try to manually test if we can access snoozed_until column
DO $$
DECLARE
  test_val timestamptz;
BEGIN
  SELECT snoozed_until INTO test_val FROM accounts LIMIT 1;
  RAISE NOTICE '✅ Column snoozed_until is accessible';
EXCEPTION
  WHEN undefined_column THEN
    RAISE NOTICE '❌ Column snoozed_until does NOT exist in accounts table';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Error accessing column: %', SQLERRM;
END $$;

-- Step 6: Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('snoozed_until', 'status', 'archived', 'last_interaction_date', 'revenue_segment', 'icp_status')
ORDER BY column_name;

