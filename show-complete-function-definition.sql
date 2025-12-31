-- Show the complete function definition in full
-- This will help us see exactly what's in the function

-- Method 1: Get the full definition
SELECT 
  pg_get_functiondef(oid) as complete_function_definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Method 2: Get just the function body (prosrc)
SELECT 
  prosrc as function_body_source_code
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Method 3: Check for snoozed_until in various ways
SELECT 
  'Search Results' as check_type,
  CASE WHEN pg_get_functiondef(oid) LIKE '%snoozed_until%' THEN 'Found in full definition' ELSE 'Not in full definition' END as in_full_def,
  CASE WHEN prosrc LIKE '%snoozed_until%' THEN 'Found in source' ELSE 'Not in source' END as in_source,
  CASE WHEN prosrc LIKE '%OLD.snoozed%' THEN 'Found OLD.snoozed' ELSE 'No OLD.snoozed' END as has_old_snoozed,
  CASE WHEN prosrc LIKE '%NEW.snoozed%' THEN 'Found NEW.snoozed' ELSE 'No NEW.snoozed' END as has_new_snoozed
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Method 4: Show the function with line breaks for readability
SELECT 
  regexp_replace(
    regexp_replace(
      pg_get_functiondef(oid),
      ';', E';\n', 'g'
    ),
    'BEGIN|END|IF|THEN|ELSE|OR|AND', E'\n&', 'g'
  ) as formatted_definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

