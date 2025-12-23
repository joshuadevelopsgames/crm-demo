-- Create interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  type text NOT NULL,
  subject text,
  content text,
  direction text,
  sentiment text,
  interaction_date timestamptz NOT NULL,
  logged_by text,
  tags text[],
  gmail_thread_id text,
  gmail_message_id text,
  gmail_link text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_interaction_date ON interactions(interaction_date);
CREATE INDEX IF NOT EXISTS idx_interactions_gmail_message_id ON interactions(gmail_message_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER trg_interactions_updated_at
  BEFORE UPDATE ON interactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS interactions_authenticated_all ON interactions;

-- RLS policy: restrict to authenticated users
CREATE POLICY interactions_authenticated_all ON interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
