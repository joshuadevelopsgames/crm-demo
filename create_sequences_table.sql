-- Create sequences table
CREATE TABLE IF NOT EXISTS sequences (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  account_type text DEFAULT 'general',
  is_active boolean DEFAULT true,
  steps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sequences_account_type ON sequences(account_type);
CREATE INDEX IF NOT EXISTS idx_sequences_is_active ON sequences(is_active);
CREATE INDEX IF NOT EXISTS idx_sequences_name ON sequences(name);

-- Ensure set_updated_at function exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_sequences_updated_at ON sequences;
CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON sequences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS sequences_authenticated_all ON sequences;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY sequences_authenticated_all ON sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

