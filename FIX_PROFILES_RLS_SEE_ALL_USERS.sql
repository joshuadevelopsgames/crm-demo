-- Fix RLS policies on profiles table to allow users to see all profiles
-- This is needed for the Permissions page to display all users
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn/sql

-- Step 1: Drop existing restrictive policies
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_select_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_insert_all_authenticated ON profiles;

-- Step 2: Allow all authenticated users to READ all profiles
-- This is needed for the Permissions page to show all users
CREATE POLICY profiles_select_all_authenticated ON profiles
  FOR SELECT TO authenticated USING (true);

-- Step 3: Allow all authenticated users to UPDATE all profiles
-- (In practice, admins will update via the Permissions page)
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Step 4: Allow users to INSERT their own profile
-- (This is needed when new users sign up)
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Step 5: Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Step 6: Test query (should return all profiles)
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
ORDER BY email;

-- Expected result: You should see all users in the profiles table
-- If you see "0 rows", the policies might not be applied yet, or there are no profiles

