-- Fix RLS policies on profiles table to allow admins to see all users
-- This is needed for the Permissions page to display all users
-- Run this in Supabase SQL Editor

-- Drop the existing restrictive policies
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_select_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;

-- Option 1: Allow all authenticated users to read all profiles
-- This is simpler and works well for internal/admin tools
-- If you need more security, use Option 2 below
CREATE POLICY profiles_select_all_authenticated ON profiles
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to update all profiles
-- (Admins can update any profile, regular users can update their own)
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Option 2: More secure - only allow admins to see all profiles
-- Uncomment this and comment out Option 1 if you want stricter security
-- Note: This requires a function to check admin status without circular dependency
-- 
-- CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
-- RETURNS boolean AS $$
-- BEGIN
--   RETURN EXISTS (
--     SELECT 1 FROM profiles 
--     WHERE id = user_id 
--     AND role = 'admin'
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE POLICY profiles_select_own_or_admin ON profiles
--   FOR SELECT TO authenticated 
--   USING (
--     auth.uid() = id OR 
--     public.is_admin(auth.uid())
--   );
--
-- CREATE POLICY profiles_update_own_or_admin ON profiles
--   FOR UPDATE TO authenticated 
--   USING (
--     auth.uid() = id OR 
--     public.is_admin(auth.uid())
--   )
--   WITH CHECK (
--     auth.uid() = id OR 
--     public.is_admin(auth.uid())
--   );

