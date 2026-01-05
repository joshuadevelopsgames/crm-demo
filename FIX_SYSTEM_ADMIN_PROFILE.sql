-- Fix System Admin Profile Issue
-- Run this in Supabase SQL Editor
-- This fixes the issue where jrsschroeder@gmail.com shows isAdmin: false, hasProfile: false

-- ============================================
-- PART 1: Check current state
-- ============================================
SELECT 
  'PART 1: Current State Check' as section,
  '' as detail;

-- Check if user exists in auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN '✅ System Admin user found'
    ELSE '⚠️ User found but email mismatch'
  END as status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';

-- Check if profile exists
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'system_admin' THEN '✅ Profile exists with correct role'
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role IS NULL THEN '⚠️ Profile exists but role is NULL'
    WHEN p.email = 'jrsschroeder@gmail.com' THEN '⚠️ Profile exists but role is: ' || COALESCE(p.role, 'NULL')
    ELSE '❌ Profile not found'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- ============================================
-- PART 2: Ensure role column exists and allows system_admin
-- ============================================
SELECT 
  'PART 2: Ensuring role column exists' as section,
  '' as detail;

-- Add role column if it doesn't exist, and update check constraint to include system_admin
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Drop the old constraint if it exists and doesn't include system_admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' 
    AND constraint_name LIKE '%role%check%'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  END IF;
END $$;

-- Add new constraint that includes system_admin
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'user', 'system_admin'));

-- ============================================
-- PART 3: Update trigger function to ensure future users get profiles
-- ============================================
SELECT 
  'PART 3: Updating trigger for future users' as section,
  '' as detail;

-- Update the trigger function to include role field and system_admin logic
-- This ensures ALL future users get profiles automatically with the correct role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    -- Set system_admin role for system admin email, otherwise default to 'user'
    CASE 
      WHEN NEW.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE COALESCE(profiles.role, 'user')
    END,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists and is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 4: Fix RLS policies to allow profile access
-- ============================================
SELECT 
  'PART 4: Fixing RLS policies' as section,
  '' as detail;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_select_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_insert_all_authenticated ON profiles;

-- Allow all authenticated users to READ all profiles (needed for UserContext)
CREATE POLICY profiles_select_all_authenticated ON profiles
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to UPDATE all profiles
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow users to INSERT their own profile
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================
-- PART 5: Create or update the System Admin profile
-- ============================================
SELECT 
  'PART 4: Creating/updating System Admin profile' as section,
  '' as detail;

-- Insert or update the profile for system admin
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
  'system_admin'
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = 'system_admin',
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name, 'System Admin');

-- ============================================
-- PART 6: Verify the fix
-- ============================================
SELECT 
  'PART 5: Verification' as section,
  '' as detail;

SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  au.email_confirmed_at,
  CASE 
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'system_admin' AND au.email_confirmed_at IS NOT NULL 
    THEN '✅ System Admin profile is correctly configured - User should be able to login and see admin features'
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'system_admin' 
    THEN '✅ Profile exists with system_admin role - If login still fails, check email confirmation'
    WHEN p.email = 'jrsschroeder@gmail.com' 
    THEN '⚠️ Profile exists but role is: ' || COALESCE(p.role, 'NULL') || ' - Expected: system_admin'
    ELSE '❌ Profile not found'
  END as status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.email = 'jrsschroeder@gmail.com';

-- ============================================
-- PART 7: Check RLS policies are correct
-- ============================================
SELECT 
  'PART 6: RLS Policy Verification' as section,
  '' as detail;

SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' AND qual = 'true' THEN '✅ Allows reading all profiles'
    WHEN cmd = 'UPDATE' AND qual = 'true' THEN '✅ Allows updating all profiles'
    WHEN cmd = 'INSERT' THEN '✅ Allows inserting own profile'
    ELSE '⚠️ Check policy details'
  END as status
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- PART 8: Summary and Next Steps
-- ============================================
SELECT 
  'PART 7: Summary' as section,
  '' as detail;

SELECT 
  CASE 
    WHEN NOT EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
    THEN '❌ User does not exist in auth.users - Create user in Supabase Dashboard first'
    WHEN NOT EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    THEN '❌ Profile does not exist - Run this script again or check for errors above'
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role != 'system_admin')
    THEN '⚠️ Profile exists but role is incorrect - Check PART 4 results above'
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
    THEN '✅ Profile is correctly configured! Refresh the app and the admin status should work. ✅ Trigger is updated - Future users will get profiles automatically.'
    ELSE '⚠️ Unknown state - Check all parts above for details'
  END as next_steps;

-- ============================================
-- PART 9: Verify trigger is set up for future users
-- ============================================
SELECT 
  'PART 9: Future User Protection' as section,
  '' as detail;

SELECT 
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ Trigger is active - All future users will automatically get profiles with correct roles'
    ELSE '❌ WARNING: Trigger is missing - Future users will NOT get profiles automatically!'
  END as future_user_protection;

