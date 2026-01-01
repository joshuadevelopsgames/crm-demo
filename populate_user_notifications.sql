-- Populate user_notification_states for all users
-- Run this after setting up the notification system to populate initial notifications

-- For each user, refresh their notifications
DO $$
DECLARE
  user_record RECORD;
  refreshed_count int := 0;
BEGIN
  RAISE NOTICE 'Starting notification population for all users...';
  
  -- Check if refresh function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'refresh_user_notifications'
  ) THEN
    RAISE NOTICE 'refresh_user_notifications function does not exist. Run optimize_user_notifications_on_load.sql first.';
    RETURN;
  END IF;
  
  -- Refresh notifications for each user
  FOR user_record IN SELECT id::text as user_id FROM auth.users LOOP
    BEGIN
      PERFORM refresh_user_notifications(user_record.user_id);
      refreshed_count := refreshed_count + 1;
      
      -- Log progress every 10 users
      IF refreshed_count % 10 = 0 THEN
        RAISE NOTICE 'Refreshed notifications for % users...', refreshed_count;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error refreshing notifications for user %: %', user_record.user_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Notification population complete. Refreshed % users.', refreshed_count;
END;
$$;

-- Verify results
SELECT 
  user_id,
  jsonb_array_length(notifications) as notification_count,
  updated_at
FROM user_notification_states
ORDER BY notification_count DESC
LIMIT 10;

