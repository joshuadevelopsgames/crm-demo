-- Fix trigger function to remove snoozed_until reference
-- The snoozed_until column was removed from accounts table
-- We now use notification_snoozes table for snoozing instead

-- Step 1: Drop the trigger
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts;

-- Step 2: Drop and recreate the function WITHOUT snoozed_until check
DROP FUNCTION IF EXISTS trigger_update_notifications_on_account_change() CASCADE;

CREATE OR REPLACE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update if relevant fields changed
  -- NOTE: snoozed_until check removed - we use notification_snoozes table instead
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

-- Step 3: Recreate the trigger
CREATE TRIGGER trg_accounts_update_notifications
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_notifications_on_account_change();

-- Step 4: Verify
SELECT 
  'Trigger function fixed - snoozed_until removed' as status,
  proname as function_name
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

SELECT 
  'Trigger recreated' as status,
  trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
  AND trigger_name = 'trg_accounts_update_notifications';

