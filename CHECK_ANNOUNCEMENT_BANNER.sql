-- Diagnostic query to check why announcement banner isn't showing
-- Run this in Supabase SQL Editor

-- 1. Check if announcements table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'announcements'
) AS table_exists;

-- 2. Check all announcements (including inactive/expired)
SELECT 
  id,
  title,
  is_active,
  expires_at,
  expires_at < NOW() AS is_expired,
  created_at,
  priority
FROM announcements
ORDER BY created_at DESC;

-- 3. Check only active, non-expired announcements (what should show)
SELECT 
  id,
  title,
  content,
  priority,
  is_active,
  expires_at,
  created_at
FROM announcements
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC;

-- 4. Count announcements by status
SELECT 
  COUNT(*) FILTER (WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())) AS active_count,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive_count,
  COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW()) AS expired_count,
  COUNT(*) AS total_count
FROM announcements;

-- 5. Check if any users have system_announcements disabled
SELECT 
  id,
  email,
  notification_preferences->>'system_announcements' AS system_announcements_enabled
FROM profiles
WHERE notification_preferences->>'system_announcements' = 'false'
LIMIT 10;

