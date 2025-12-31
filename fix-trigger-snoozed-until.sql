-- Fix trigger function to recognize snoozed_until column
-- This recreates the trigger function so PostgreSQL recompiles it with the current schema

-- Recreate the trigger function (this will force PostgreSQL to recompile it with current schema)
CREATE OR REPLACE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if relevant fields changed
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.snoozed_until IS DISTINCT FROM NEW.snoozed_until)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the function was recreated
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

