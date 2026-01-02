-- Create gmail_integrations table to securely store Gmail OAuth tokens
-- Tokens are stored server-side to prevent XSS attacks

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

