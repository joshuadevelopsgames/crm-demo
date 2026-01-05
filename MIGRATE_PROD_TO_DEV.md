# Migrate Production Data to Dev Database

This guide explains how to copy all data from your production Supabase database to your dev database.

## Prerequisites

1. **Both Supabase projects set up:**
   - Production Supabase project (source)
   - Dev Supabase project (destination)

2. **Service role keys for both projects:**
   - Prod service role key (from prod project settings)
   - Dev service role key (from dev project settings)

## Step 1: Set Environment Variables

Make sure your `.env` file has these variables:

```bash
# Production Supabase (source)
PROD_SUPABASE_URL="https://your-prod-project.supabase.co"
PROD_SUPABASE_SERVICE_ROLE_KEY="your-prod-service-role-key"

# Dev Supabase (destination)
DEV_SUPABASE_URL="https://your-dev-project.supabase.co"
DEV_SUPABASE_SERVICE_ROLE_KEY="your-dev-service-role-key"
```

### Getting Service Role Keys

1. Go to Supabase Dashboard
2. Select your project (prod or dev)
3. Go to **Settings** → **API**
4. Copy the **Service Role Key** (keep this secret!)

## Step 2: Run the Migration Script

Run the migration script:

```bash
node migrate-data-prod-to-dev.js
```

The script will:
1. ✅ Connect to both prod and dev Supabase
2. ✅ Show a 5-second countdown before starting
3. ✅ Migrate tables in the correct order (respecting foreign keys)
4. ✅ Clear existing data in dev before inserting (to ensure clean copy)
5. ✅ Show progress for each table
6. ✅ Verify row counts match
7. ✅ Provide a summary at the end

## What Gets Migrated

✅ **All data from these tables:**
- Accounts, Contacts, Estimates, Jobsites
- Interactions, Tasks, Task Attachments, Task Comments
- Sequences, Sequence Enrollments
- Scorecards, Scorecard Templates
- User Permissions, User Notification States
- Notifications, Notification Snoozes
- Account Attachments
- Yearly Official Estimates

❌ **What does NOT get migrated:**
- Auth users (handled separately by Supabase)
- Storage files (use Supabase Dashboard → Storage → Transfer)
- Profiles (requires auth.users to exist first - will be auto-created on sign-in)
- System tables

## Migration Order

Tables are migrated in this order to respect foreign key relationships:

1. **accounts** (no dependencies)
2. **contacts** (depends on accounts)
3. **interactions** (depends on accounts)
4. **jobsites** (depends on accounts)
5. **sequence_enrollments** (depends on accounts)
6. **scorecard_responses** (depends on accounts)
7. **account_attachments** (depends on accounts)
8. **estimates** (depends on accounts, contacts)
9. **tasks** (depends on accounts, contacts)
10. **task_attachments** (depends on tasks)
11. **task_comments** (depends on tasks)
12. **user_permissions** (depends on profiles)
13. **user_notification_states** (depends on profiles)
14. **notifications** (depends on accounts)
15. **notification_snoozes** (depends on accounts)
16. **sequences** (independent)
17. **scorecard_templates** (independent)
18. **yearly_official_estimates** (independent)

## Important Notes

⚠️ **This script will DELETE all existing data in dev before inserting!**

- The script clears each table in dev before inserting prod data
- This ensures a clean copy of production data
- If you want to merge data instead, you'll need to modify the script

⚠️ **Profiles are skipped**

- Profiles require `auth.users` to exist first
- They will be auto-created when users sign in to dev
- If you need to copy profile data, use `migrate-profiles-prod-to-dev.js` (after users sign in)

## Troubleshooting

### Error: "relation does not exist"

**Solution:** Make sure the dev database schema matches production. Run any necessary migrations in dev first.

### Error: "duplicate key value violates unique constraint"

**Solution:** The script clears existing data before inserting. If you see this, the table might have been partially migrated. Re-run the script (it's idempotent).

### Error: "foreign key constraint violation"

**Solution:** This shouldn't happen if tables are migrated in order. Check that:
1. All tables exist in dev
2. Foreign key relationships are correct
3. Parent records exist before child records

### Error: "rate limit exceeded"

**Solution:** The script includes delays between batches. If you still hit limits:
1. Wait a few minutes
2. Re-run the script (it will skip already-migrated tables)
3. Or migrate tables individually by modifying the script

### Partial Migration

If migration fails partway through:
1. Check which tables succeeded (see summary)
2. Re-run the script - it will clear and re-insert all tables
3. Or manually migrate remaining tables

## Verifying Migration

After migration completes:

1. **Check row counts:**
   ```sql
   -- In dev Supabase SQL Editor
   SELECT 
     'accounts' as table_name, COUNT(*) as count FROM accounts
   UNION ALL
   SELECT 'contacts', COUNT(*) FROM contacts
   UNION ALL
   SELECT 'estimates', COUNT(*) FROM estimates
   -- ... etc
   ```

2. **Compare counts between prod and dev:**
   - Prod: Check Table Editor in prod dashboard
   - Dev: Check Table Editor in dev dashboard
   - Counts should match

3. **Test the application:**
   - Log into dev environment
   - Verify data appears correctly
   - Test key features (accounts, estimates, reports, etc.)

## After Migration

1. ✅ **Test the dev application** thoroughly
2. ✅ **Verify reports** work correctly
3. ✅ **Check notifications** are functioning
4. ✅ **Test user authentication** (profiles will be auto-created when users sign in)


