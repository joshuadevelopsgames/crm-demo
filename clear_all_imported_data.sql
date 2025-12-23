-- Script to clear all imported data for fresh re-import
-- This will delete accounts, contacts, estimates, and jobsites
-- It preserves system data like users, tasks, interactions, scorecards

-- WARNING: This will delete ALL imported data. Make sure you have backups if needed.

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

-- Reset any sequences if needed (optional, but good practice)
-- Note: We're using text IDs now, so sequences may not be relevant

COMMIT;

-- Verify deletion
SELECT 
  (SELECT COUNT(*) FROM accounts) as accounts_count,
  (SELECT COUNT(*) FROM contacts) as contacts_count,
  (SELECT COUNT(*) FROM estimates) as estimates_count,
  (SELECT COUNT(*) FROM jobsites) as jobsites_count;

