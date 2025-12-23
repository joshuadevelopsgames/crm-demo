-- Create test user for debugging TotalWork calculations
-- This creates a user in auth.users and a corresponding profile

-- Step 1: Ensure the role column exists in profiles table
-- (Run add_user_roles.sql first if you haven't already)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Step 2: Create the user in Supabase Dashboard first:
-- 1. Go to Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Email: test@test.com
-- 4. Password: (set a password)
-- 5. After user is created, run the statements below

-- Step 3: Update profile role (run this after creating the user in Supabase Dashboard)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'test@test.com';

-- Step 4: If profile doesn't exist yet, it will be created automatically by the trigger
-- But you can also manually create it:
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  'Test User',
  'admin'
FROM auth.users
WHERE email = 'test@test.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = 'test@test.com';

