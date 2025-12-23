-- Migration: Change estimates and jobsites to use text IDs instead of UUIDs
-- This allows using imported IDs (like lmn-estimate-EST1807324) as primary keys

-- Step 1: Drop foreign key constraints that reference estimates.id and jobsites.id
-- (Note: No tables currently reference estimates.id or jobsites.id as foreign keys,
--  but we'll check for any that might exist)
ALTER TABLE IF EXISTS estimates DROP CONSTRAINT IF EXISTS estimates_account_id_fkey;
ALTER TABLE IF EXISTS estimates DROP CONSTRAINT IF EXISTS estimates_contact_id_fkey;
ALTER TABLE IF EXISTS jobsites DROP CONSTRAINT IF EXISTS jobsites_account_id_fkey;
ALTER TABLE IF EXISTS jobsites DROP CONSTRAINT IF EXISTS jobsites_contact_id_fkey;

-- Step 2: Change estimates.id from uuid to text
-- First, we need to ensure account_id and contact_id are already text (they should be from previous migration)
-- Then change the id column itself
ALTER TABLE estimates ALTER COLUMN id TYPE text USING id::text;

-- Step 3: Change jobsites.id from uuid to text
ALTER TABLE jobsites ALTER COLUMN id TYPE text USING id::text;

-- Step 4: Remove DEFAULT gen_random_uuid() from estimates and jobsites
ALTER TABLE estimates ALTER COLUMN id DROP DEFAULT;
ALTER TABLE jobsites ALTER COLUMN id DROP DEFAULT;

-- Step 5: Re-add foreign key constraints (they should already be text, but let's ensure)
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

-- Done! Now estimates and jobsites can use text IDs like "lmn-estimate-EST1807324" and "lmn-jobsite-6539353"

