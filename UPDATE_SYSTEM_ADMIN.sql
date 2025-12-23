-- Update System Admin account (jrsschroeder@gmail.com) to ensure admin role
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: If the user doesn't exist yet, create it first:
--   1. Go to: Supabase Dashboard → Authentication → Users
--   2. Click "Add user" → "Create new user"
--   3. Email: jrsschroeder@gmail.com
--   4. Set a password
--   5. Then run this script

-- Step 1: Ensure the role column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Step 2: Update existing profile to admin (if profile already exists)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jrsschroeder@gmail.com';

-- Step 3: If profile doesn't exist, create it from auth.users
-- This will only work if the user exists in auth.users
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
  'admin'
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = 'jrsschroeder@gmail.com', 
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name, 'System Admin');

-- Step 4: Verify the setup
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role = 'admin' THEN '✓ System Admin - Full access'
    ELSE '⚠ User role (limited access) - Run UPDATE to set role = admin'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- If no rows returned above, the user hasn't been created in Authentication yet.
-- Go to: Supabase Dashboard → Authentication → Users → Add user
-- Create user with email: jrsschroeder@gmail.com
-- Then run this script again.

