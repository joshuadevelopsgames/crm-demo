-- Quick fix to grant admin access to jrsschroeder@gmail.com
-- Run this in Supabase SQL Editor

-- Step 1: Ensure role column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Step 2: Update the role to admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jrsschroeder@gmail.com';

-- Step 3: If profile doesn't exist, create it from auth.users
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
  'admin'
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = 'jrsschroeder@gmail.com';

-- Step 4: Verify the fix
SELECT 
  p.id,
  p.email,
  p.role,
  p.full_name,
  CASE 
    WHEN p.role = 'admin' THEN '✅ FIXED - User now has admin role and can access Permissions page'
    ELSE '❌ Still not fixed - Check the output above for errors'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

