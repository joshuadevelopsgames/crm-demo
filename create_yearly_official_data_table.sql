-- Create table for yearly official LMN data (from detailed exports)
-- This serves as the source of truth for yearly reports

CREATE TABLE IF NOT EXISTS yearly_official_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lmn_estimate_id TEXT NOT NULL,
  status TEXT,
  total_price NUMERIC(12, 2),
  estimate_close_date TIMESTAMPTZ,
  division TEXT,
  source_year INTEGER NOT NULL,
  source_file TEXT,
  is_official_lmn_data BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one estimate per year (can have same estimate in multiple years)
  UNIQUE(lmn_estimate_id, source_year)
);

-- Create index for fast year lookups
CREATE INDEX IF NOT EXISTS idx_yearly_official_estimates_year ON yearly_official_estimates(source_year);
CREATE INDEX IF NOT EXISTS idx_yearly_official_estimates_lmn_id ON yearly_official_estimates(lmn_estimate_id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_yearly_official_estimates_status ON yearly_official_estimates(status);

-- Enable RLS
ALTER TABLE yearly_official_estimates ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read yearly official estimates"
  ON yearly_official_estimates
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow service role to manage (for imports)
CREATE POLICY "Allow service role to manage yearly official estimates"
  ON yearly_official_estimates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_yearly_official_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_yearly_official_estimates_updated_at
  BEFORE UPDATE ON yearly_official_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_yearly_official_estimates_updated_at();

