-- Quick Fix: Profile Settings Not Saving
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Add notification_preferences column if missing
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "email_notifications": true,
  "task_reminders": true,
  "system_announcements": true
}'::jsonb;

-- Step 2: Fix RLS policies to allow updates
-- Drop existing restrictive policies
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;

-- Create policy to allow all authenticated users to update profiles
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Step 3: Verify the fix
SELECT 
  '✅ notification_preferences column' as check_1,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'notification_preferences'
  ) as column_exists;

SELECT 
  '✅ UPDATE policy exists' as check_2,
  EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND cmd = 'UPDATE'
  ) as policy_exists;

-- Step 4: Show current policies
SELECT 
  policyname,
  cmd,
  'Policy active' as status
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

