-- Migration: Change accounts and contacts to use text IDs instead of UUIDs
-- This allows using imported IDs (like lmn-account-6857868) as primary keys

-- Step 1: Drop foreign key constraints that reference accounts.id and contacts.id
ALTER TABLE IF EXISTS contacts DROP CONSTRAINT IF EXISTS contacts_account_id_fkey;
ALTER TABLE IF EXISTS estimates DROP CONSTRAINT IF EXISTS estimates_account_id_fkey;
ALTER TABLE IF EXISTS estimates DROP CONSTRAINT IF EXISTS estimates_contact_id_fkey;
ALTER TABLE IF EXISTS jobsites DROP CONSTRAINT IF EXISTS jobsites_account_id_fkey;
ALTER TABLE IF EXISTS jobsites DROP CONSTRAINT IF EXISTS jobsites_contact_id_fkey;
ALTER TABLE IF EXISTS tasks DROP CONSTRAINT IF EXISTS tasks_related_account_id_fkey;
ALTER TABLE IF EXISTS tasks DROP CONSTRAINT IF EXISTS tasks_related_contact_id_fkey;
ALTER TABLE IF EXISTS interactions DROP CONSTRAINT IF EXISTS interactions_account_id_fkey;
ALTER TABLE IF EXISTS interactions DROP CONSTRAINT IF EXISTS interactions_contact_id_fkey;
ALTER TABLE IF EXISTS scorecard_responses DROP CONSTRAINT IF EXISTS scorecard_responses_account_id_fkey;

-- Step 2: Change accounts.id from uuid to text
-- First, we need to update all foreign key columns to text
ALTER TABLE contacts ALTER COLUMN account_id TYPE text USING account_id::text;
ALTER TABLE estimates ALTER COLUMN account_id TYPE text USING account_id::text;
ALTER TABLE estimates ALTER COLUMN contact_id TYPE text USING contact_id::text;
ALTER TABLE jobsites ALTER COLUMN account_id TYPE text USING account_id::text;
ALTER TABLE jobsites ALTER COLUMN contact_id TYPE text USING contact_id::text;
ALTER TABLE tasks ALTER COLUMN related_account_id TYPE text USING related_account_id::text;
ALTER TABLE tasks ALTER COLUMN related_contact_id TYPE text USING related_contact_id::text;
ALTER TABLE interactions ALTER COLUMN account_id TYPE text USING account_id::text;
ALTER TABLE interactions ALTER COLUMN contact_id TYPE text USING contact_id::text;

-- Now change accounts.id to text
-- We'll need to convert existing UUIDs to text format
ALTER TABLE accounts ALTER COLUMN id TYPE text USING id::text;

-- Step 3: Change contacts.id from uuid to text
ALTER TABLE contacts ALTER COLUMN id TYPE text USING id::text;

-- Step 4: Re-add foreign key constraints with text types
ALTER TABLE contacts 
  ADD CONSTRAINT contacts_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

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

ALTER TABLE tasks 
  ADD CONSTRAINT tasks_related_account_id_fkey 
  FOREIGN KEY (related_account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE tasks 
  ADD CONSTRAINT tasks_related_contact_id_fkey 
  FOREIGN KEY (related_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE interactions 
  ADD CONSTRAINT interactions_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE interactions 
  ADD CONSTRAINT interactions_contact_id_fkey 
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

-- Note: scorecard_responses.account_id is already text, so no change needed there

-- Step 5: Remove DEFAULT gen_random_uuid() from accounts and contacts
ALTER TABLE accounts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE contacts ALTER COLUMN id DROP DEFAULT;

-- Step 6: Update indexes (they should still work, but verify)
-- The existing indexes on id columns will continue to work with text

-- Done! Now accounts and contacts can use text IDs like "lmn-account-6857868"

