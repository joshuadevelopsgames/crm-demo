-- Create scorecard_templates table with versioning support
CREATE TABLE IF NOT EXISTS scorecard_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false, -- Marks the ICP template
  pass_threshold numeric DEFAULT 70,
  total_possible_score numeric,
  questions jsonb,
  version_number integer DEFAULT 1,
  is_current_version boolean DEFAULT true, -- Only one version per template is current
  parent_template_id uuid, -- References the original template (for version history)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_name ON scorecard_templates(name);
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_default ON scorecard_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_current ON scorecard_templates(is_current_version) WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_parent ON scorecard_templates(parent_template_id);

-- Create trigger for updated_at
CREATE TRIGGER trg_scorecard_templates_updated_at
  BEFORE UPDATE ON scorecard_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE scorecard_templates ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS scorecard_templates_authenticated_all ON scorecard_templates;

-- RLS policy: restrict to authenticated users
CREATE POLICY scorecard_templates_authenticated_all ON scorecard_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

