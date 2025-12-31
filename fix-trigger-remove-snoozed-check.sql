-- Temporary fix: Remove snoozed_until check from trigger function
-- This allows account updates to work while we investigate the schema issue
-- The snoozed_until field is still in the table and can be used for filtering,
-- but the trigger won't check it for changes

-- Step 1: Drop the trigger
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts;

-- Step 2: Drop and recreate the function WITHOUT snoozed_until check
DROP FUNCTION IF EXISTS trigger_update_notifications_on_account_change() CASCADE;

CREATE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update if relevant fields changed
  -- NOTE: snoozed_until check removed temporarily to fix trigger errors
  -- The column still exists and can be used for filtering, but we don't
  -- trigger notification updates when it changes
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
  'Function recreated without snoozed_until check' as status,
  proname as function_name
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

SELECT 
  'Trigger recreated' as status,
  trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
  AND trigger_name = 'trg_accounts_update_notifications';

