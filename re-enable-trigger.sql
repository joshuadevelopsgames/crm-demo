-- Re-enable the trigger after verifying it's fixed
-- Only run this after confirming the trigger function no longer references snoozed_until

-- Re-enable the trigger
ALTER TABLE accounts ENABLE TRIGGER trg_accounts_update_notifications;

-- Verify it's enabled
SELECT 
  'Trigger status' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  CASE 
    WHEN tgisinternal THEN 'ENABLED'
    ELSE 'DISABLED'
  END as status
FROM information_schema.triggers t
JOIN pg_trigger pt ON pt.tgname = t.trigger_name
WHERE event_object_table = 'accounts'
  AND trigger_name = 'trg_accounts_update_notifications';

-- Also verify the function definition doesn't have snoozed_until
SELECT 
  'Function check' as check_type,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%snoozed_until%' THEN 'WARNING: Function still references snoozed_until!'
    ELSE 'OK: Function does not reference snoozed_until'
  END as status
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

