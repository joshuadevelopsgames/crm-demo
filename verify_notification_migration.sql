-- Verification script to check that the notification system migration was successful
-- Run this to verify everything is set up correctly

DO $$
DECLARE
  user_states_count int;
  bulk_notifications_count int;
  task_notifications_count int;
  unique_index_exists boolean;
  trigger_exists boolean;
BEGIN
  RAISE NOTICE '=== Notification System Migration Verification ===';
  RAISE NOTICE '';
  
  -- Check 1: user_notification_states table
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notification_states'
  ) THEN
    SELECT COUNT(*) INTO user_states_count FROM user_notification_states;
    RAISE NOTICE '✅ user_notification_states table exists';
    RAISE NOTICE '   - Users with notification states: %', user_states_count;
    
    -- Show sample notification counts per user
    RAISE NOTICE '   - Sample user notification counts:';
    FOR rec IN 
      SELECT user_id, jsonb_array_length(notifications) as count 
      FROM user_notification_states 
      ORDER BY jsonb_array_length(notifications) DESC 
      LIMIT 5
    LOOP
      RAISE NOTICE '     * User %: % notifications', rec.user_id, rec.count;
    END LOOP;
  ELSE
    RAISE NOTICE '❌ user_notification_states table does NOT exist';
  END IF;
  
  RAISE NOTICE '';
  
  -- Check 2: notifications table (should only have task notifications)
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) THEN
    SELECT COUNT(*) INTO bulk_notifications_count 
    FROM notifications 
    WHERE type IN ('neglected_account', 'renewal_reminder');
    
    SELECT COUNT(*) INTO task_notifications_count 
    FROM notifications 
    WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder');
    
    RAISE NOTICE '✅ notifications table exists';
    RAISE NOTICE '   - Bulk notifications remaining (should be 0): %', bulk_notifications_count;
    RAISE NOTICE '   - Task notifications: %', task_notifications_count;
    
    IF bulk_notifications_count > 0 THEN
      RAISE NOTICE '   ⚠️  WARNING: % bulk notifications still in notifications table', bulk_notifications_count;
      RAISE NOTICE '      These should have been migrated to user_notification_states';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  notifications table does NOT exist (this is okay if you only use JSONB)';
  END IF;
  
  RAISE NOTICE '';
  
  -- Check 3: Unique index for task notifications
  SELECT EXISTS (
    SELECT FROM pg_indexes 
    WHERE indexname = 'unique_user_task_notification'
  ) INTO unique_index_exists;
  
  IF unique_index_exists THEN
    RAISE NOTICE '✅ Unique index for task notifications exists';
  ELSE
    RAISE NOTICE '❌ Unique index for task notifications does NOT exist';
  END IF;
  
  RAISE NOTICE '';
  
  -- Check 4: Triggers
  SELECT EXISTS (
    SELECT FROM pg_trigger 
    WHERE tgname = 'trg_accounts_update_notifications'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ Account update trigger exists';
  ELSE
    RAISE NOTICE '❌ Account update trigger does NOT exist';
  END IF;
  
  SELECT EXISTS (
    SELECT FROM pg_trigger 
    WHERE tgname = 'trg_interactions_update_notifications'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ Interaction update trigger exists';
  ELSE
    RAISE NOTICE '⚠️  Interaction update trigger does NOT exist (okay if interactions table doesn''t exist)';
  END IF;
  
  RAISE NOTICE '';
  
  -- Check 5: Functions
  IF EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'update_notification_state_for_account'
  ) THEN
    RAISE NOTICE '✅ update_notification_state_for_account function exists';
  ELSE
    RAISE NOTICE '❌ update_notification_state_for_account function does NOT exist';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Verification Complete ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Deploy code changes to Vercel';
  RAISE NOTICE '2. Test notification creation/updates';
  RAISE NOTICE '3. Check browser console for duplicate warnings (should be gone)';
  RAISE NOTICE '4. Verify notifications appear when accounts/interactions change';
  
END $$;

