-- Migration: Update all existing accounts to use imported ID format (lmn-account-{lmn_crm_id})
-- This ensures all accounts with lmn_crm_id use the consistent ID format

-- Step 1: Temporarily drop foreign key constraints to allow ID updates
-- (We'll recreate them after the migration)

ALTER TABLE IF EXISTS contacts DROP CONSTRAINT IF EXISTS contacts_account_id_fkey;
ALTER TABLE IF EXISTS estimates DROP CONSTRAINT IF EXISTS estimates_account_id_fkey;
ALTER TABLE IF EXISTS jobsites DROP CONSTRAINT IF EXISTS jobsites_account_id_fkey;
ALTER TABLE IF EXISTS tasks DROP CONSTRAINT IF EXISTS tasks_related_account_id_fkey;
ALTER TABLE IF EXISTS interactions DROP CONSTRAINT IF EXISTS interactions_account_id_fkey;
-- Note: scorecard_responses doesn't have a FK constraint, so no need to drop it

-- Step 2: Create a function to update account IDs and all references
CREATE OR REPLACE FUNCTION migrate_account_id(
  old_id text,
  new_id text
) RETURNS void AS $$
BEGIN
  -- Update all foreign key references
  UPDATE contacts SET account_id = new_id WHERE account_id = old_id;
  UPDATE estimates SET account_id = new_id WHERE account_id = old_id;
  UPDATE jobsites SET account_id = new_id WHERE account_id = old_id;
  UPDATE tasks SET related_account_id = new_id WHERE related_account_id = old_id;
  UPDATE interactions SET account_id = new_id WHERE account_id = old_id;
  UPDATE scorecard_responses SET account_id = new_id WHERE account_id = old_id;
  
  -- Finally, update the account ID itself
  UPDATE accounts SET id = new_id WHERE id = old_id;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Find accounts that need migration and update them
-- Only update accounts that:
-- 1. Have an lmn_crm_id
-- 2. Don't already have the correct ID format (lmn-account-{lmn_crm_id})
DO $$
DECLARE
  account_record RECORD;
  new_id text;
  conflict_count integer;
BEGIN
  FOR account_record IN 
    SELECT id, lmn_crm_id 
    FROM accounts 
    WHERE lmn_crm_id IS NOT NULL 
      AND lmn_crm_id != ''
      AND id != 'lmn-account-' || lmn_crm_id
  LOOP
    new_id := 'lmn-account-' || account_record.lmn_crm_id;
    
    -- Check if the new ID already exists (could be a duplicate or already migrated)
    SELECT COUNT(*) INTO conflict_count
    FROM accounts
    WHERE id = new_id;
    
    IF conflict_count > 0 THEN
      -- New ID already exists - this could mean:
      -- 1. Another account already has this ID (duplicate lmn_crm_id - shouldn't happen due to UNIQUE constraint)
      -- 2. The account was already migrated
      RAISE NOTICE 'Skipping account %: new ID % already exists', account_record.id, new_id;
    ELSE
      -- Safe to migrate
      RAISE NOTICE 'Migrating account % to %', account_record.id, new_id;
      PERFORM migrate_account_id(account_record.id, new_id);
    END IF;
  END LOOP;
END $$;

-- Step 4: Drop the temporary function
DROP FUNCTION IF EXISTS migrate_account_id(text, text);

-- Step 5: Re-add foreign key constraints
ALTER TABLE contacts 
  ADD CONSTRAINT contacts_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE estimates 
  ADD CONSTRAINT estimates_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE jobsites 
  ADD CONSTRAINT jobsites_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE tasks 
  ADD CONSTRAINT tasks_related_account_id_fkey 
  FOREIGN KEY (related_account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE interactions 
  ADD CONSTRAINT interactions_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Note: scorecard_responses doesn't have a FK constraint by design

-- Step 6: Verify the migration
-- Check how many accounts were migrated
DO $$
DECLARE
  migrated_count integer;
  needs_migration_count integer;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM accounts
  WHERE lmn_crm_id IS NOT NULL 
    AND lmn_crm_id != ''
    AND id = 'lmn-account-' || lmn_crm_id;
  
  SELECT COUNT(*) INTO needs_migration_count
  FROM accounts
  WHERE lmn_crm_id IS NOT NULL 
    AND lmn_crm_id != ''
    AND id != 'lmn-account-' || lmn_crm_id;
  
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Accounts with correct ID format: %', migrated_count;
  RAISE NOTICE 'Accounts still needing migration: %', needs_migration_count;
END $$;

-- Verification query (run separately to see details):
-- SELECT id, lmn_crm_id, 
--        CASE 
--          WHEN lmn_crm_id IS NOT NULL AND lmn_crm_id != '' 
--            AND id = 'lmn-account-' || lmn_crm_id 
--          THEN '✓ MIGRATED' 
--          WHEN lmn_crm_id IS NOT NULL AND lmn_crm_id != '' 
--            AND id != 'lmn-account-' || lmn_crm_id 
--          THEN '⚠ NEEDS MIGRATION' 
--          ELSE '○ NO LMN ID' 
--        END as status
-- FROM accounts
-- ORDER BY status, lmn_crm_id;

-- Done! All accounts with lmn_crm_id should now have IDs in the format lmn-account-{lmn_crm_id}

