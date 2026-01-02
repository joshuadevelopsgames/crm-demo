-- Add notification_preferences JSONB column to profiles table
-- This stores user preferences for different notification types

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "email_notifications": true,
  "task_reminders": true,
  "system_announcements": true
}'::jsonb;

-- Create GIN index for faster queries on notification_preferences
CREATE INDEX IF NOT EXISTS idx_profiles_notification_preferences_gin 
  ON profiles USING GIN (notification_preferences);

-- Add comment
COMMENT ON COLUMN profiles.notification_preferences IS 'User preferences for notifications stored as JSONB: email_notifications, task_reminders, system_announcements';



