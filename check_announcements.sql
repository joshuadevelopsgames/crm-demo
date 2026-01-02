-- Check if announcements table exists and has data
-- Run this in Supabase SQL Editor to debug

-- 1. Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'announcements'
    ) THEN '✅ Table exists'
    ELSE '❌ Table does NOT exist'
  END as table_status;

-- 2. Count total announcements
SELECT 
  COUNT(*) as total_announcements,
  COUNT(*) FILTER (WHERE is_active = true) as active_announcements,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_announcements
FROM public.announcements;

-- 3. Show all announcements with details
SELECT 
  id,
  title,
  priority,
  is_active,
  created_at,
  expires_at,
  CASE 
    WHEN expires_at IS NULL THEN 'No expiration'
    WHEN expires_at > now() THEN 'Active (not expired)'
    ELSE 'EXPIRED'
  END as expiration_status,
  created_by
FROM public.announcements
ORDER BY created_at DESC;

-- 4. Show only active, non-expired announcements (what users should see)
SELECT 
  id,
  title,
  priority,
  content,
  created_at,
  expires_at
FROM public.announcements
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC;

-- 5. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'announcements';

