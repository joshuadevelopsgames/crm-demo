-- Update notification system to use at_risk_accounts table
-- This replaces the logic that checked account.status = 'at_risk'

-- ============================================================================
-- Updated function: Update notification state for account (uses at_risk_accounts table)
-- ============================================================================
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
  at_risk_record RECORD;
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
  
  -- Check if account should have renewal notification (from at_risk_accounts table)
  SELECT * INTO at_risk_record 
  FROM at_risk_accounts 
  WHERE account_id = account_id_param;
  
  should_have_renewal_notif := FOUND; -- Account is in at_risk_accounts table
  
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
      -- Check if notification is snoozed (only if table exists)
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
    
    -- Add renewal_reminder notification if account is in at_risk_accounts table
    IF should_have_renewal_notif THEN
      -- Note: We don't check snoozes here because if account is in at_risk_accounts,
      -- it means it's not snoozed (snoozed accounts are removed from the table)
      notification_obj := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'renewal_reminder',
        'title', 'Renewal Reminder: ' || COALESCE(account_record.name, 'Unknown'),
        'message', CASE 
          WHEN at_risk_record.days_until_renewal < 0 THEN 
            'Account is at risk - renewal date has passed (' || ABS(at_risk_record.days_until_renewal) || ' days ago)'
          WHEN at_risk_record.days_until_renewal = 0 THEN 
            'Account is at risk - renewal is today'
          ELSE 
            'Account is at risk - renewal in ' || at_risk_record.days_until_renewal || ' days'
        END,
        'related_account_id', account_id_param,
        'related_task_id', null,
        'is_read', false,
        'created_at', now()::text,
        'scheduled_for', now()::text
      );
      updated_notifications := updated_notifications || notification_obj;
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

-- ============================================================================
-- Trigger: Update notifications when at_risk_accounts table changes
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_update_notifications_on_at_risk_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update notifications when account is added/removed from at_risk_accounts
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_notification_state_for_account(NEW.account_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_notification_state_for_account(OLD.account_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on at_risk_accounts table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'at_risk_accounts'
  ) THEN
    DROP TRIGGER IF EXISTS trg_at_risk_accounts_update_notifications ON at_risk_accounts;
    CREATE TRIGGER trg_at_risk_accounts_update_notifications
      AFTER INSERT OR UPDATE OR DELETE ON at_risk_accounts
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_notifications_on_at_risk_change();
    
    RAISE NOTICE 'Created trigger on at_risk_accounts table for notification updates';
  ELSE
    RAISE NOTICE 'at_risk_accounts table does not exist yet. Skipping trigger creation.';
  END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION update_notification_state_for_account IS 
  'Updates notification states for all users when an account changes. Now uses at_risk_accounts table instead of account.status.';
COMMENT ON FUNCTION trigger_update_notifications_on_at_risk_change IS 
  'Trigger function that updates notifications when at_risk_accounts table changes.';

