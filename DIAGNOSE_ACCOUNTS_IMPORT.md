# Diagnose Accounts Import Failure

## Current Situation
- Accounts import is failing with 500 error
- Sample account data looks correct: `id: "lmn-account-2335377"`
- Foreign key violations on contacts/estimates/jobsites (because accounts failed first)

## Steps to Diagnose

### 1. Check Accounts Table Schema
Run this in Supabase SQL Editor:

```sql
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name = 'id';
```

**Expected:** `data_type = 'text'` or `'character varying'`, `column_default = NULL`

**If it shows `'uuid'`:** Run `migrate_to_text_ids.sql`

### 2. Check Vercel Function Logs
1. Go to Vercel Dashboard
2. Select your project (lecrm-dev)
3. Go to **Functions** tab
4. Click on `api/data/accounts`
5. Check the **Logs** tab
6. Look for error messages during the import attempt

The logs should show:
- "Bulk insert error:" with details
- "Error details:" with JSON
- "Sample account data:" showing what was being inserted

### 3. Test Manual Insert
Run this in Supabase SQL Editor to test if accounts can be inserted manually:

```sql
INSERT INTO accounts (
  id,
  lmn_crm_id,
  name,
  account_type,
  status,
  created_at,
  updated_at
) VALUES (
  'lmn-account-TEST123',
  'TEST123',
  'Test Account',
  'Commercial',
  'active',
  NOW(),
  NOW()
);
```

**If this fails:** The error message will tell you what's wrong (UUID type, constraint violation, etc.)

**If this succeeds:** The issue is with the API or data format, not the table schema

### 4. Check Browser Console
After trying the import again, look for:
- `📤 Starting accounts import:` (should appear)
- `📥 Accounts API response status:` (should show 500)
- `❌ Accounts API error response:` (should show the actual error)

If these don't appear, the new code hasn't deployed yet - wait for Vercel to rebuild.

### 5. Common Issues & Fixes

**Issue:** `data_type = 'uuid'` for accounts.id
**Fix:** Run `migrate_to_text_ids.sql`

**Issue:** `invalid input syntax for type uuid: "lmn-account-XXXXX"`
**Fix:** Table still has UUID column - run migration

**Issue:** Foreign key constraint violation
**Fix:** Accounts aren't being inserted - fix accounts import first

**Issue:** Column doesn't exist
**Fix:** Table schema is outdated - check SUPABASE_SCHEMA.sql

## Next Steps
1. Run the schema check query
2. Check Vercel function logs
3. Try manual insert test
4. Share the results

