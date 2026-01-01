-- Make jrsschroeder@gmail.com an admin
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn/sql

-- Step 1: Ensure role column exists with all role types
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Update constraint to allow system_admin, admin, and user
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('system_admin', 'admin', 'user'));

-- Step 2: Ensure profile exists (create if missing)
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
  'system_admin'
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'system_admin',
  email = EXCLUDED.email;

-- Step 3: Update existing profile to system_admin (if it exists)
UPDATE profiles 
SET role = 'system_admin'
WHERE email = 'jrsschroeder@gmail.com';

-- Step 4: Verify the result
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role = 'system_admin' THEN '✅ System Admin (Full access, cannot be deleted)'
    WHEN p.role = 'admin' THEN '✅ Admin (Full access)'
    WHEN p.role = 'user' THEN '⚠️  User (Limited access) - Update needed!'
    ELSE '❌ Unknown role'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- If no rows returned above, the user doesn't exist in auth.users yet.
-- Create the user first in: Supabase Dashboard → Authentication → Users
-- Then run this script again.

