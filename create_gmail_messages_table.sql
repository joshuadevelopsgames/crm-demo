-- Migration: Create gmail_messages table for Phase 1 email tracking
-- This table stores Gmail messages before they're converted to interactions
-- Phase 1: Basic email sync without AI analysis

CREATE TABLE IF NOT EXISTS gmail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject text,
  snippet text,
  body text,
  sender_email text NOT NULL,
  recipient_email text NOT NULL,
  received_at timestamptz NOT NULL,
  is_important boolean DEFAULT false,
  -- Simple keyword-based filtering (Phase 1, no AI yet)
  keyword_matches text[], -- Array of matched keywords
  -- Reserved for Phase 3: AI analysis
  ai_analysis jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_gmail_messages_user_id ON gmail_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_contact_id ON gmail_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_account_id ON gmail_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_thread_id ON gmail_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_received_at ON gmail_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_sender_email ON gmail_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_is_important ON gmail_messages(is_important);

-- Enable Row Level Security (RLS)
ALTER TABLE gmail_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS gmail_messages_select_own ON gmail_messages;
DROP POLICY IF EXISTS gmail_messages_insert_own ON gmail_messages;
DROP POLICY IF EXISTS gmail_messages_update_own ON gmail_messages;
DROP POLICY IF EXISTS gmail_messages_delete_own ON gmail_messages;

-- RLS policies: Users can only access their own Gmail messages
CREATE POLICY gmail_messages_select_own ON gmail_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY gmail_messages_insert_own ON gmail_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY gmail_messages_update_own ON gmail_messages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY gmail_messages_delete_own ON gmail_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_gmail_messages_updated_at ON gmail_messages;
CREATE TRIGGER trg_gmail_messages_updated_at
  BEFORE UPDATE ON gmail_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add comment for documentation
COMMENT ON TABLE gmail_messages IS 'Stores Gmail messages synced from user accounts. Phase 1: Basic sync with keyword filtering. Messages are matched to contacts and can be converted to interactions.';

