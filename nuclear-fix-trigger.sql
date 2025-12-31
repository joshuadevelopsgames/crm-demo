-- Nuclear option: Completely remove and recreate everything
-- This will force PostgreSQL to recompile everything from scratch

-- Step 1: Drop ALL triggers on accounts table
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN 
    SELECT trigger_name 
    FROM information_schema.triggers 
    WHERE event_object_table = 'accounts'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trigger_rec.trigger_name) || ' ON accounts CASCADE';
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
  END LOOP;
END $$;

-- Step 2: Drop ALL functions that might reference accounts triggers
DO $$
DECLARE
  func_oid oid;
  func_name text;
BEGIN
  FOR func_oid IN 
    SELECT oid FROM pg_proc 
    WHERE proname IN (
      'trigger_update_notifications_on_account_change',
      'update_notification_state_for_account'
    )
  LOOP
    SELECT proname INTO func_name FROM pg_proc WHERE oid = func_oid;
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_oid::regprocedure || ' CASCADE';
    RAISE NOTICE 'Dropped function: %', func_oid::regprocedure;
  END LOOP;
END $$;

-- Step 3: Verify everything is gone
SELECT 
  'Remaining triggers' as check_type,
  COUNT(*) as count
FROM information_schema.triggers
WHERE event_object_table = 'accounts'
UNION ALL
SELECT 
  'Remaining functions' as check_type,
  COUNT(*) as count
FROM pg_proc
WHERE proname IN (
  'trigger_update_notifications_on_account_change',
  'update_notification_state_for_account'
);

-- Step 4: Recreate update_notification_state_for_account function (without snoozed_until)
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
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notification_states'
  ) THEN
    RETURN;
  END IF;
  
  SELECT * INTO account_record FROM accounts WHERE id = account_id_param;
  IF NOT FOUND THEN RETURN; END IF;
  
  IF account_record.archived = true OR account_record.icp_status = 'na' THEN
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
  
  should_have_renewal_notif := account_record.status = 'at_risk';
  
  FOR user_record IN SELECT id FROM auth.users LOOP
    SELECT notifications INTO current_notifications
    FROM user_notification_states
    WHERE user_id = user_record.id::text;
    
    IF current_notifications IS NULL THEN
      current_notifications := '[]'::jsonb;
    END IF;
    
    updated_notifications := (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(current_notifications) elem
      WHERE elem->>'related_account_id' != account_id_param
    );
    
    IF updated_notifications IS NULL THEN
      updated_notifications := '[]'::jsonb;
    END IF;
    
    IF should_have_neglected_notif THEN
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
    
    IF should_have_renewal_notif THEN
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
    
    INSERT INTO user_notification_states (user_id, notifications, updated_at)
    VALUES (user_record.id::text, updated_notifications, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      notifications = EXCLUDED.notifications,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Recreate trigger function WITHOUT snoozed_until
CREATE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Step 6: DO NOT recreate the trigger yet - leave it disabled
-- This allows account updates to work while we verify everything is fixed

-- Step 7: Verify functions were created correctly
SELECT 
  'Function created' as status,
  proname,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%snoozed_until%' THEN 'WARNING: Still references snoozed_until!'
    ELSE 'OK: No snoozed_until reference'
  END as check_result
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

