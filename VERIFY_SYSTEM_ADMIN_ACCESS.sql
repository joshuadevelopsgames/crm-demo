-- Verify System Admin access for jrsschroeder@gmail.com
-- Run this to check if the user can access the Permissions page

-- Step 1: Check if user exists in auth.users
SELECT 
  'auth.users' as table_name,
  id,
  email,
  created_at,
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN '✅ User exists'
    ELSE '⚠️  User not found'
  END as status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';

-- Step 2: Check if profile exists and has admin role
SELECT 
  'profiles' as table_name,
  p.id,
  p.email,
  p.role,
  p.full_name,
  CASE 
    WHEN p.role = 'admin' THEN '✅ System Admin - Can access Permissions page'
    WHEN p.role = 'user' THEN '⚠️  Regular User - Cannot access Permissions page'
    WHEN p.role IS NULL THEN '⚠️  No role set - Defaults to user'
    ELSE '⚠️  Unknown role'
  END as access_status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- Step 3: If profile doesn't exist, show instructions
DO $$
DECLARE
  profile_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com') INTO profile_exists;
  
  IF NOT profile_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  PROFILE NOT FOUND';
    RAISE NOTICE 'The profile for jrsschroeder@gmail.com does not exist.';
    RAISE NOTICE '';
    RAISE NOTICE 'To fix this:';
    RAISE NOTICE '1. Make sure the user exists in Authentication > Users';
    RAISE NOTICE '2. Run UPDATE_SYSTEM_ADMIN.sql or SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql';
    RAISE NOTICE '';
  END IF;
END $$;

-- Step 4: Summary
SELECT 
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'admin')
    THEN '✅ System Admin access is correctly configured'
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'user')
    THEN '⚠️  User exists but role is "user" - Run UPDATE_SYSTEM_ADMIN.sql to set role to "admin"'
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
    THEN '⚠️  User exists in auth.users but profile is missing - Run SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql'
    ELSE '⚠️  User does not exist - Create user in Authentication > Users first'
  END as summary;

