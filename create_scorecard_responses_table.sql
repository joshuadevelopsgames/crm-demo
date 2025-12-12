-- Create scorecard_responses table
-- Note: account_id is text to match application IDs, but we don't use a foreign key
-- constraint because accounts.id is UUID while the app passes text IDs
CREATE TABLE IF NOT EXISTS scorecard_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text, -- No FK constraint: accounts.id is UUID but app uses text IDs
  template_id text,
  template_name text,
  responses jsonb,
  section_scores jsonb,
  total_score numeric,
  normalized_score numeric,
  is_pass boolean,
  scorecard_date date,
  completed_by text,
  completed_date timestamptz,
  scorecard_type text DEFAULT 'manual',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_account_id ON scorecard_responses(account_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_template_id ON scorecard_responses(template_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_completed_date ON scorecard_responses(completed_date);

-- Create trigger for updated_at
CREATE TRIGGER trg_scorecard_responses_updated_at
  BEFORE UPDATE ON scorecard_responses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE scorecard_responses ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS scorecard_responses_authenticated_all ON scorecard_responses;

-- RLS policy: restrict to authenticated users
-- Note: service_role key bypasses RLS, so API endpoints will work fine
CREATE POLICY scorecard_responses_authenticated_all ON scorecard_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


