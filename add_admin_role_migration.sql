-- Migration: Add 'admin' role separate from 'system_admin'
-- This allows regular admins vs the special system admin (jrsschroeder@gmail.com)
-- Run this in Supabase SQL Editor

-- Step 1: Update the role constraint to allow three roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('system_admin', 'admin', 'user'));

-- Step 2: Update system admin (jrsschroeder@gmail.com) to 'system_admin' role
UPDATE profiles 
SET role = 'system_admin' 
WHERE email = 'jrsschroeder@gmail.com';

-- Step 3: Update any existing 'admin' roles to 'admin' (they stay as 'admin')
-- This is just to ensure consistency - existing admins remain as 'admin'

-- Step 4: Update the trigger function to use 'system_admin' for system admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    -- Set system_admin role for system admin email, otherwise default to 'user'
    CASE 
      WHEN NEW.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE COALESCE(profiles.role, 'user')
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Verify the changes
SELECT 
  email,
  role,
  CASE 
    WHEN role = 'system_admin' THEN '✅ System Admin (Full access, cannot be deleted)'
    WHEN role = 'admin' THEN '✅ Admin (Full access, can manage users)'
    WHEN role = 'user' THEN '✅ User (Standard access)'
    ELSE '⚠️ Unknown role'
  END as role_description
FROM profiles
ORDER BY 
  CASE role
    WHEN 'system_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'user' THEN 3
  END,
  email;

