-- Check ALL triggers on the accounts table
-- This will help us identify if there are other triggers causing the issue

-- List all triggers on accounts table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement,
  action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
ORDER BY trigger_name;

-- Check if trigger is actually disabled
SELECT 
  t.trigger_name,
  pt.tgenabled as enabled_status,
  CASE pt.tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
    ELSE 'UNKNOWN'
  END as status_description
FROM information_schema.triggers t
JOIN pg_trigger pt ON pt.tgname = t.trigger_name
JOIN pg_class pc ON pc.oid = pt.tgrelid
JOIN pg_namespace pn ON pn.oid = pc.relnamespace
WHERE t.event_object_table = 'accounts'
  AND pn.nspname = 'public';

-- Check all functions that might reference accounts table
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE pg_get_functiondef(oid) LIKE '%accounts%'
  AND (pg_get_functiondef(oid) LIKE '%OLD%' OR pg_get_functiondef(oid) LIKE '%NEW%')
ORDER BY proname;

-- Specifically check for any function that references snoozed_until
SELECT 
  proname as function_name,
  'References snoozed_until' as issue
FROM pg_proc
WHERE pg_get_functiondef(oid) LIKE '%snoozed_until%'
ORDER BY proname;

