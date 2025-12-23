# Clear All Imported Data for Fresh Re-Import

This guide will help you clear all imported data and perform a fresh re-import to test if EST5574448 appears.

## Option 1: Using SQL Script (Recommended - Easiest)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New Query"**

2. **Paste and run the SQL script:**
   - Open `clear_all_imported_data.sql` in this directory
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

3. **Verify deletion:**
   - The script will show final counts (should all be 0)
   - Or check manually in **Table Editor**

4. **Perform fresh import:**
   - Go to your LECRM app
   - Open the Import dialog
   - Upload all 4 files (Contacts Export, Leads List, Estimates List, Jobsite Export)
   - Complete the import

5. **Check for EST5574448:**
   - After import, search for EST5574448 in the estimates
   - Check the validation results to see if it appears

---

## Option 2: Using Node.js Script

1. **Set environment variables:**
   ```bash
   export SUPABASE_URL="your_supabase_url"
   export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
   ```

2. **Run the script:**
   ```bash
   node clear_imported_data_script.js
   ```

3. **The script will:**
   - Check for EST5574448 before deletion
   - Delete all imported data
   - Show final counts
   - Wait 5 seconds before deletion (you can cancel with Ctrl+C)

---

## What Gets Deleted

- ✅ All accounts
- ✅ All contacts  
- ✅ All estimates
- ✅ All jobsites

## What Gets Preserved

- ✅ User accounts and profiles
- ✅ Tasks
- ✅ Interactions
- ✅ ICP Scorecards
- ✅ All other system data

---

## After Clearing Data

1. **Perform a fresh import** with all 4 required files
2. **Check the validation results** - it will show:
   - New records being created
   - Any orphaned records (like EST5574448 if it's not in the sheets)
3. **Search for EST5574448** in the estimates list
4. **If EST5574448 appears:**
   - It means it's in your import sheets
   - The previous issue was likely a data inconsistency
5. **If EST5574448 doesn't appear:**
   - It's not in your import sheets
   - It was orphaned data from a previous import
   - You can safely delete it if it shows up as orphaned

---

## Notes

- ⚠️ **This action cannot be undone** - make sure you have backups if needed
- The SQL script uses transactions, so if something fails, it will roll back
- The Node.js script has a 5-second delay before deletion (you can cancel)
- Both methods preserve system data (users, tasks, interactions, scorecards)

