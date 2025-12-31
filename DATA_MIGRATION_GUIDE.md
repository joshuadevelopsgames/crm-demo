# Data Migration Guide: Dev → Production

This guide explains how to migrate all data from your dev Supabase instance to production.

## Prerequisites

1. **Both Supabase projects set up:**
   - Dev Supabase project (source)
   - Production Supabase project (destination)

2. **Service role keys for both projects:**
   - Dev service role key (from dev project settings)
   - Prod service role key (from prod project settings)

3. **Production schema created:**
   - Run `PRODUCTION_MIGRATION_COMPLETE.sql` in production first
   - This ensures all tables exist before migrating data

## Step 1: Set Environment Variables

Create a `.env` file or export these variables:

```bash
# Dev Supabase (source)
export DEV_SUPABASE_URL="https://your-dev-project.supabase.co"
export DEV_SUPABASE_SERVICE_ROLE_KEY="your-dev-service-role-key"

# Prod Supabase (destination)
export PROD_SUPABASE_URL="https://your-prod-project.supabase.co"
export PROD_SUPABASE_SERVICE_ROLE_KEY="your-prod-service-role-key"
```

### Getting Service Role Keys

1. Go to Supabase Dashboard
2. Select your project (dev or prod)
3. Go to **Settings** → **API**
4. Copy the **Service Role Key** (keep this secret!)

## Step 2: Run Schema Migration in Production

**IMPORTANT:** Run this FIRST in production before migrating data:

1. Go to Production Supabase Dashboard
2. Open **SQL Editor**
3. Copy and paste the entire `PRODUCTION_MIGRATION_COMPLETE.sql` file
4. Run it
5. Verify all tables were created (check the verification output)

## Step 3: Run Data Migration Script

```bash
node migrate-data-dev-to-prod.js
```

The script will:
1. ✅ Connect to both dev and prod Supabase
2. ✅ Show a 5-second countdown before starting
3. ✅ Migrate tables in the correct order (respecting foreign keys)
4. ✅ Show progress for each table
5. ✅ Verify row counts match
6. ✅ Provide a summary at the end

## Migration Order

Tables are migrated in this order to respect foreign key relationships:

1. **accounts** (no dependencies)
2. **profiles** (no dependencies)
3. **contacts** (depends on accounts)
4. **interactions** (depends on accounts)
5. **jobsites** (depends on accounts)
6. **sequence_enrollments** (depends on accounts)
7. **scorecard_responses** (depends on accounts)
8. **account_attachments** (depends on accounts)
9. **estimates** (depends on accounts, contacts)
10. **tasks** (depends on accounts, contacts)
11. **task_attachments** (depends on tasks)
12. **task_comments** (depends on tasks)
13. **user_permissions** (depends on profiles)
14. **user_notification_states** (depends on profiles)
15. **notifications** (depends on accounts)
16. **notification_snoozes** (depends on accounts)
17. **sequences** (independent)
18. **scorecard_templates** (independent)
19. **yearly_official_estimates** (independent)

## What Gets Migrated

✅ **All data from these tables:**
- Accounts, Contacts, Estimates, Jobsites
- Interactions, Tasks, Task Attachments, Task Comments
- Sequences, Sequence Enrollments
- Scorecards, Scorecard Templates
- Profiles, User Permissions
- Notifications, Notification Snoozes, User Notification States
- Account Attachments
- Yearly Official Estimates

❌ **What does NOT get migrated:**
- Auth users (handled separately by Supabase)
- Storage files (use Supabase Dashboard → Storage → Transfer)
- System tables

## Troubleshooting

### Error: "relation does not exist"

**Solution:** Run `PRODUCTION_MIGRATION_COMPLETE.sql` in production first.

### Error: "duplicate key value violates unique constraint"

**Solution:** The script clears existing data before inserting. If you see this, the table might have been partially migrated. Re-run the script (it's idempotent).

### Error: "foreign key constraint violation"

**Solution:** This shouldn't happen if tables are migrated in order. Check that:
1. All tables exist in production
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
   -- In production Supabase SQL Editor
   SELECT 
     'accounts' as table_name, COUNT(*) as count FROM accounts
   UNION ALL
   SELECT 'contacts', COUNT(*) FROM contacts
   UNION ALL
   SELECT 'estimates', COUNT(*) FROM estimates
   -- ... etc
   ```

2. **Compare counts between dev and prod:**
   - Dev: Check Table Editor in dev dashboard
   - Prod: Check Table Editor in prod dashboard
   - Counts should match

3. **Test the application:**
   - Log into production
   - Verify data appears correctly
   - Test key features (accounts, estimates, reports, etc.)

## Alternative: Manual Migration via Supabase Dashboard

If you prefer a manual approach:

1. **Export from Dev:**
   - Go to dev Supabase Dashboard
   - Table Editor → Select table → Export as CSV
   - Repeat for each table

2. **Import to Prod:**
   - Go to prod Supabase Dashboard
   - Table Editor → Import CSV
   - Import in the same order as the migration script

**Note:** Manual migration is slower and more error-prone. Use the script for best results.

## After Migration

1. ✅ **Update environment variables** in your production app (Vercel, etc.)
2. ✅ **Test the application** thoroughly
3. ✅ **Verify reports** work correctly
4. ✅ **Check notifications** are functioning
5. ✅ **Test user authentication** (profiles should be created automatically)

## Next Steps

- Import yearly official data: `node import-yearly-data-to-supabase.js`
- Set up storage buckets if needed
- Configure any production-specific settings

