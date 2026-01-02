-- Add snoozed_until column back to accounts table with NULL values
-- This fixes the trigger error while we use notification_snoozes table for actual snoozing
-- The column will exist but won't be actively used

-- Step 1: Add the column if it doesn't exist
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- Step 2: Create index for the column
CREATE INDEX IF NOT EXISTS idx_accounts_snoozed_until ON accounts(snoozed_until) 
WHERE snoozed_until IS NOT NULL;

-- Step 3: Force recreate ALL notification-related functions to ensure they recognize the column
-- This ensures PostgreSQL recognizes the column exists

-- Drop and recreate update_notification_state_for_account function
DROP FUNCTION IF EXISTS update_notification_state_for_account(text) CASCADE;

CREATE OR REPLACE FUNCTION update_notification_state_for_account(account_id_param text)
RETURNS void AS $$
DECLARE
  user_record RECORD;
  account_record RECORD;
  should_have_neglected_notif boolean := false;
  should_have_renewal_notif boolean := false;
  notification_obj jsonb;
  current_notifications jsonb;
  updated_notifications jsonb;
  threshold_days int;
  days_since_interaction int;
  today_date date := CURRENT_DATE;
BEGIN
  -- Check if required tables exist
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notification_states'
  ) THEN
    RAISE NOTICE 'user_notification_states table does not exist. Skipping notification update.';
    RETURN;
  END IF;
  
  -- Get the account
  SELECT * INTO account_record FROM accounts WHERE id = account_id_param;
  IF NOT FOUND THEN RETURN; END IF;
  
  -- Skip if archived or ICP status = 'na'
  IF account_record.archived = true OR account_record.icp_status = 'na' THEN
    -- Remove notifications for this account
    FOR user_record IN SELECT id FROM auth.users LOOP
      UPDATE user_notification_states
      SET notifications = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(notifications) elem
        WHERE elem->>'related_account_id' != account_id_param
      ),
      updated_at = now()
      WHERE user_id = user_record.id::text;
    END LOOP;
    RETURN;
  END IF;
  
  -- Check if account should have neglected notification
  IF account_record.last_interaction_date IS NULL THEN
    should_have_neglected_notif := true;
  ELSE
    threshold_days := CASE 
      WHEN account_record.revenue_segment IN ('A', 'B') THEN 30 
      ELSE 90 
    END;
    days_since_interaction := (today_date - account_record.last_interaction_date::date);
    should_have_neglected_notif := days_since_interaction > threshold_days;
  END IF;
  
  -- Check if account should have renewal notification (at_risk status)
  should_have_renewal_notif := account_record.status = 'at_risk';
  
  -- Update each user's notification state
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Get current notifications
    SELECT notifications INTO current_notifications
    FROM user_notification_states
    WHERE user_id = user_record.id::text;
    
    IF current_notifications IS NULL THEN
      current_notifications := '[]'::jsonb;
    END IF;
    
    -- Remove old notifications for this account
    updated_notifications := (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(current_notifications) elem
      WHERE elem->>'related_account_id' != account_id_param
    );
    
    IF updated_notifications IS NULL THEN
      updated_notifications := '[]'::jsonb;
    END IF;
    
    -- Add neglected_account notification if needed
    IF should_have_neglected_notif THEN
      -- Check if notification is snoozed (using notification_snoozes table)
      IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_snoozes'
      ) OR NOT EXISTS (
        SELECT 1 FROM notification_snoozes 
        WHERE notification_type = 'neglected_account' 
        AND related_account_id = account_id_param
        AND snoozed_until > now()
      ) THEN
        notification_obj := jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'neglected_account',
          'title', 'Neglected Account: ' || COALESCE(account_record.name, 'Unknown'),
          'message', COALESCE(
            'No contact in ' || days_since_interaction || ' days',
            'No interactions logged'
          ),
          'related_account_id', account_id_param,
          'related_task_id', null,
          'is_read', false,
          'created_at', now()::text,
          'scheduled_for', now()::text
        );
        updated_notifications := updated_notifications || notification_obj;
      END IF;
    END IF;
    
    -- Add renewal_reminder notification if needed
    IF should_have_renewal_notif THEN
      -- Check if notification is snoozed (using notification_snoozes table)
      IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_snoozes'
      ) OR NOT EXISTS (
        SELECT 1 FROM notification_snoozes 
        WHERE notification_type = 'renewal_reminder' 
        AND related_account_id = account_id_param
        AND snoozed_until > now()
      ) THEN
        notification_obj := jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'renewal_reminder',
          'title', 'Renewal Reminder: ' || COALESCE(account_record.name, 'Unknown'),
          'message', 'Account is at risk - renewal coming up',
          'related_account_id', account_id_param,
          'related_task_id', null,
          'is_read', false,
          'created_at', now()::text,
          'scheduled_for', now()::text
        );
        updated_notifications := updated_notifications || notification_obj;
      END IF;
    END IF;
    
    -- Update user's notification state
    INSERT INTO user_notification_states (user_id, notifications, updated_at)
    VALUES (user_record.id::text, updated_notifications, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      notifications = EXCLUDED.notifications,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate trigger function (can now safely reference snoozed_until even if we don't use it)
DROP FUNCTION IF EXISTS trigger_update_notifications_on_account_change() CASCADE;

CREATE OR REPLACE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update if relevant fields changed
  -- NOTE: snoozed_until column exists but we don't actively check it (we use notification_snoozes table)
  -- We include it in the check to avoid errors, but it won't trigger updates since it's always NULL
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
$$;

-- Step 5: Recreate the trigger
DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts;

CREATE TRIGGER trg_accounts_update_notifications
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_notifications_on_account_change();

-- Step 6: Verify
SELECT 
  'Column added' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts' 
  AND column_name = 'snoozed_until';

SELECT 
  'Trigger recreated' as status,
  trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
  AND trigger_name = 'trg_accounts_update_notifications';


