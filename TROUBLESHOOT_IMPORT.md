# Troubleshooting Import Errors

## Current Issue: Accounts Import Failing (500 Error)

The accounts import is failing first, which causes all other imports to fail with foreign key constraint violations.

## Step 1: Verify Table Schemas

Run these SQL queries in Supabase SQL Editor to verify your table schemas:

### Check Accounts Table
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name = 'id';
```

**Expected:** `data_type = 'text'`, `column_default = NULL`

### Check Estimates Table
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'estimates'
  AND column_name = 'id';
```

**Expected:** `data_type = 'text'`, `column_default = NULL`

### Check Jobsites Table
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'jobsites'
  AND column_name = 'id';
```

**Expected:** `data_type = 'text'`, `column_default = NULL`

## Step 2: Run Migrations (If Needed)

If any tables still show `data_type = 'uuid'`, run the appropriate migration:

### For Accounts & Contacts (if needed):
- Run `migrate_to_text_ids.sql`

### For Estimates & Jobsites:
- Run `COMPLETE_MIGRATION_TO_TEXT_IDS.sql` (or `migrate_estimates_jobsites_to_text_ids.sql`)

## Step 3: Check Server Logs

After the improved error logging, check your Vercel function logs to see the actual error:

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Functions** → **api/data/accounts**
4. Check the **Logs** tab
5. Look for detailed error messages

The logs will now show:
- Full error details
- Sample account data that failed
- Error stack traces

## Step 4: Common Issues & Fixes

### Issue 1: Accounts table still has UUID id
**Fix:** Run `migrate_to_text_ids.sql`

### Issue 2: Estimates/Jobsites still have UUID id
**Fix:** Run `COMPLETE_MIGRATION_TO_TEXT_IDS.sql`

### Issue 3: Foreign key constraint violations
**Cause:** Accounts failed to import, so contacts/estimates/jobsites can't reference them
**Fix:** Fix accounts import first, then retry

### Issue 4: Invalid data format
**Check:** Look at the sample account data in logs
**Fix:** Verify the parser is generating correct ID formats like `lmn-account-6857868`

## Step 5: Test Import Again

After running migrations and checking logs:

1. Clear all data (optional): Run `clear_all_imported_data.sql`
2. Try import again
3. Check the browser console for detailed error messages
4. Check Vercel function logs for server-side errors

## Quick Verification Query

Run this to check all import-related tables at once:

```sql
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name IN ('accounts', 'contacts', 'estimates', 'jobsites')
  AND column_name = 'id'
ORDER BY table_name;
```

All should show `data_type = 'text'` and `column_default = NULL`.

