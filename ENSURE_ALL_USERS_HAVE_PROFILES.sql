-- Ensure All Users Have Profiles (Current and Future)
-- This script ensures the trigger is properly configured and all existing users have profiles
-- Run this in Supabase SQL Editor to prevent future login issues
--
-- This addresses:
-- 1. Users created before the trigger existed
-- 2. Trigger not including the role field
-- 3. RLS policies blocking profile access
-- 4. Future users getting profiles automatically

-- ============================================
-- PART 1: Ensure role column exists and allows all roles
-- ============================================
SELECT 
  'PART 1: Ensuring role column exists' as section,
  '' as detail;

-- Add role column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Drop old constraint if it doesn't include all roles
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

-- Add constraint that includes all three roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'user', 'system_admin'));

-- ============================================
-- PART 2: Fix RLS policies to allow proper access
-- ============================================
SELECT 
  'PART 2: Fixing RLS policies' as section,
  '' as detail;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_select_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_insert_all_authenticated ON profiles;

-- Allow all authenticated users to READ all profiles
-- This is needed for UserContext to fetch profiles and for Permissions page
CREATE POLICY profiles_select_all_authenticated ON profiles
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to UPDATE all profiles
-- (Admins can update any profile, regular users can update their own)
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow users to INSERT their own profile
-- This is needed when UserContext tries to create a profile as fallback
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================
-- PART 3: Update trigger function to include role and system_admin logic
-- ============================================
SELECT 
  'PART 3: Updating trigger function' as section,
  '' as detail;

-- Update the trigger function to include role field and system_admin logic
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

-- ============================================
-- PART 4: Ensure trigger exists and is active
-- ============================================
SELECT 
  'PART 4: Ensuring trigger exists' as section,
  '' as detail;

-- Drop and recreate trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 5: Backfill profiles for existing users without profiles
-- ============================================
SELECT 
  'PART 5: Backfilling profiles for existing users' as section,
  '' as detail;

-- Create profiles for any users that don't have them yet
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN 'system_admin'
    ELSE 'user'
  END
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = CASE 
    WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
    ELSE COALESCE(profiles.role, 'user')
  END,
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);

-- ============================================
-- PART 6: Ensure all existing profiles have a role
-- ============================================
SELECT 
  'PART 6: Ensuring all profiles have roles' as section,
  '' as detail;

-- Update any profiles with NULL role
UPDATE profiles 
SET role = CASE 
  WHEN email = 'jrsschroeder@gmail.com' THEN 'system_admin'
  ELSE 'user'
END
WHERE role IS NULL;

-- ============================================
-- PART 7: Verify the setup
-- ============================================
SELECT 
  'PART 7: Verification' as section,
  '' as detail;

-- Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  CASE 
    WHEN trigger_name = 'on_auth_user_created' THEN '✅ Trigger is active'
    ELSE '⚠️ Trigger not found'
  END as status
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check RLS policies
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

-- Check for users without profiles
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All users have profiles'
    ELSE '⚠️ ' || COUNT(*) || ' user(s) without profiles - Check PART 5 results'
  END as users_without_profiles
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- Check for profiles without roles
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All profiles have roles'
    ELSE '⚠️ ' || COUNT(*) || ' profile(s) without roles - Check PART 6 results'
  END as profiles_without_roles
FROM profiles
WHERE role IS NULL;

-- Summary of all users and their profiles
SELECT 
  'PART 8: User Profile Summary' as section,
  '' as detail;

SELECT 
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  p.id IS NOT NULL as has_profile,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN '❌ No profile - User will have login issues'
    WHEN p.role IS NULL THEN '⚠️ Profile exists but no role - User may have permission issues'
    WHEN au.email_confirmed_at IS NULL THEN '⚠️ Email not confirmed - User may not be able to login'
    WHEN p.role = 'system_admin' AND au.email = 'jrsschroeder@gmail.com' THEN '✅ System Admin - Correctly configured'
    WHEN p.role IN ('admin', 'system_admin') THEN '✅ Admin - Correctly configured'
    WHEN p.role = 'user' THEN '✅ User - Correctly configured'
    ELSE '⚠️ Unknown role: ' || p.role
  END as status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY 
  CASE 
    WHEN au.email = 'jrsschroeder@gmail.com' THEN 1
    WHEN p.role = 'admin' THEN 2
    WHEN p.role = 'system_admin' THEN 2
    ELSE 3
  END,
  au.email;

-- ============================================
-- PART 9: Test trigger function (dry run check)
-- ============================================
SELECT 
  'PART 9: Trigger Function Check' as section,
  '' as detail;

-- Check if trigger function exists and has correct signature
SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name = 'handle_new_user' THEN '✅ Trigger function exists'
    ELSE '❌ Trigger function not found'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'handle_new_user';

-- ============================================
-- PART 10: Final Summary
-- ============================================
SELECT 
  'PART 10: Final Summary' as section,
  '' as detail;

SELECT 
  'Setup Complete!' as message,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ Trigger is active - New users will get profiles automatically'
    ELSE '❌ Trigger is missing - New users will NOT get profiles automatically'
  END as trigger_status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT' AND qual = 'true')
    THEN '✅ RLS policies allow profile access'
    ELSE '❌ RLS policies may block profile access'
  END as rls_status,
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) as users_without_profiles,
  (SELECT COUNT(*) FROM profiles WHERE role IS NULL) as profiles_without_roles,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
     AND EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ All systems operational - Future users will get profiles automatically'
    ELSE '⚠️ Some issues detected - Review parts above'
  END as overall_status;

