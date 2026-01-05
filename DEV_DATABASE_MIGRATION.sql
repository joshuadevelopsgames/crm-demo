-- ============================================================================
-- DEV DATABASE MIGRATION - Complete Script
-- ============================================================================
-- This script adds all missing tables and columns that exist in production
-- but are missing in dev. Run this entire script in Supabase SQL Editor.
-- 
-- All statements are idempotent (safe to run multiple times).
-- ============================================================================

-- ============================================================================
-- SECTION 1: CRITICAL TABLES (Required for core functionality)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1: notification_cache table
-- Required for: Cache refresh, at-risk accounts, neglected accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_cache (
  cache_key text PRIMARY KEY,
  cache_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cache_expires ON notification_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_updated ON notification_cache(updated_at);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION set_notification_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_notification_cache_updated_at ON notification_cache;
CREATE TRIGGER trg_notification_cache_updated_at
  BEFORE UPDATE ON notification_cache
  FOR EACH ROW EXECUTE FUNCTION set_notification_cache_updated_at();

-- Enable Row Level Security
ALTER TABLE notification_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS notification_cache_authenticated_all ON notification_cache;
DROP POLICY IF EXISTS notification_cache_service_role_all ON notification_cache;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY notification_cache_authenticated_all ON notification_cache
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy to allow service role (for API operations)
CREATE POLICY notification_cache_service_role_all ON notification_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE notification_cache IS 'Caches calculated notification data (at-risk accounts, neglected accounts) for fast retrieval. Updated by background job every 5 minutes.';
COMMENT ON COLUMN notification_cache.cache_key IS 'Unique key for cache entry (e.g., "at-risk-accounts", "neglected-accounts")';
COMMENT ON COLUMN notification_cache.cache_data IS 'JSONB data containing the cached notification results';
COMMENT ON COLUMN notification_cache.expires_at IS 'Timestamp when cache expires and should be refreshed';
COMMENT ON COLUMN notification_cache.updated_at IS 'Timestamp when cache was last updated';

-- ----------------------------------------------------------------------------
-- 1.2: duplicate_at_risk_estimates table
-- Required for: Tracking duplicate at-risk estimates (bad data detection)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duplicate_at_risk_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  account_name text,
  division text,
  address text,
  estimate_ids text[] NOT NULL,
  estimate_numbers text[],
  contract_ends date[],
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  notes text
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_duplicate_account ON duplicate_at_risk_estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_resolved ON duplicate_at_risk_estimates(resolved_at);
CREATE INDEX IF NOT EXISTS idx_duplicate_detected ON duplicate_at_risk_estimates(detected_at);
CREATE INDEX IF NOT EXISTS idx_duplicate_unresolved ON duplicate_at_risk_estimates(account_id, resolved_at) WHERE resolved_at IS NULL;

-- Enable Row Level Security
ALTER TABLE duplicate_at_risk_estimates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS duplicate_estimates_authenticated_all ON duplicate_at_risk_estimates;
DROP POLICY IF EXISTS duplicate_estimates_service_role_all ON duplicate_at_risk_estimates;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY duplicate_estimates_authenticated_all ON duplicate_at_risk_estimates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy to allow service role (for API operations)
CREATE POLICY duplicate_estimates_service_role_all ON duplicate_at_risk_estimates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE duplicate_at_risk_estimates IS 'Tracks accounts with multiple at-risk estimates sharing the same department and address, indicating potential data quality issues that need review';
COMMENT ON COLUMN duplicate_at_risk_estimates.estimate_ids IS 'Array of estimate IDs that are duplicates';
COMMENT ON COLUMN duplicate_at_risk_estimates.estimate_numbers IS 'Array of estimate numbers for display';
COMMENT ON COLUMN duplicate_at_risk_estimates.contract_ends IS 'Array of contract end dates for the duplicate estimates';
COMMENT ON COLUMN duplicate_at_risk_estimates.resolved_at IS 'Timestamp when this duplicate issue was resolved (NULL = unresolved)';
COMMENT ON COLUMN duplicate_at_risk_estimates.resolved_by IS 'User ID or identifier of who resolved this issue';

-- ============================================================================
-- SECTION 2: FEATURE TABLES (Optional but recommended)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1: announcements table
-- Required for: System-wide announcements feature
-- ----------------------------------------------------------------------------
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON public.announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists before creating
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements 
  FOR EACH ROW EXECUTE FUNCTION set_announcements_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS announcements_authenticated_read ON public.announcements;
DROP POLICY IF EXISTS announcements_admin_write ON public.announcements;

-- RLS policy: all authenticated users can read active announcements
CREATE POLICY announcements_authenticated_read ON public.announcements
  FOR SELECT TO authenticated 
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RLS policy: only admins can create/update/delete announcements
CREATE POLICY announcements_admin_write ON public.announcements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  );

-- Add comment
COMMENT ON TABLE public.announcements IS 'System-wide announcements that can be created by admins and viewed by all users';

-- ----------------------------------------------------------------------------
-- 2.2: gmail_integrations table
-- Required for: Gmail OAuth integration (optional feature)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gmail_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id) -- One integration per user
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gmail_integrations_user_id ON gmail_integrations(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE gmail_integrations ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS gmail_integrations_select_own ON gmail_integrations;
DROP POLICY IF EXISTS gmail_integrations_insert_own ON gmail_integrations;
DROP POLICY IF EXISTS gmail_integrations_update_own ON gmail_integrations;
DROP POLICY IF EXISTS gmail_integrations_delete_own ON gmail_integrations;

-- RLS policies: Users can only access their own Gmail integration
CREATE POLICY gmail_integrations_select_own ON gmail_integrations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY gmail_integrations_insert_own ON gmail_integrations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY gmail_integrations_update_own ON gmail_integrations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY gmail_integrations_delete_own ON gmail_integrations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_gmail_integrations_updated_at ON gmail_integrations;
CREATE TRIGGER trg_gmail_integrations_updated_at
  BEFORE UPDATE ON gmail_integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add comment for documentation
COMMENT ON TABLE gmail_integrations IS 'Stores Gmail OAuth tokens securely on the server. Tokens are encrypted at rest by Supabase.';
COMMENT ON COLUMN gmail_integrations.access_token IS 'Gmail OAuth access token (encrypted at rest)';
COMMENT ON COLUMN gmail_integrations.refresh_token IS 'Gmail OAuth refresh token (encrypted at rest)';
COMMENT ON COLUMN gmail_integrations.token_expiry IS 'When the access token expires';
COMMENT ON COLUMN gmail_integrations.last_sync IS 'Last time emails were synced from Gmail';

-- ============================================================================
-- SECTION 3: MISSING COLUMNS (Add to existing tables)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1: profiles.selected_year column
-- Required for: Year selector feature (CRITICAL - fixes 400 error)
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS selected_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

COMMENT ON COLUMN profiles.selected_year IS 'User-selected year for site-wide data viewing. Revenue calculations, segments, and reports use this year. Persists across sessions.';

-- Set default for existing users to current year
UPDATE profiles
SET selected_year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE selected_year IS NULL;

-- ----------------------------------------------------------------------------
-- 3.2: profiles.notification_preferences column
-- Required for: User notification preferences
-- ----------------------------------------------------------------------------
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "email_notifications": true,
  "task_reminders": true,
  "system_announcements": true
}'::jsonb;

-- Create GIN index for faster queries on notification_preferences
CREATE INDEX IF NOT EXISTS idx_profiles_notification_preferences_gin 
  ON profiles USING GIN (notification_preferences);

-- Add comment
COMMENT ON COLUMN profiles.notification_preferences IS 'User preferences for notifications stored as JSONB: email_notifications, task_reminders, system_announcements';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all tables were created
DO $$
DECLARE
  missing_tables text[] := ARRAY[]::text[];
BEGIN
  -- Check notification_cache
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_cache') THEN
    missing_tables := array_append(missing_tables, 'notification_cache');
  END IF;
  
  -- Check duplicate_at_risk_estimates
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'duplicate_at_risk_estimates') THEN
    missing_tables := array_append(missing_tables, 'duplicate_at_risk_estimates');
  END IF;
  
  -- Check announcements
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
    missing_tables := array_append(missing_tables, 'announcements');
  END IF;
  
  -- Check gmail_integrations
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gmail_integrations') THEN
    missing_tables := array_append(missing_tables, 'gmail_integrations');
  END IF;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE WARNING 'Some tables were not created: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE '✅ All tables created successfully';
  END IF;
END $$;

-- Verify all columns were added
DO $$
DECLARE
  missing_columns text[] := ARRAY[]::text[];
BEGIN
  -- Check profiles.selected_year
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'selected_year'
  ) THEN
    missing_columns := array_append(missing_columns, 'profiles.selected_year');
  END IF;
  
  -- Check profiles.notification_preferences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'notification_preferences'
  ) THEN
    missing_columns := array_append(missing_columns, 'profiles.notification_preferences');
  END IF;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE WARNING 'Some columns were not added: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ All columns added successfully';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After running this script:
-- 1. ✅ notification_cache table - Cache refresh will work
-- 2. ✅ profiles.selected_year - Year selector will work (fixes 400 error)
-- 3. ✅ duplicate_at_risk_estimates - Duplicate detection will work
-- 4. ✅ announcements - Announcements feature will work
-- 5. ✅ gmail_integrations - Gmail integration will work (if used)
-- 6. ✅ profiles.notification_preferences - Notification preferences will work
-- ============================================================================

