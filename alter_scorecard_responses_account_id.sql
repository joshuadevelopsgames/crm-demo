-- Alter scorecard_responses table to change account_id from uuid to text
-- Note: We're removing the foreign key constraint because accounts.id is UUID
-- but the application passes text IDs. The relationship is maintained logically.

-- First, drop the foreign key constraint (if it exists)
ALTER TABLE scorecard_responses 
  DROP CONSTRAINT IF EXISTS scorecard_responses_account_id_fkey;

-- Change account_id column type from uuid to text
ALTER TABLE scorecard_responses 
  ALTER COLUMN account_id TYPE text USING account_id::text;

-- Change template_id column type from uuid to text (in case templates also use text IDs)
ALTER TABLE scorecard_responses 
  ALTER COLUMN template_id TYPE text USING template_id::text;

-- Note: We're NOT re-adding the foreign key constraint because:
-- 1. accounts.id is UUID type
-- 2. The application passes text IDs (like "1", "2")
-- 3. The relationship is maintained through application logic

