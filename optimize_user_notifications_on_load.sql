-- Optimized function to refresh a single user's notifications on page load
-- This is called once per user when they load the page
-- It's fast because it only processes accounts that need notifications

CREATE OR REPLACE FUNCTION refresh_user_notifications(user_id_param text)
RETURNS jsonb AS $$
DECLARE
  account_record RECORD;
  should_have_neglected_notif boolean := false;
  should_have_renewal_notif boolean := false;
  notification_obj jsonb;
  updated_notifications jsonb := '[]'::jsonb;
  threshold_days int;
  days_since_interaction int;
  today_date date := CURRENT_DATE;
  renewal_date date;
  days_until_renewal int;
BEGIN
  -- Check if required tables exist
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notification_states'
  ) THEN
    RAISE NOTICE 'user_notification_states table does not exist. Skipping notification refresh.';
    RETURN '[]'::jsonb;
  END IF;
  
  -- Check if user exists
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id::text = user_id_param
  ) THEN
    RAISE NOTICE 'User % does not exist. Skipping notification refresh.', user_id_param;
    RETURN '[]'::jsonb;
  END IF;
  
  -- Process each account that might need notifications
  -- Only check accounts that are not archived and not excluded
  FOR account_record IN 
    SELECT * FROM accounts 
    WHERE archived = false 
    AND (icp_status IS NULL OR icp_status != 'na')
  LOOP
    -- Reset flags for this account
    should_have_neglected_notif := false;
    should_have_renewal_notif := false;
    
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
    
    -- If account needs renewal notification, calculate renewal date
    IF should_have_renewal_notif THEN
      -- Calculate renewal date: latest contract_end from won estimates
      SELECT MAX(contract_end::date) INTO renewal_date
      FROM estimates
      WHERE account_id = account_record.id
      AND status = 'won'
      AND contract_end IS NOT NULL;
      
      IF renewal_date IS NOT NULL THEN
        days_until_renewal := (renewal_date - today_date);
        -- Only show renewal notification if within 180 days (or past due)
        -- Include past renewals (negative days) as they're urgent
        IF days_until_renewal > 180 THEN
          should_have_renewal_notif := false;
        END IF;
      ELSE
        -- No renewal date found, don't show renewal notification
        should_have_renewal_notif := false;
      END IF;
    END IF;
    
    -- Add neglected_account notification if needed
    IF should_have_neglected_notif THEN
      -- Check if notification is snoozed
      IF NOT EXISTS (
        SELECT 1 FROM notification_snoozes 
        WHERE notification_type = 'neglected_account' 
        AND related_account_id = account_record.id
        AND snoozed_until > now()
      ) THEN
        notification_obj := jsonb_build_object(
          'id', 'neglected_' || account_record.id || '_' || user_id_param,
          'type', 'neglected_account',
          'title', 'Neglected Account: ' || COALESCE(account_record.name, 'Unknown'),
          'message', COALESCE(
            'No contact in ' || days_since_interaction || ' day' || 
            CASE WHEN days_since_interaction != 1 THEN 's' ELSE '' END || 
            ' - account needs attention (' || COALESCE(account_record.revenue_segment, 'C') || ' segment, ' || 
            threshold_days || '+ day threshold)',
            'No interactions logged - account needs attention (' || COALESCE(account_record.revenue_segment, 'C') || ' segment)'
          ),
          'related_account_id', account_record.id,
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
      -- Check if notification is snoozed
      IF NOT EXISTS (
        SELECT 1 FROM notification_snoozes 
        WHERE notification_type = 'renewal_reminder' 
        AND related_account_id = account_record.id
        AND snoozed_until > now()
      ) THEN
        notification_obj := jsonb_build_object(
          'id', 'renewal_' || account_record.id || '_' || user_id_param,
          'type', 'renewal_reminder',
          'title', 'Renewal Coming Up: ' || COALESCE(account_record.name, 'Unknown'),
          'message', COALESCE(
            'Contract renewal is in ' || days_until_renewal || ' day' || 
            CASE WHEN days_until_renewal != 1 THEN 's' ELSE '' END || 
            ' (' || to_char(renewal_date, 'Mon DD, YYYY') || ')',
            'Account is at risk - renewal coming up'
          ),
          'related_account_id', account_record.id,
          'related_task_id', null,
          'is_read', false,
          'created_at', now()::text,
          'scheduled_for', COALESCE(renewal_date::text, now()::text)
        );
        updated_notifications := updated_notifications || notification_obj;
      END IF;
    END IF;
  END LOOP;
  
  -- Update user's notification state
  INSERT INTO user_notification_states (user_id, notifications, updated_at)
  VALUES (user_id_param, updated_notifications, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    notifications = EXCLUDED.notifications,
    updated_at = now();
  
  RETURN updated_notifications;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION refresh_user_notifications IS 
  'Refreshes notifications for a single user. Called on page load. Fast because it only processes active accounts.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_user_notifications(text) TO authenticated;

