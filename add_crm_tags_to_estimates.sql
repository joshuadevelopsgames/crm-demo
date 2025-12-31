-- Add crm_tags column to estimates table
ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS crm_tags text;

COMMENT ON COLUMN estimates.crm_tags IS 'CRM tags/labels for categorizing estimates (e.g., account names, project types, salesperson names)';

