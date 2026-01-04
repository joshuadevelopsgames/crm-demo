-- Create notification_cache table for unified notification system
-- This table caches calculated notifications (at-risk accounts, neglected accounts)
-- to avoid expensive recalculations on every request

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

-- Drop existing policy if it exists
DROP POLICY IF EXISTS notification_cache_authenticated_all ON notification_cache;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY notification_cache_authenticated_all ON notification_cache
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy to allow service role (for API operations)
DROP POLICY IF EXISTS notification_cache_service_role_all ON notification_cache;
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

