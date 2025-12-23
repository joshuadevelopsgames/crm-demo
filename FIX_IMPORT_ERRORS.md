# Fix Import Errors - UUID to Text ID Migration

## Problem

The import is failing with these errors:

1. **Estimates**: `"invalid input syntax for type uuid: \"lmn-estimate-EST1807324\""`
2. **Jobsites**: `"invalid input syntax for type uuid: \"lmn-jobsite-6539353\""`
3. **Contacts**: `"insert or update on table \"contacts\" violates foreign key constraint \"contacts_account_id_fkey\""` (because accounts failed first)

## Root Cause

The `estimates` and `jobsites` tables still have `id` columns as UUID type, but the parsers are generating text IDs like:
- `lmn-estimate-EST1807324`
- `lmn-jobsite-6539353`

## Solution

Run the migration script to change `estimates.id` and `jobsites.id` from UUID to text.

### Steps:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New Query"**

2. **Run the migration script:**
   - Open `migrate_estimates_jobsites_to_text_ids.sql` in this directory
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

3. **Verify the migration:**
   ```sql
   -- Check that id columns are now text
   SELECT 
     table_name,
     column_name,
     data_type
   FROM information_schema.columns
   WHERE table_name IN ('estimates', 'jobsites')
     AND column_name = 'id';
   ```
   
   Both should show `data_type = 'text'`

4. **Try the import again:**
   - Go to your LECRM app
   - Open the Import dialog
   - Upload all 4 files
   - The import should now work

## What the Migration Does

1. Drops foreign key constraints temporarily
2. Changes `estimates.id` from UUID to text
3. Changes `jobsites.id` from UUID to text
4. Removes the `gen_random_uuid()` default
5. Re-adds foreign key constraints

## Notes

- This migration is safe to run even if you have existing data
- Existing UUID IDs will be converted to text format
- New imports will use text IDs like `lmn-estimate-EST1807324`
- The migration preserves all existing data

