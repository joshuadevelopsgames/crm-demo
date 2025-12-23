-- Complete Migration: Change ALL import-related tables to use text IDs instead of UUIDs
-- This allows using imported IDs (like lmn-account-6857868, lmn-estimate-EST1807324) as primary keys
-- 
-- Tables that will use text IDs:
-- - accounts (already migrated)
-- - contacts (already migrated)
-- - estimates (this migration)
-- - jobsites (this migration)
--
-- Tables that will keep UUIDs (system-generated, not from imports):
-- - tasks (system-generated)
-- - interactions (system-generated)
-- - scorecard_responses (system-generated)

BEGIN;

-- ============================================
-- STEP 1: Drop foreign key constraints
-- ============================================
ALTER TABLE IF EXISTS estimates DROP CONSTRAINT IF EXISTS estimates_account_id_fkey;
ALTER TABLE IF EXISTS estimates DROP CONSTRAINT IF EXISTS estimates_contact_id_fkey;
ALTER TABLE IF EXISTS jobsites DROP CONSTRAINT IF EXISTS jobsites_account_id_fkey;
ALTER TABLE IF EXISTS jobsites DROP CONSTRAINT IF EXISTS jobsites_contact_id_fkey;

-- ============================================
-- STEP 2: Change estimates.id from uuid to text
-- ============================================
ALTER TABLE estimates ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE estimates ALTER COLUMN id DROP DEFAULT;

-- ============================================
-- STEP 3: Change jobsites.id from uuid to text
-- ============================================
ALTER TABLE jobsites ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE jobsites ALTER COLUMN id DROP DEFAULT;

-- ============================================
-- STEP 4: Re-add foreign key constraints
-- ============================================
ALTER TABLE estimates 
  ADD CONSTRAINT estimates_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE estimates 
  ADD CONSTRAINT estimates_contact_id_fkey 
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE jobsites 
  ADD CONSTRAINT jobsites_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE jobsites 
  ADD CONSTRAINT jobsites_contact_id_fkey 
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================
-- Check that all import-related tables now use text IDs
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name IN ('accounts', 'contacts', 'estimates', 'jobsites')
  AND column_name = 'id'
ORDER BY table_name;

-- Expected results:
-- accounts:    data_type = 'text', column_default = NULL
-- contacts:    data_type = 'text', column_default = NULL
-- estimates:   data_type = 'text', column_default = NULL
-- jobsites:    data_type = 'text', column_default = NULL

-- ============================================
-- DONE!
-- ============================================
-- Now all import-related tables use text IDs:
-- - accounts:    lmn-account-6857868
-- - contacts:    lmn-contact-1234567
-- - estimates:  lmn-estimate-EST1807324
-- - jobsites:    lmn-jobsite-6539353
--
-- System-generated tables (tasks, interactions, scorecard_responses) 
-- still use UUIDs, which is fine since they're not from imports.

