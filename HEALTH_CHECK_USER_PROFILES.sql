-- Health Check: User Profiles System
-- Run this periodically (weekly/monthly) to ensure the system is working correctly
-- This detects issues BEFORE users report login problems
--
-- Usage: Run this in Supabase SQL Editor and check for any ❌ or ⚠️ warnings

-- ============================================
-- CHECK 1: Trigger exists and is active
-- ============================================
SELECT 
  'CHECK 1: Trigger Status' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ PASS: Trigger exists and is active'
    ELSE '❌ FAIL: Trigger is missing - New users will NOT get profiles!'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 2: Trigger function is up-to-date
-- ============================================
SELECT 
  'CHECK 2: Trigger Function' as check_name,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'handle_new_user' 
      AND routine_schema = 'public'
    )
    THEN '✅ PASS: Trigger function exists'
    ELSE '❌ FAIL: Trigger function is missing!'
  END as status,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'handle_new_user' 
      AND routine_schema = 'public'
    )
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 3: RLS policies are correct
-- ============================================
SELECT 
  'CHECK 3: RLS Policies' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT')
    THEN '✅ PASS: RLS policies are configured correctly'
    ELSE '❌ FAIL: RLS policies are missing or incorrect'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT')
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 4: All users have profiles
-- ============================================
SELECT 
  'CHECK 4: Users Without Profiles' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
    THEN '✅ PASS: All users have profiles'
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) <= 2
    THEN '⚠️ WARNING: ' || (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) || ' user(s) without profiles'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) || ' users without profiles'
  END as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to backfill profiles'
  END as action_required;

-- Show which users are missing profiles
SELECT 
  'CHECK 4 Details: Users Missing Profiles' as check_name,
  au.email,
  au.created_at as user_created_at,
  '❌ Missing profile' as status
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM profiles)
ORDER BY au.created_at DESC;

-- ============================================
-- CHECK 5: All profiles have roles
-- ============================================
SELECT 
  'CHECK 5: Profiles Without Roles' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
    THEN '✅ PASS: All profiles have roles'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM profiles WHERE role IS NULL) || ' profile(s) without roles'
  END as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
    THEN 'No action needed'
    ELSE 'Run: UPDATE profiles SET role = ''user'' WHERE role IS NULL;'
  END as action_required;

-- Show which profiles are missing roles
SELECT 
  'CHECK 5 Details: Profiles Missing Roles' as check_name,
  p.email,
  p.id,
  '❌ Role is NULL' as status
FROM profiles p
WHERE p.role IS NULL;

-- ============================================
-- CHECK 6: System Admin has correct role
-- ============================================
SELECT 
  'CHECK 6: System Admin Role' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
    THEN '✅ PASS: System admin has correct role'
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    THEN '⚠️ WARNING: System admin exists but role is: ' || (SELECT role FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    ELSE '❌ FAIL: System admin profile not found'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
    THEN 'No action needed'
    ELSE 'Run: FIX_SYSTEM_ADMIN_PROFILE.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 7: Role constraint includes all valid roles
-- ============================================
SELECT 
  'CHECK 7: Role Constraint' as check_name,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints 
      WHERE constraint_name LIKE '%role%check%'
      AND constraint_schema = 'public'
      AND check_clause LIKE '%system_admin%'
      AND check_clause LIKE '%admin%'
      AND check_clause LIKE '%user%'
    )
    THEN '✅ PASS: Role constraint includes all valid roles'
    ELSE '⚠️ WARNING: Role constraint may be missing or incomplete'
  END as status,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints 
      WHERE constraint_name LIKE '%role%check%'
      AND constraint_schema = 'public'
      AND check_clause LIKE '%system_admin%'
      AND check_clause LIKE '%admin%'
      AND check_clause LIKE '%user%'
    )
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 8: Recent users have profiles (last 7 days)
-- ============================================
SELECT 
  'CHECK 8: Recent User Profiles' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) = 0
    THEN '✅ PASS: All recent users have profiles'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) || ' recent user(s) missing profiles - Trigger may not be working!'
  END as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) = 0
    THEN 'No action needed'
    ELSE '⚠️ CRITICAL: Trigger is not working! Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql immediately'
  END as action_required;

-- Show recent users without profiles
SELECT 
  'CHECK 8 Details: Recent Users Missing Profiles' as check_name,
  au.email,
  au.created_at,
  EXTRACT(EPOCH FROM (NOW() - au.created_at))/86400 as days_ago,
  '❌ Missing profile - Trigger failed!' as status
FROM auth.users au
WHERE au.created_at > NOW() - INTERVAL '7 days'
  AND au.id NOT IN (SELECT id FROM profiles)
ORDER BY au.created_at DESC;

-- ============================================
-- SUMMARY: Overall Health Status
-- ============================================
SELECT 
  'SUMMARY: Overall System Health' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
     AND (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
     AND EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
     AND (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) = 0
    THEN '✅ HEALTHY: All systems operational'
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
     AND (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) <= 2
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
    THEN '⚠️ WARNING: Minor issues detected - Review checks above'
    ELSE '❌ CRITICAL: Major issues detected - Immediate action required!'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
     AND (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
     AND EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
     AND (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) = 0
    THEN 'System is healthy - No action needed'
    ELSE 'Review individual checks above and run appropriate fix script'
  END as action_required;

-- ============================================
-- STATISTICS: User Profile Statistics
-- ============================================
SELECT 
  'STATISTICS' as section,
  '' as detail;

SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) as users_without_profiles,
  (SELECT COUNT(*) FROM profiles WHERE role = 'system_admin') as system_admins,
  (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as admins,
  (SELECT COUNT(*) FROM profiles WHERE role = 'user') as regular_users,
  (SELECT COUNT(*) FROM profiles WHERE role IS NULL) as profiles_without_roles,
  (SELECT COUNT(*) FROM auth.users 
   WHERE created_at > NOW() - INTERVAL '7 days' 
   AND id NOT IN (SELECT id FROM profiles)) as recent_users_missing_profiles;

