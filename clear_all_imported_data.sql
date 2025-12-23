-- Script to clear all imported data for fresh re-import
-- This will delete accounts, contacts, estimates, and jobsites
-- It preserves system data like users, tasks, interactions, scorecards

-- WARNING: This will delete ALL imported data. Make sure you have backups if needed.

-- ============================================
-- STEP 1: Check for EST5574448 before deletion
-- ============================================
SELECT 
  'EST5574448 Check Before Deletion' as check_type,
  COUNT(*) as found_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ EST5574448 EXISTS in database'
    ELSE '❌ EST5574448 NOT FOUND in database'
  END as status
FROM estimates
WHERE lmn_estimate_id = 'EST5574448' OR estimate_number = 'EST5574448';

-- Show the estimate details if it exists
SELECT 
  'EST5574448 Details' as info_type,
  id,
  lmn_estimate_id,
  estimate_number,
  contact_name,
  account_id,
  total_price_with_tax,
  status,
  created_at
FROM estimates
WHERE lmn_estimate_id = 'EST5574448' OR estimate_number = 'EST5574448';

-- ============================================
-- STEP 2: Delete all imported data
-- ============================================
BEGIN;

-- Delete in order to respect foreign key constraints

-- 1. Delete estimates first (they reference accounts and contacts)
DELETE FROM estimates;

-- 2. Delete jobsites (they reference accounts and contacts)
DELETE FROM jobsites;

-- 3. Delete contacts (they reference accounts)
DELETE FROM contacts;

-- 4. Delete accounts (no dependencies from other tables we're keeping)
DELETE FROM accounts;

COMMIT;

-- ============================================
-- STEP 3: Verify deletion
-- ============================================
SELECT 
  'Final Counts After Deletion' as check_type,
  (SELECT COUNT(*) FROM accounts) as accounts_count,
  (SELECT COUNT(*) FROM contacts) as contacts_count,
  (SELECT COUNT(*) FROM estimates) as estimates_count,
  (SELECT COUNT(*) FROM jobsites) as jobsites_count;

-- ============================================
-- NEXT STEPS:
-- 1. Go to your LECRM app
-- 2. Open the Import dialog
-- 3. Upload all 4 files (Contacts Export, Leads List, Estimates List, Jobsite Export)
-- 4. After import, check if EST5574448 appears in the validation results
-- 5. If it appears, it's in your import sheets
-- 6. If it doesn't appear, it was orphaned data from a previous import
-- ============================================
