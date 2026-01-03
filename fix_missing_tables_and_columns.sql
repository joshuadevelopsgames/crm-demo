-- Fix Missing Tables and Columns
-- This script fixes:
-- 1. Missing announcements table
-- 2. Missing dark_mode column in profiles table
-- 3. Missing test_mode_enabled column in profiles table

-- ============================================================================
-- PART 1: Create announcements table
-- ============================================================================

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

-- Step 2: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON public.announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);

-- Step 3: Create update trigger function
CREATE OR REPLACE FUNCTION set_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements 
  FOR EACH ROW EXECUTE FUNCTION set_announcements_updated_at();

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS announcements_authenticated_read ON public.announcements;
DROP POLICY IF EXISTS announcements_admin_write ON public.announcements;

-- Step 7: Create RLS policy for reading (all authenticated users can read active announcements)
CREATE POLICY announcements_authenticated_read ON public.announcements
  FOR SELECT TO authenticated 
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Step 8: Create RLS policy for writing (only admins can create/update/delete)
CREATE POLICY announcements_admin_write ON public.announcements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  );

-- Step 9: Add comment
COMMENT ON TABLE public.announcements IS 'System-wide announcements that can be created by admins and viewed by all users';

-- ============================================================================
-- PART 2: Add missing columns to profiles table
-- ============================================================================

-- Add user preferences columns to profiles table
-- These will store dark mode and test mode preferences on the server
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS test_mode_enabled boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.dark_mode IS 'User preference for dark mode. NULL means use system preference.';
COMMENT ON COLUMN public.profiles.test_mode_enabled IS 'User preference for test mode (2025 simulation). Only applies to eligible users.';

-- ============================================================================
-- Verification queries (optional - run these to verify)
-- ============================================================================

-- Verify announcements table exists
-- SELECT 
--   'announcements table created successfully' as status,
--   COUNT(*) as row_count
-- FROM public.announcements;

-- Verify profiles columns exist
-- SELECT 
--   column_name, 
--   data_type, 
--   column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name IN ('dark_mode', 'test_mode_enabled');

