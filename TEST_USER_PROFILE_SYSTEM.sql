-- Test User Profile System
-- This script tests that the profile system is working correctly
-- Run this after setting up or after major changes
--
-- NOTE: This creates a TEST user - delete it after testing!

-- ============================================
-- STEP 1: Create a test user
-- ============================================
-- WARNING: This will create a real user in auth.users
-- Make sure to delete the test user after testing!
--
-- Uncomment the lines below to create a test user:
/*
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Create test user (this would normally be done via Supabase Auth API)
  -- For testing, you can create a user manually in Supabase Dashboard
  -- Then run the rest of this script to verify the profile was created
  
  RAISE NOTICE 'To test: Create a test user in Supabase Dashboard → Authentication → Users';
  RAISE NOTICE 'Then run the verification queries below';
END $$;
*/

-- ============================================
-- STEP 2: Verify trigger created profile automatically
-- ============================================
-- After creating a test user, run this to check if profile was created:

-- Replace 'test@example.com' with your test user email
SELECT 
  'Trigger Test' as test_name,
  au.email,
  au.created_at as user_created_at,
  p.id IS NOT NULL as profile_created,
  p.role as profile_role,
  CASE 
    WHEN p.id IS NOT NULL AND p.role IS NOT NULL 
    THEN '✅ PASS: Trigger created profile with role'
    WHEN p.id IS NOT NULL AND p.role IS NULL 
    THEN '⚠️ WARNING: Profile created but role is NULL'
    ELSE '❌ FAIL: Profile was NOT created by trigger'
  END as test_result
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'test@example.com'  -- Replace with test email
  AND au.created_at > NOW() - INTERVAL '1 hour';  -- Only check recent users

-- ============================================
-- STEP 3: Test RLS policies
-- ============================================
-- This tests if RLS policies allow reading profiles
-- Run this as an authenticated user (via Supabase Dashboard SQL Editor)

SELECT 
  'RLS Policy Test' as test_name,
  COUNT(*) as profiles_readable,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS: Can read profiles'
    ELSE '❌ FAIL: Cannot read profiles - RLS is blocking'
  END as test_result
FROM profiles;

-- ============================================
-- STEP 4: Test profile creation (fallback)
-- ============================================
-- This simulates what UserContext does when profile is missing
-- NOTE: This will fail if RLS blocks INSERT, which is expected behavior
-- The trigger should handle profile creation, not this fallback

-- Uncomment to test (replace with a test user ID):
/*
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,  -- Replace with test user ID
  'test@example.com',
  'Test User',
  'user'
)
ON CONFLICT (id) DO NOTHING
RETURNING *;
*/

-- ============================================
-- STEP 5: Cleanup test user
-- ============================================
-- After testing, delete the test user:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Find the test user
-- 3. Delete it (profile will be deleted automatically due to CASCADE)

-- Or delete via SQL (replace with test user ID):
/*
DELETE FROM auth.users WHERE email = 'test@example.com';
-- Profile will be deleted automatically due to CASCADE
*/

-- ============================================
-- STEP 6: Comprehensive System Test
-- ============================================
-- Run all checks from health check script
-- This gives you a complete picture

SELECT 
  'Comprehensive Test Results' as section,
  '' as detail;

-- Test 1: Trigger exists
SELECT 
  'Test 1: Trigger' as test,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Test 2: Trigger function exists
SELECT 
  'Test 2: Trigger Function' as test,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user')
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Test 3: RLS policies exist
SELECT 
  'Test 3: RLS Policies' as test,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT')
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Test 4: All users have profiles
SELECT 
  'Test 4: All Users Have Profiles' as test,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) || ' users missing profiles'
  END as result;

-- Test 5: All profiles have roles
SELECT 
  'Test 5: All Profiles Have Roles' as test,
  CASE 
    WHEN (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM profiles WHERE role IS NULL) || ' profiles missing roles'
  END as result;

-- Test 6: System admin configured
SELECT 
  'Test 6: System Admin' as test,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Overall test result
SELECT 
  'Overall Test Result' as test,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
     AND EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT')
     AND (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
     AND EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
    THEN '✅ ALL TESTS PASSED - System is working correctly!'
    ELSE '❌ SOME TESTS FAILED - Review results above and run fix scripts'
  END as result;

