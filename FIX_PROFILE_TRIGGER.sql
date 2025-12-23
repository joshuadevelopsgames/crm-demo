-- Fix the profile creation trigger to include role field and set admin for system admin
-- Run this in Supabase SQL Editor

-- Step 1: Update the trigger function to include role field
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    -- Set admin role for system admin email, otherwise default to 'user'
    CASE 
      WHEN NEW.email = 'jrsschroeder@gmail.com' THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'admin'
      ELSE COALESCE(profiles.role, 'user')
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Ensure the trigger exists (it should already exist, but this ensures it)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: For existing users without profiles, create them now
-- This handles the case where users were created before the trigger was set up
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN 'admin'
    ELSE 'user'
  END
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = CASE 
    WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'admin'
    ELSE COALESCE(profiles.role, 'user')
  END;

-- Step 4: Update existing system admin profile to ensure it has admin role
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jrsschroeder@gmail.com' AND (role IS NULL OR role != 'admin');

-- Step 5: Verify the fix
SELECT 
  'Trigger Fix Verification' as check_type,
  p.id,
  p.email,
  p.role,
  CASE 
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'admin' THEN '✅ System Admin correctly configured'
    WHEN p.email = 'jrsschroeder@gmail.com' THEN '❌ System Admin role is: ' || COALESCE(p.role, 'NULL')
    ELSE '✅ User profile exists'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com' OR p.id IN (
  SELECT id FROM auth.users WHERE id NOT IN (SELECT id FROM profiles) LIMIT 5
);

