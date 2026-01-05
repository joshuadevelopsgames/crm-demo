-- Create sales_insights table
CREATE TABLE IF NOT EXISTS sales_insights (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('opportunity', 'pain_point', 'risk', 'competitive_intel', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  recorded_by TEXT,
  recorded_date TIMESTAMPTZ DEFAULT NOW(),
  related_interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create research_notes table
CREATE TABLE IF NOT EXISTS research_notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('company_info', 'market_research', 'key_person', 'industry_trends', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  recorded_by TEXT,
  recorded_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_insights_account_id ON sales_insights(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_insights_recorded_date ON sales_insights(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_insights_insight_type ON sales_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_research_notes_account_id ON research_notes(account_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_recorded_date ON research_notes(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_research_notes_note_type ON research_notes(note_type);

-- Enable Row Level Security
ALTER TABLE sales_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all authenticated users to read/write
CREATE POLICY sales_insights_authenticated_all ON sales_insights
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY research_notes_authenticated_all ON research_notes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE sales_insights IS 'Stores sales insights for accounts (opportunities, pain points, risks, competitive intel)';
COMMENT ON TABLE research_notes IS 'Stores research notes for accounts (company info, market research, key people, industry trends)';

