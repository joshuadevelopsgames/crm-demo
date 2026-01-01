-- Optimized Notification System
-- This creates an efficient notification list that's maintained by database triggers
-- On page load, we just query the pre-built list instead of recalculating everything

-- ============================================================================
-- PART 1: Optimize the update_notification_state_for_account function
-- ============================================================================

-- Improved version that's more efficient and handles edge cases better
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
  renewal_date date;
  days_until_renewal int;
  account_estimates RECORD;
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
    -- Remove notifications for this account from all users
    UPDATE user_notification_states
    SET notifications = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(notifications) elem
      WHERE elem->>'related_account_id' != account_id_param
    ),
    updated_at = now()
    WHERE notifications @> jsonb_build_array(jsonb_build_object('related_account_id', account_id_param));
    RETURN;
  END IF;
  
  -- Check if account should have neglected notification
  IF account_record.last_interaction_date IS NULL THEN
    should_have_neglected_notif := true;
    days_since_interaction := NULL;
  ELSE
    threshold_days := CASE 
      WHEN account_record.revenue_segment IN ('A', 'B') THEN 30 
      ELSE 90 
    END;
    days_since_interaction := (today_date - account_record.last_interaction_date::date);
    should_have_neglected_notif := days_since_interaction > threshold_days;
  END IF;
  
  -- Check if account should have renewal notification
  -- Get renewal date from estimates
  SELECT MIN(contract_end) INTO renewal_date
  FROM estimates
  WHERE account_id = account_id_param
    AND contract_end IS NOT NULL
    AND status IN ('Contract Signed', 'Work Complete', 'Billing Complete', 'Email Contract Award', 'Verbal Contract Award');
  
  IF renewal_date IS NOT NULL THEN
    days_until_renewal := (renewal_date::date - today_date);
    -- Account should be at_risk if renewal is within 180 days (including past renewals)
    should_have_renewal_notif := account_record.status = 'at_risk' AND days_until_renewal <= 180 AND days_until_renewal >= -30;
  ELSE
    should_have_renewal_notif := false;
  END IF;
  
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
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(current_notifications) elem
      WHERE elem->>'related_account_id' != account_id_param
    );
    
    IF updated_notifications IS NULL THEN
      updated_notifications := '[]'::jsonb;
    END IF;
    
    -- Add neglected_account notification if needed
    IF should_have_neglected_notif THEN
      -- Check if notification is snoozed
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
            CASE 
              WHEN days_since_interaction IS NULL THEN 'No interactions logged'
              ELSE 'No contact in ' || days_since_interaction || ' day' || CASE WHEN days_since_interaction != 1 THEN 's' ELSE '' END
            END,
            'No interactions logged'
          ),
          'related_account_id', account_id_param,
          'related_task_id', null,
          'is_read', false,
          'created_at', now()::text,
          'scheduled_for', now()::text
        );
        updated_notifications := updated_notifications || jsonb_build_array(notification_obj);
      END IF;
    END IF;
    
    -- Add renewal_reminder notification if needed
    IF should_have_renewal_notif THEN
      -- Check if notification is snoozed
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
          'message', CASE 
            WHEN days_until_renewal < 0 THEN 
              'Contract expired ' || ABS(days_until_renewal) || ' day' || CASE WHEN ABS(days_until_renewal) != 1 THEN 's' ELSE '' END || ' ago - URGENT'
            WHEN days_until_renewal = 0 THEN 
              'Contract renewal is today - URGENT'
            ELSE 
              'Contract renewal is in ' || days_until_renewal || ' day' || CASE WHEN days_until_renewal != 1 THEN 's' ELSE '' END || ' (' || TO_CHAR(renewal_date, 'Mon DD, YYYY') || ')'
          END,
          'related_account_id', account_id_param,
          'related_task_id', null,
          'is_read', false,
          'created_at', now()::text,
          'scheduled_for', renewal_date::text
        );
        updated_notifications := updated_notifications || jsonb_build_array(notification_obj);
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

-- ============================================================================
-- PART 2: Create function to rebuild all notifications (for initial setup)
-- ============================================================================

-- This function rebuilds notifications for ALL accounts
-- Use this for initial setup or manual refresh, NOT on every page load
CREATE OR REPLACE FUNCTION rebuild_all_notifications()
RETURNS void AS $$
DECLARE
  account_record RECORD;
  processed_count int := 0;
BEGIN
  RAISE NOTICE 'Starting notification rebuild for all accounts...';
  
  -- Process each account
  FOR account_record IN SELECT id FROM accounts LOOP
    PERFORM update_notification_state_for_account(account_record.id);
    processed_count := processed_count + 1;
    
    -- Log progress every 100 accounts
    IF processed_count % 100 = 0 THEN
      RAISE NOTICE 'Processed % accounts...', processed_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Notification rebuild complete. Processed % accounts.', processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 3: Update trigger function (remove snoozed_until reference)
-- ============================================================================

-- Update trigger function to remove snoozed_until check (we use notification_snoozes now)
CREATE OR REPLACE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if relevant fields changed
  -- NOTE: snoozed_until is NOT checked - we use notification_snoozes table instead
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 4: Create trigger on estimates table (for renewal date changes)
-- ============================================================================

-- When estimates change, we need to update notifications for the related account
CREATE OR REPLACE FUNCTION trigger_update_notifications_on_estimate_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update notifications for the account when estimate changes
  IF NEW.account_id IS NOT NULL THEN
    PERFORM update_notification_state_for_account(NEW.account_id);
  END IF;
  
  -- Also update if account_id changed
  IF OLD.account_id IS NOT NULL AND OLD.account_id != NEW.account_id THEN
    PERFORM update_notification_state_for_account(OLD.account_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on estimates table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'estimates'
  ) THEN
    DROP TRIGGER IF EXISTS trg_estimates_update_notifications ON estimates;
    CREATE TRIGGER trg_estimates_update_notifications
      AFTER INSERT OR UPDATE OR DELETE ON estimates
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_notifications_on_estimate_change();
    
    RAISE NOTICE 'Created trigger on estimates table';
  ELSE
    RAISE NOTICE 'Estimates table does not exist yet. Skipping trigger creation.';
  END IF;
END $$;

-- ============================================================================
-- PART 5: Add comments and documentation
-- ============================================================================

COMMENT ON FUNCTION update_notification_state_for_account IS 
  'Updates notification states for all users when a single account changes. Called by triggers. Efficient - only processes one account.';

COMMENT ON FUNCTION rebuild_all_notifications IS 
  'Rebuilds notifications for ALL accounts. Use for initial setup or manual refresh. DO NOT call on every page load - it''s expensive!';

COMMENT ON FUNCTION trigger_update_notifications_on_account_change IS 
  'Trigger function that updates notifications when account data changes. Only fires when relevant fields change.';

COMMENT ON FUNCTION trigger_update_notifications_on_estimate_change IS 
  'Trigger function that updates notifications when estimate data changes (affects renewal dates).';

