-- Comprehensive Supabase Setup Check for System Admin
-- Run this in Supabase SQL Editor to verify everything is configured correctly

-- ============================================
-- PART 1: Check auth.users table
-- ============================================
SELECT 
  'PART 1: Authentication Users' as section,
  '' as detail;

SELECT 
  id,
  email,
  created_at,
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN '✅ System Admin user found'
    ELSE '⚠️  User found but email mismatch'
  END as status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';

-- If no rows above, the user doesn't exist in auth.users
SELECT 
  CASE 
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
    THEN '✅ User exists in auth.users'
    ELSE '❌ User NOT found in auth.users - Create user in Authentication > Users first'
  END as auth_users_check;

-- ============================================
-- PART 2: Check profiles table structure
-- ============================================
SELECT 
  'PART 2: Profiles Table Structure' as section,
  '' as detail;

-- Check if role column exists
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable,
  CASE 
    WHEN column_name = 'role' THEN '✅ Role column exists'
    ELSE 'Column info'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'role';

SELECT 
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'role'
    )
    THEN '✅ Role column exists in profiles table'
    ELSE '❌ Role column MISSING - Run: ALTER TABLE profiles ADD COLUMN role text DEFAULT ''user'' CHECK (role IN (''admin'', ''user''));'
  END as role_column_check;

-- ============================================
-- PART 3: Check profiles table data
-- ============================================
SELECT 
  'PART 3: Profiles Table Data' as section,
  '' as detail;

SELECT 
  p.id,
  p.email,
  p.role,
  p.full_name,
  CASE 
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'admin' THEN '✅ System Admin profile correctly configured'
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'user' THEN '⚠️  System Admin profile exists but role is "user" - Needs update'
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role IS NULL THEN '⚠️  System Admin profile exists but role is NULL - Needs update'
    WHEN p.email = 'jrsschroeder@gmail.com' THEN '⚠️  System Admin profile exists but role is: ' || COALESCE(p.role::text, 'NULL')
    ELSE 'Profile found'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- Check if profile exists
SELECT 
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'admin')
    THEN '✅ System Admin profile exists with admin role'
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    THEN '⚠️  System Admin profile exists but role is NOT "admin" - Run UPDATE_SYSTEM_ADMIN.sql'
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
    THEN '⚠️  User exists in auth.users but profile is MISSING - Run SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql'
    ELSE '❌ Profile NOT found - User may not exist in auth.users either'
  END as profile_check;

-- ============================================
-- PART 4: Check foreign key relationship
-- ============================================
SELECT 
  'PART 4: Foreign Key Relationship' as section,
  '' as detail;

SELECT 
  au.id as auth_user_id,
  p.id as profile_id,
  au.email,
  CASE 
    WHEN au.id = p.id THEN '✅ IDs match - Foreign key relationship correct'
    WHEN p.id IS NULL THEN '⚠️  Profile missing for this user'
    ELSE '⚠️  IDs do not match'
  END as relationship_status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'jrsschroeder@gmail.com';

-- ============================================
-- PART 5: Summary and Recommendations
-- ============================================
SELECT 
  'PART 5: Summary & Recommendations' as section,
  '' as detail;

SELECT 
  CASE 
    -- Perfect setup
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
     AND EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'admin')
     AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role')
    THEN '✅✅✅ EVERYTHING IS CORRECTLY CONFIGURED ✅✅✅'
    
    -- User exists, profile exists, but role is wrong
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
     AND EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com')
     AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role')
     AND NOT EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'admin')
    THEN '⚠️  User and profile exist, but role is not "admin". Run: UPDATE profiles SET role = ''admin'' WHERE email = ''jrsschroeder@gmail.com'';'
    
    -- User exists but profile missing
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
     AND NOT EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    THEN '⚠️  User exists but profile is missing. Run: SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql'
    
    -- Role column missing
    WHEN NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role')
    THEN '❌ Role column is missing. Run: ALTER TABLE profiles ADD COLUMN role text DEFAULT ''user'' CHECK (role IN (''admin'', ''user''));'
    
    -- User doesn't exist
    WHEN NOT EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com')
    THEN '❌ User does not exist. Create user in: Supabase Dashboard → Authentication → Users → Add user (email: jrsschroeder@gmail.com)'
    
    ELSE '⚠️  Unknown configuration issue - Check individual parts above'
  END as final_status;

-- ============================================
-- PART 6: Quick Fix Commands (if needed)
-- ============================================
SELECT 
  'PART 6: Quick Fix Commands' as section,
  'Run these if needed (uncomment and execute)' as detail;

-- Uncomment and run if role column is missing:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Uncomment and run if profile exists but role is wrong:
-- UPDATE profiles SET role = 'admin' WHERE email = 'jrsschroeder@gmail.com';

-- Uncomment and run if profile doesn't exist (after user is created in auth.users):
-- INSERT INTO profiles (id, email, full_name, role)
-- SELECT 
--   id,
--   email,
--   COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
--   'admin'
-- FROM auth.users
-- WHERE email = 'jrsschroeder@gmail.com'
-- ON CONFLICT (id) DO UPDATE
-- SET role = 'admin', email = 'jrsschroeder@gmail.com';


