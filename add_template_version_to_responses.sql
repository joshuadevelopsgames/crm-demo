-- Add template_version_id to scorecard_responses to track which template version was used
ALTER TABLE scorecard_responses 
  ADD COLUMN IF NOT EXISTS template_version_id text;

-- Create index for faster lookups by template version
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_template_version ON scorecard_responses(template_version_id);

