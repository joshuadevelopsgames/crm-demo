-- Cleanup script to remove duplicate notifications
-- Run this BEFORE migration to clean up existing duplicates

DO $$
DECLARE
  bulk_deleted_count int := 0;
  task_deleted_count int := 0;
BEGIN
  -- Check if notifications table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) THEN
    
    -- Step 1: Remove duplicate bulk notifications (neglected_account, renewal_reminder)
    -- Keep the most recent notification for each user_id + type + related_account_id combination
    DELETE FROM notifications n1
    WHERE n1.id IN (
      SELECT n2.id
      FROM notifications n2
      WHERE EXISTS (
        SELECT 1
        FROM notifications n3
        WHERE n3.user_id = n2.user_id
          AND n3.type = n2.type
          AND n3.related_account_id = n2.related_account_id
          AND n3.id != n2.id
          AND n3.created_at > n2.created_at
      )
      AND n2.type IN ('neglected_account', 'renewal_reminder')
    );
    GET DIAGNOSTICS bulk_deleted_count = ROW_COUNT;
    
    -- Step 2: Remove duplicate task notifications
    -- Keep the most recent notification for each user_id + type + related_task_id combination
    DELETE FROM notifications n1
    WHERE n1.id IN (
      SELECT n2.id
      FROM notifications n2
      WHERE EXISTS (
        SELECT 1
        FROM notifications n3
        WHERE n3.user_id = n2.user_id
          AND n3.type = n2.type
          AND n3.related_task_id = n2.related_task_id
          AND n3.id != n2.id
          AND n3.created_at > n2.created_at
      )
      AND n2.type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder')
    );
    GET DIAGNOSTICS task_deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleanup complete: Deleted % bulk notification duplicates and % task notification duplicates', 
      bulk_deleted_count, task_deleted_count;
    
    -- Step 3: Show summary
    RAISE NOTICE 'Remaining notifications:';
    RAISE NOTICE '  - Bulk notifications (neglected_account, renewal_reminder): %', 
      (SELECT COUNT(*) FROM notifications WHERE type IN ('neglected_account', 'renewal_reminder'));
    RAISE NOTICE '  - Task notifications: %', 
      (SELECT COUNT(*) FROM notifications WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder'));
    RAISE NOTICE '  - Unique users with notifications: %', 
      (SELECT COUNT(DISTINCT user_id) FROM notifications);
      
  ELSE
    RAISE NOTICE 'Notifications table does not exist yet. Skipping cleanup. Run create_notifications_table.sql first.';
  END IF;
END $$;

-- Show summary as a query result (only if table exists)
DO $$
DECLARE
  table_exists boolean;
  bulk_count int;
  task_count int;
  user_count int;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO bulk_count
    FROM notifications 
    WHERE type IN ('neglected_account', 'renewal_reminder');
    
    SELECT COUNT(*) INTO task_count
    FROM notifications 
    WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder');
    
    SELECT COUNT(DISTINCT user_id) INTO user_count
    FROM notifications;
    
    RAISE NOTICE '=== Cleanup Summary ===';
    RAISE NOTICE 'Remaining bulk notifications: %', bulk_count;
    RAISE NOTICE 'Remaining task notifications: %', task_count;
    RAISE NOTICE 'Unique users with notifications: %', user_count;
  ELSE
    RAISE NOTICE '=== Cleanup Summary ===';
    RAISE NOTICE 'Notifications table does not exist. No summary available.';
  END IF;
END $$;

