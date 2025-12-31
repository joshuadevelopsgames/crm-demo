-- Migration script: Move bulk notifications from notifications table to user_notification_states
-- This migrates neglected_account and renewal_reminder notifications to JSONB format

-- Step 1: Create user_notification_states table if it doesn't exist
-- (Run create_user_notification_states_table.sql first)

-- Step 2: Migrate existing bulk notifications to JSONB format
DO $$
DECLARE
  user_record RECORD;
  notification_record RECORD;
  notification_array jsonb := '[]'::jsonb;
  notification_obj jsonb;
  notifications_table_exists boolean;
  user_states_table_exists boolean;
  migrated_count int := 0;
  deleted_count int := 0;
BEGIN
  -- Check if required tables exist
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) INTO notifications_table_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notification_states'
  ) INTO user_states_table_exists;
  
  IF NOT notifications_table_exists THEN
    RAISE NOTICE 'Notifications table does not exist. Skipping migration. Run create_notifications_table.sql first.';
    RETURN;
  END IF;
  
  IF NOT user_states_table_exists THEN
    RAISE NOTICE 'user_notification_states table does not exist. Skipping migration. Run create_user_notification_states_table.sql first.';
    RETURN;
  END IF;
  
  -- Loop through all users
  FOR user_record IN SELECT DISTINCT user_id FROM notifications LOOP
    notification_array := '[]'::jsonb;
    
    -- Collect all bulk notifications for this user
    FOR notification_record IN 
      SELECT * FROM notifications 
      WHERE user_id = user_record.user_id
      AND type IN ('neglected_account', 'renewal_reminder')
      ORDER BY created_at DESC
    LOOP
      -- Build notification object
      notification_obj := jsonb_build_object(
        'id', notification_record.id::text,
        'type', notification_record.type,
        'title', notification_record.title,
        'message', notification_record.message,
        'related_account_id', notification_record.related_account_id,
        'related_task_id', notification_record.related_task_id,
        'is_read', notification_record.is_read,
        'created_at', notification_record.created_at::text,
        'scheduled_for', notification_record.scheduled_for::text
      );
      
      -- Add to array
      notification_array := notification_array || notification_obj;
      migrated_count := migrated_count + 1;
    END LOOP;
    
    -- Insert or update user_notification_states
    INSERT INTO user_notification_states (user_id, notifications, created_at, updated_at)
    VALUES (user_record.user_id, notification_array, now(), now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      notifications = EXCLUDED.notifications,
      updated_at = now();
    
    RAISE NOTICE 'Migrated notifications for user: % (% notifications)', 
      user_record.user_id, jsonb_array_length(notification_array);
  END LOOP;
  
  -- Step 3: Delete migrated notifications from notifications table
  -- (Keep task notifications - they stay in notifications table)
  DELETE FROM notifications 
  WHERE type IN ('neglected_account', 'renewal_reminder');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Migrated % bulk notifications to JSONB format', migrated_count;
  RAISE NOTICE 'Deleted % bulk notifications from notifications table', deleted_count;
  RAISE NOTICE 'Users with notification states: %', (SELECT COUNT(*) FROM user_notification_states);
  RAISE NOTICE 'Remaining task notifications: %', 
    (SELECT COUNT(*) FROM notifications WHERE type NOT IN ('neglected_account', 'renewal_reminder'));
  RAISE NOTICE 'Migration complete!';
END $$;

