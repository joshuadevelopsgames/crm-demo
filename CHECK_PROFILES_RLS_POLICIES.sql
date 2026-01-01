-- Check current RLS policies on profiles table
-- Run this in Supabase SQL Editor to see what policies are active

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Test if you can update your own profile (replace with your user ID)
-- Get your user ID first:
SELECT id, email FROM auth.users WHERE email = 'jrsschroeder@gmail.com';

-- Then test update (replace YOUR_USER_ID with the ID from above):
-- UPDATE profiles SET full_name = 'Test Update' WHERE id = 'YOUR_USER_ID' RETURNING *;

