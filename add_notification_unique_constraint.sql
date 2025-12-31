-- Add unique constraint to notifications table to prevent duplicate task notifications
-- This prevents duplicates for: task_assigned, task_overdue, task_due_today, task_reminder

-- First, check if table exists and remove any existing duplicates
-- Keep the most recent notification for each user_id + type + related_task_id combination
DO $$
BEGIN
  -- Check if notifications table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) THEN
    -- Remove duplicates
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
    
    RAISE NOTICE 'Cleaned up duplicate task notifications';
  ELSE
    RAISE NOTICE 'Notifications table does not exist yet. Skipping cleanup. Run create_notifications_table.sql first.';
  END IF;
END $$;

-- Add partial unique index for task notifications
-- This ensures one notification per user per task per type
-- Note: PostgreSQL doesn't support WHERE in UNIQUE constraints, so we use a partial unique index instead
DO $$
BEGIN
  -- Check if notifications table exists before creating index
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) THEN
    -- Drop index if it exists (to allow re-running the script)
    DROP INDEX IF EXISTS unique_user_task_notification;
    
    -- Create the partial unique index
    CREATE UNIQUE INDEX unique_user_task_notification 
    ON notifications (user_id, type, related_task_id)
    WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder')
      AND related_task_id IS NOT NULL;
    
    -- Add comment
    COMMENT ON INDEX unique_user_task_notification IS 
      'Prevents duplicate task notifications. Bulk notifications (neglected_account, renewal_reminder) are stored in user_notification_states table.';
    
    RAISE NOTICE 'Created unique index for task notifications';
  ELSE
    RAISE NOTICE 'Notifications table does not exist yet. Skipping index creation. Run create_notifications_table.sql first.';
  END IF;
END $$;

