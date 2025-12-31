# Production Supabase Migration Scripts - Execution Order

Run these scripts in Supabase SQL Editor in the exact order listed below.

## 1. Notification System Migration (if not already done)

### Step 1.1: Create user_notification_states table
**File:** `create_user_notification_states_table.sql`
- Creates table for bulk notifications (JSONB format)
- Sets up RLS policies
- Creates indexes

### Step 1.2: Migrate existing notifications
**File:** `migrate_notifications_to_jsonb.sql`
- Migrates existing bulk notifications to JSONB format
- Deletes migrated notifications from notifications table
- **Note:** This is safe to run multiple times (idempotent)

### Step 1.3: Add unique constraint for task notifications
**File:** `add_notification_unique_constraint.sql`
- Prevents duplicate task notifications
- Cleans up existing duplicates
- Creates partial unique index

### Step 1.4: Add notification update triggers
**File:** `add_notification_update_triggers.sql`
- Creates triggers for real-time notification updates
- Updates notifications when accounts/interactions change
- **Note:** This is safe to run multiple times (idempotent)

### Step 1.5: Fix RLS policies (if needed)
**File:** `fix_user_notification_states_rls.sql`
- Fixes any RLS policy issues
- **Note:** Check if this file exists and is needed

## 2. Yearly Official Data Table (NEW - Required for Reports)

### Step 2.1: Create yearly_official_estimates table
**File:** `create_yearly_official_data_table.sql`
- Creates table for yearly official LMN data
- Sets up indexes and RLS policies
- Creates update trigger
- **This is required for the Reports page yearly data feature**

## 3. Account Features

### Step 3.1: Add notes to accounts
**File:** `add_notes_to_accounts.sql`
- Adds notes column to accounts table
- **Note:** Check if this already exists

### Step 3.2: Add account attachments schema
**File:** `add_account_attachments_schema.sql`
- Creates account_attachments table
- Sets up storage bucket
- **Note:** Check if this already exists

## 4. Estimate Features

### Step 4.1: Add CRM tags to estimates
**File:** `add_crm_tags_to_estimates.sql`
- Adds crm_tags column to estimates table
- **Note:** Check if this already exists

## 5. Verification (Optional but Recommended)

### Step 5.1: Verify notification migration
**File:** `verify_notification_migration.sql`
- Verifies that notifications were migrated correctly
- Shows counts and statistics

---

## Quick Checklist

Before running, check if these tables already exist:
- [ ] `user_notification_states` - If exists, skip Step 1.1
- [ ] `yearly_official_estimates` - If exists, skip Step 2.1
- [ ] `account_attachments` - If exists, skip Step 3.2
- [ ] `accounts.notes` column - If exists, skip Step 3.1
- [ ] `estimates.crm_tags` column - If exists, skip Step 4.1

## Important Notes

1. **Backup First**: Always backup your database before running migrations
2. **Test in Dev**: Test these scripts in a dev environment first if possible
3. **Run During Low Traffic**: Run migrations during low-traffic periods
4. **Monitor**: Watch for errors and check logs after each step
5. **Idempotent**: Most scripts are idempotent (safe to run multiple times), but verify first

## After Migration

1. Import yearly official data using: `import-yearly-data-to-supabase.js`
2. Verify the Reports page works correctly
3. Check that notifications are working properly

