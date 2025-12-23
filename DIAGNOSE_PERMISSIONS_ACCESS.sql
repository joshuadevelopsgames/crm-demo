-- Diagnose why jrsschroeder@gmail.com can't access Permissions page
-- Run this in Supabase SQL Editor to check the current state

-- Step 1: Check if user exists in auth.users
SELECT 
  'Step 1: Auth User Check' as step,
  id,
  email,
  created_at,
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN '✅ User exists in auth.users'
    ELSE '❌ User NOT found in auth.users'
  END as status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';

-- Step 2: Check if profile exists and what role it has
SELECT 
  'Step 2: Profile Check' as step,
  p.id,
  p.email,
  p.role,
  p.full_name,
  CASE 
    WHEN p.role = 'admin' THEN '✅ Profile exists with ADMIN role - Should have access'
    WHEN p.role = 'user' THEN '❌ Profile exists with USER role - This is the problem!'
    WHEN p.role IS NULL THEN '❌ Profile exists but role is NULL - This is the problem!'
    WHEN p.email = 'jrsschroeder@gmail.com' THEN '✅ Profile exists'
    ELSE '❌ Profile NOT found'
  END as status,
  CASE 
    WHEN p.role = 'admin' THEN 'No action needed - role is correct'
    WHEN p.role = 'user' OR p.role IS NULL THEN 'Run: UPDATE profiles SET role = ''admin'' WHERE email = ''jrsschroeder@gmail.com'';'
    ELSE 'Profile needs to be created'
  END as fix_required
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- Step 3: Check if role column exists
SELECT 
  'Step 3: Schema Check' as step,
  column_name,
  data_type,
  column_default,
  CASE 
    WHEN column_name = 'role' THEN '✅ Role column exists'
    ELSE 'Column found'
  END as status
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name = 'role';

-- Step 4: Summary and fix command
SELECT 
  'Step 4: Summary' as step,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'admin')
    THEN '✅ Everything is correct - User should have access'
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND (role = 'user' OR role IS NULL))
    THEN '❌ PROBLEM FOUND: Profile exists but role is not "admin". Run the fix below:'
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
    THEN '❌ PROBLEM FOUND: User exists but profile is missing. Run SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql'
    ELSE '❌ PROBLEM FOUND: User does not exist. Create user in Authentication > Users first'
  END as diagnosis,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND (role = 'user' OR role IS NULL))
    THEN 'UPDATE profiles SET role = ''admin'' WHERE email = ''jrsschroeder@gmail.com'';'
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com') 
         AND NOT EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    THEN 'Run: SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql'
    ELSE 'No fix needed'
  END as fix_command;

