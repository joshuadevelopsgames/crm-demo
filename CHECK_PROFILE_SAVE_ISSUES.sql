-- Diagnostic script to check why profile settings aren't saving
-- Run this in Supabase SQL Editor to identify the issue

-- Step 1: Check if notification_preferences column exists
SELECT 
  'Step 1: Check notification_preferences column' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      AND column_name = 'notification_preferences'
    ) THEN '✅ Column exists'
    ELSE '❌ Column MISSING - Run add_notification_preferences_to_profiles.sql'
  END as status;

-- Step 2: Check RLS policies for UPDATE
SELECT 
  'Step 2: Check UPDATE policies' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'profiles' 
      AND cmd = 'UPDATE'
    ) THEN '✅ UPDATE policy exists'
    ELSE '❌ No UPDATE policy - Run FIX_PROFILES_RLS_SEE_ALL_USERS.sql'
  END as status;

-- Step 3: List all policies on profiles table
SELECT 
  'Step 3: Current policies' as check_name,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NULL THEN 'No USING clause'
    ELSE 'Has USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NULL THEN 'No WITH CHECK clause'
    ELSE 'Has WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Step 4: Check if RLS is enabled
SELECT 
  'Step 4: RLS status' as check_name,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS enabled'
    ELSE '❌ RLS disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Step 5: Check column types
SELECT 
  'Step 5: Column types' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('id', 'full_name', 'phone_number', 'notification_preferences')
ORDER BY column_name;

-- Step 6: Test update (replace YOUR_USER_ID with your actual user ID)
-- First, get your user ID:
SELECT 
  'Step 6: Get your user ID' as check_name,
  id as user_id,
  email
FROM auth.users 
WHERE email = 'jrsschroeder@gmail.com';

-- Then manually test an update (uncomment and replace YOUR_USER_ID):
/*
UPDATE profiles 
SET 
  full_name = 'Test Update',
  phone_number = '123-456-7890',
  notification_preferences = '{"email_notifications": true, "task_reminders": true, "system_announcements": true}'::jsonb,
  updated_at = now()
WHERE id = 'YOUR_USER_ID'
RETURNING id, full_name, phone_number, notification_preferences;
*/

