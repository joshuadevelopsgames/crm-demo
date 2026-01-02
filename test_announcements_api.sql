-- Test script to verify announcements data and troubleshoot
-- Run each section separately in Supabase SQL Editor

-- 1. Verify table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'announcements'
ORDER BY ordinal_position;

-- 2. Check if there are ANY announcements at all
SELECT COUNT(*) as total_count FROM public.announcements;

-- 3. Check active announcements that should be visible
SELECT 
  id,
  title,
  priority,
  is_active,
  created_at,
  expires_at,
  created_by,
  CASE 
    WHEN is_active = false THEN '❌ Inactive'
    WHEN expires_at IS NOT NULL AND expires_at <= now() THEN '❌ Expired'
    WHEN expires_at IS NOT NULL AND expires_at > now() THEN '✅ Active (expires ' || expires_at::text || ')'
    ELSE '✅ Active (no expiration)'
  END as status
FROM public.announcements
ORDER BY created_at DESC;

-- 4. Show exactly what the API should return (active, non-expired)
SELECT 
  id,
  title,
  content,
  priority,
  created_at,
  expires_at,
  is_active
FROM public.announcements
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC;

-- 5. Check for data type issues with created_by
SELECT 
  id,
  title,
  created_by,
  pg_typeof(created_by) as created_by_type,
  created_by::text as created_by_text
FROM public.announcements
LIMIT 5;

-- 6. Test the exact query the API uses (simulating service role bypass)
-- This should return the same as section 4
SELECT *
FROM public.announcements
WHERE is_active = true
ORDER BY created_at DESC;

