-- Complete setup for System Admin (jrsschroeder@gmail.com)
-- Run this AFTER creating the user in Supabase Authentication Dashboard
-- 
-- STEP 1: Create the user in Supabase Dashboard first:
--   1. Go to: Supabase Dashboard → Authentication → Users
--   2. Click "Add user" → "Create new user"
--   3. Email: jrsschroeder@gmail.com
--   4. Password: (set a secure password)
--   5. Click "Create user"
--   6. THEN run this script

-- Step 2: Ensure the role column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Step 3: Check if user exists in auth.users
DO $$
DECLARE
  user_exists boolean;
  profile_exists boolean;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com') INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE NOTICE '⚠️  User jrsschroeder@gmail.com does not exist in auth.users';
    RAISE NOTICE 'Please create the user in Supabase Dashboard → Authentication → Users first';
    RAISE NOTICE 'Then run this script again';
    RETURN;
  END IF;
  
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com') INTO profile_exists;
  
  IF profile_exists THEN
    -- Update existing profile
    UPDATE profiles 
    SET role = 'admin', email = 'jrsschroeder@gmail.com'
    WHERE email = 'jrsschroeder@gmail.com';
    RAISE NOTICE '✅ Updated existing profile to admin role';
  ELSE
    -- Create new profile from auth.users
    INSERT INTO profiles (id, email, full_name, role)
    SELECT 
      id,
      email,
      COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
      'admin'
    FROM auth.users
    WHERE email = 'jrsschroeder@gmail.com';
    RAISE NOTICE '✅ Created new profile with admin role';
  END IF;
END $$;

-- Step 4: Verify the setup
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role = 'admin' THEN '✅ System Admin - Full access granted'
    ELSE '⚠️  User role (limited access) - Run UPDATE to set role = admin'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- If no rows returned above, the user hasn't been created in Authentication yet.
-- Go to: Supabase Dashboard → Authentication → Users → Add user
-- Create user with email: jrsschroeder@gmail.com
-- Then run this script again.

