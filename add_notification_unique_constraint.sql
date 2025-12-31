-- Add unique constraint to notifications table to prevent duplicate task notifications
-- This prevents duplicates for: task_assigned, task_overdue, task_due_today, task_reminder

-- First, remove any existing duplicates before adding constraint
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

-- Add unique constraint for task notifications
-- This ensures one notification per user per task per type
ALTER TABLE notifications 
ADD CONSTRAINT unique_user_task_notification 
UNIQUE (user_id, type, related_task_id)
WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder');

-- Add comment
COMMENT ON CONSTRAINT unique_user_task_notification ON notifications IS 
  'Prevents duplicate task notifications. Bulk notifications (neglected_account, renewal_reminder) are stored in user_notification_states table.';

