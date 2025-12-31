-- ============================================
-- LECRM Post-Setup SQL
-- Run this AFTER running the main schema (supabase-exported-schema.sql)
-- ============================================

-- ============================================
-- STEP 1: Create Storage Buckets
-- ============================================
-- Note: You can create buckets via SQL or Dashboard UI
-- If buckets already exist, these will be skipped

-- Create task-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,  -- Private bucket (requires authentication)
  10485760,  -- 10MB in bytes
  NULL  -- Allow all MIME types
)
ON CONFLICT (id) DO NOTHING;

-- Create account-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-attachments',
  'account-attachments',
  false,  -- Private bucket (requires authentication)
  10485760,  -- 10MB in bytes
  NULL  -- Allow all MIME types
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 2: Storage Bucket RLS Policies
-- ============================================

-- Task Attachments Policies
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Allow authenticated users to upload task attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read task attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete task attachments" ON storage.objects;
  
  -- Create new policies
  CREATE POLICY "Allow authenticated users to upload task attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

  CREATE POLICY "Allow authenticated users to read task attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-attachments');

  CREATE POLICY "Allow authenticated users to delete task attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-attachments');
END $$;

-- Account Attachments Policies
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Allow authenticated users to upload account attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read account attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete account attachments" ON storage.objects;
  
  -- Create new policies
  CREATE POLICY "Allow authenticated users to upload account attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'account-attachments' AND
    (storage.foldername(name))[1] IS NOT NULL -- Ensure file is in a folder (account_id)
  );

  CREATE POLICY "Allow authenticated users to read account attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'account-attachments');

  CREATE POLICY "Allow authenticated users to delete account attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'account-attachments');
END $$;

-- ============================================
-- STEP 3: System Admin Setup
-- ============================================
-- IMPORTANT: Create the user in Supabase Dashboard FIRST:
-- 1. Go to: Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" → "Create new user"
-- 3. Email: jrsschroeder@gmail.com
-- 4. Password: (set a secure password)
-- 5. Click "Create user"
-- 6. THEN this script will create the profile

-- Ensure the role column supports system_admin
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['system_admin'::text, 'admin'::text, 'user'::text]));

-- Create or update system admin profile
DO $$
DECLARE
  user_exists boolean;
  profile_exists boolean;
  user_id_val uuid;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'jrsschroeder@gmail.com') INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE NOTICE '⚠️  User jrsschroeder@gmail.com does not exist in auth.users';
    RAISE NOTICE 'Please create the user in Supabase Dashboard → Authentication → Users first';
    RAISE NOTICE 'Then run this script again';
    RETURN;
  END IF;
  
  -- Get the user ID
  SELECT id INTO user_id_val FROM auth.users WHERE email = 'jrsschroeder@gmail.com';
  
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = user_id_val) INTO profile_exists;
  
  IF profile_exists THEN
    -- Update existing profile
    UPDATE profiles 
    SET 
      role = 'system_admin',
      email = 'jrsschroeder@gmail.com',
      full_name = COALESCE(full_name, 'System Admin')
    WHERE id = user_id_val;
    RAISE NOTICE '✅ Updated existing profile to system_admin role';
  ELSE
    -- Create new profile from auth.users
    INSERT INTO profiles (id, email, full_name, role)
    SELECT 
      id,
      email,
      COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
      'system_admin'
    FROM auth.users
    WHERE email = 'jrsschroeder@gmail.com';
    RAISE NOTICE '✅ Created new profile with system_admin role';
  END IF;
END $$;

-- Verify the setup
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role = 'system_admin' THEN '✅ System Admin - Full access granted'
    WHEN p.role = 'admin' THEN '✅ Admin - Full access granted'
    ELSE '⚠️  User role (limited access) - Run UPDATE to set role = system_admin'
  END as status
FROM profiles p
WHERE p.email = 'jrsschroeder@gmail.com';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'accounts', 'contacts', 'profiles', 'user_permissions',
      'tasks', 'task_comments', 'task_attachments', 'account_attachments',
      'estimates', 'jobsites', 'interactions',
      'notifications', 'notification_snoozes',
      'sequences', 'sequence_enrollments',
      'scorecard_templates', 'scorecard_responses'
    ) THEN '✅'
    ELSE '⚠️'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check storage buckets exist
SELECT 
  id as bucket_name,
  public,
  file_size_limit,
  CASE 
    WHEN id IN ('task-attachments', 'account-attachments') THEN '✅'
    ELSE '⚠️'
  END as status
FROM storage.buckets
WHERE id IN ('task-attachments', 'account-attachments');

-- ============================================
-- COMPLETE!
-- ============================================
-- 
-- Next steps (manual):
-- 
-- 1. CREATE USER IN AUTHENTICATION (if not done):
--    - Go to Supabase Dashboard → Authentication → Users
--    - Add user: jrsschroeder@gmail.com
--    - Set password
--    - Then re-run the system admin section above
-- 
-- 2. UPDATE VERCEL ENVIRONMENT VARIABLES:
--    - Go to Vercel Dashboard → Your Production Project
--    - Settings → Environment Variables
--    - Update SUPABASE_URL to new production project URL
--    - Update SUPABASE_SERVICE_ROLE_KEY to new production service role key
--    - Update VITE_SUPABASE_URL to new production project URL
--    - Update VITE_SUPABASE_ANON_KEY to new production anon key
--    - Redeploy the project
-- 
-- 3. TEST:
--    - Login with jrsschroeder@gmail.com
--    - Verify admin access works
--    - Test file uploads (task and account attachments)
-- 
-- ============================================

