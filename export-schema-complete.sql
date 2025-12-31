-- Complete Schema Export for LECRM Production
-- This file contains all table definitions, indexes, triggers, and RLS policies
-- Run this in your new Supabase production project's SQL Editor

-- ============================================
-- STEP 1: Enable required extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- STEP 2: Create all tables (in dependency order)
-- ============================================

-- Run these SQL files in order:
-- 1. SUPABASE_SCHEMA.sql (main tables)
-- 2. add_profiles_table.sql
-- 3. add_user_roles.sql
-- 4. create_user_permissions_table.sql
-- 5. create_tasks_table.sql
-- 6. add_recurring_tasks_schema.sql
-- 7. add_task_comments_schema.sql
-- 8. add_task_attachments_schema.sql
-- 9. add_task_blocking_schema.sql
-- 10. create_sequences_table.sql
-- 11. create_sequence_enrollments_table.sql
-- 12. create_interactions_table.sql
-- 13. create_notifications_table.sql
-- 14. create_notification_snoozes_table.sql
-- 15. create_scorecard_templates_table.sql
-- 16. create_scorecard_responses_table.sql
-- 17. add_account_attachments_schema.sql
-- 18. add_notes_to_accounts.sql

-- ============================================
-- STEP 3: Add any missing columns
-- ============================================

-- Run these if needed:
-- add_icp_status_to_accounts.sql
-- add_snoozed_until_to_accounts.sql
-- add_phone_to_profiles.sql
-- add_template_version_to_responses.sql
-- alter_scorecard_responses_account_id.sql

-- ============================================
-- STEP 4: Create storage buckets
-- ============================================

-- Create these buckets in Supabase Dashboard → Storage:
-- 1. task-attachments (private, 10MB limit)
-- 2. account-attachments (private, 10MB limit)

-- Then run:
-- create_task_attachments_bucket.sql (for RLS policies)
-- create_account_attachments_bucket.sql (for RLS policies)

-- ============================================
-- STEP 5: Set up RLS policies and triggers
-- ============================================

-- Run these if needed:
-- fix_profiles_rls_for_admin.sql
-- FIX_PROFILE_TRIGGER.sql

-- ============================================
-- STEP 6: Create system admin user
-- ============================================

-- Run:
-- SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql
-- (This will create the admin user and set up permissions)

-- ============================================
-- NOTES:
-- ============================================
-- 1. This is a reference file - you need to run the actual SQL files listed above
-- 2. Run them in the order specified
-- 3. Some files may have IF NOT EXISTS checks, so running them multiple times is safe
-- 4. After creating tables, verify they exist in Supabase Dashboard → Table Editor
-- 5. Make sure to set up storage buckets manually in the Dashboard
-- 6. Update your Vercel environment variables to point to the new production Supabase project

