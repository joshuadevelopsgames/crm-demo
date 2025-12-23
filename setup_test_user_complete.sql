-- Complete script to set up System Admin user (jrsschroeder@gmail.com)
-- Run this in Supabase SQL Editor after creating the user in Authentication dashboard

-- Step 1: Ensure the role column exists in profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Step 2: Create or update the profile for jrsschroeder@gmail.com (System Admin)
-- Note: The user must be created in Authentication > Users first
-- This will update the profile if it exists, or you'll need to create it manually

-- Option A: Update existing profile (if user was created and profile exists)
UPDATE profiles 
SET role = 'admin', email = 'jrsschroeder@gmail.com'
WHERE email = 'jrsschroeder@gmail.com';

-- Option B: Insert profile if it doesn't exist (run this if Option A affects 0 rows)
-- First, get the user ID from auth.users
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

-- Step 3: Verify the user was set up correctly
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role = 'admin' THEN '✓ Admin access granted'
    ELSE '⚠ User role (limited access)'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- If no rows returned, the user hasn't been created in auth.users yet
-- Go to Authentication > Users > Add user and create jrsschroeder@gmail.com first

