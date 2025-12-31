-- Temporarily disable the trigger to allow account updates to work
-- This will let us fix the trigger issue without blocking account status updates

-- Disable the trigger
ALTER TABLE accounts DISABLE TRIGGER trg_accounts_update_notifications;

-- Verify it's disabled
SELECT 
  'Trigger status' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
  AND trigger_name = 'trg_accounts_update_notifications';

-- Note: Notifications will still be created by the periodic checks in the Dashboard
-- This just disables the automatic trigger on account updates

