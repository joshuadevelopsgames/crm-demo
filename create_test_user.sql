-- Set up System Admin user (jrsschroeder@gmail.com) for testing and admin access
-- This ensures the System Admin account has admin role

-- Step 1: Ensure the role column exists in profiles table
-- (Run add_user_roles.sql first if you haven't already)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Step 2: Create the user in Supabase Dashboard first (if not already created):
-- 1. Go to Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Email: jrsschroeder@gmail.com
-- 4. Password: (set a password)
-- 5. After user is created, run the statements below

-- Step 3: Update profile role (run this after creating the user in Supabase Dashboard)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jrsschroeder@gmail.com';

-- Step 4: If profile doesn't exist yet, it will be created automatically by the trigger
-- But you can also manually create it:
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

