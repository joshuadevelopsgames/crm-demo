-- Fix login issue for caleb@lecm.ca
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: If the user doesn't exist yet, create it first:
--   1. Go to: Supabase Dashboard → Authentication → Users
--   2. Click "Add user" → "Create new user"
--   3. Email: caleb@lecm.ca
--   4. Set a password (remember this!)
--   5. ✅ Check "Auto Confirm Email" (IMPORTANT - this allows immediate login)
--   6. Click "Create user"
--   7. Then run this script

-- ============================================
-- PART 1: Check if user exists in auth.users
-- ============================================
SELECT 
  'PART 1: Checking auth.users' as section,
  '' as detail;

SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email = 'caleb@lecm.ca' THEN 
      CASE 
        WHEN email_confirmed_at IS NOT NULL THEN '✅ User exists and email is confirmed'
        ELSE '⚠️ User exists but email is NOT confirmed - Check "Auto Confirm Email" in Dashboard'
      END
    ELSE '⚠️ User found but email mismatch'
  END as status
FROM auth.users
WHERE email = 'caleb@lecm.ca';

-- Check if user exists
SELECT 
  CASE 
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'caleb@lecm.ca')
    THEN '✅ User exists in auth.users'
    ELSE '❌ User NOT found in auth.users - Create user in Authentication > Users first (see instructions at top)'
  END as auth_users_check;

-- ============================================
-- PART 2: Ensure role column exists in profiles
-- ============================================
SELECT 
  'PART 2: Ensuring profiles table has role column' as section,
  '' as detail;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user', 'system_admin'));

-- ============================================
-- PART 3: Create or update profile for caleb@lecm.ca
-- ============================================
SELECT 
  'PART 3: Creating/updating profile' as section,
  '' as detail;

-- If profile doesn't exist, create it from auth.users
-- This will only work if the user exists in auth.users
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Caleb'),
  'user'  -- Default role, can be changed to 'admin' if needed
FROM auth.users
WHERE email = 'caleb@lecm.ca'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email, 
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name, 'Caleb'),
  role = COALESCE(profiles.role, 'user');

-- ============================================
-- PART 4: Verify the setup
-- ============================================
SELECT 
  'PART 4: Verification' as section,
  '' as detail;

SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  au.email_confirmed_at,
  CASE 
    WHEN p.email = 'caleb@lecm.ca' AND au.email_confirmed_at IS NOT NULL THEN '✅ Account ready - User can login'
    WHEN p.email = 'caleb@lecm.ca' AND au.email_confirmed_at IS NULL THEN '⚠️ Email not confirmed - User needs to confirm email or you need to check "Auto Confirm Email" in Dashboard'
    WHEN p.email = 'caleb@lecm.ca' THEN '✅ Profile exists - Check email confirmation status above'
    ELSE '❌ Profile not found'
  END as status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.email = 'caleb@lecm.ca';

-- ============================================
-- PART 5: Troubleshooting Summary
-- ============================================
SELECT 
  'PART 5: Troubleshooting Summary' as section,
  '' as detail;

SELECT 
  CASE 
    WHEN NOT EXISTS(SELECT 1 FROM auth.users WHERE email = 'caleb@lecm.ca')
    THEN '❌ ACTION REQUIRED: User does not exist. Go to Supabase Dashboard → Authentication → Users → Add user → Create user with email: caleb@lecm.ca (check "Auto Confirm Email")'
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE email = 'caleb@lecm.ca' AND email_confirmed_at IS NULL)
    THEN '⚠️ ACTION REQUIRED: User exists but email is not confirmed. Go to Supabase Dashboard → Authentication → Users → Find caleb@lecm.ca → Click "Confirm Email" or recreate with "Auto Confirm Email" checked'
    WHEN NOT EXISTS(SELECT 1 FROM profiles WHERE email = 'caleb@lecm.ca')
    THEN '⚠️ Profile missing - Run this script again after ensuring user exists in auth.users'
    ELSE '✅ Setup complete! If login still fails, check: 1) Password is correct, 2) User can reset password via "Send Password Reset Email" in Dashboard'
  END as next_steps;

