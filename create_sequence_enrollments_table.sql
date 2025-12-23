-- Create sequence_enrollments table
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id text PRIMARY KEY,
  account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  sequence_id text NOT NULL,
  status text DEFAULT 'active',
  current_step integer DEFAULT 1,
  started_date date,
  next_action_date date,
  completed_steps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_account_id ON sequence_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_action_date ON sequence_enrollments(next_action_date);

-- Ensure set_updated_at function exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_sequence_enrollments_updated_at ON sequence_enrollments;
CREATE TRIGGER trg_sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS sequence_enrollments_authenticated_all ON sequence_enrollments;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY sequence_enrollments_authenticated_all ON sequence_enrollments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

