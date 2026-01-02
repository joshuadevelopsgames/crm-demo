# Fix All Data Issues - Step by Step Guide

## Root Cause
Your estimates in the database are not marked as `status = 'won'`, which causes:
1. **No renewal dates** → No at-risk accounts
2. **No revenue calculation** → No revenue segments (A/B/C/D)
3. **Notifications filtered incorrectly** → 0 notifications showing

## Step 1: Diagnose the Problem

Run this SQL script in Supabase SQL Editor to see what's wrong:

```sql
-- See DIAGNOSE_DATA_ISSUES.sql for full diagnostic queries
```

Or run this quick check:

```sql
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as with_contract_end
FROM estimates
GROUP BY status
ORDER BY count DESC;
```

**Expected Result**: You should see many estimates with statuses like "Contract Signed", "Work Complete", etc. that should be `'won'` but aren't.

## Step 2: Fix the Estimates

Run the `FIX_EXISTING_WON_ESTIMATES.sql` script in Supabase SQL Editor.

This will:
- Update all estimates with "won" statuses (Contract Signed, Work Complete, etc.) to `status = 'won'`
- Only updates estimates that aren't already `'won'`
- Shows you how many were updated

**Important**: After running this, you should see:
- Many estimates with `status = 'won'`
- Many of those with `contract_end` dates

## Step 3: Verify the Fix

Run this to check:

```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'won') as won_count,
  COUNT(*) FILTER (WHERE status = 'won' AND contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) as total_estimates
FROM estimates;
```

**Expected Result**: 
- `won_count` should be > 0 (probably hundreds or thousands)
- `won_with_contract_end` should be > 0 (these are needed for at-risk accounts)

## Step 4: Refresh the Application

After fixing the estimates:

1. **Hard refresh your browser** (Cmd+Shift+R or Ctrl+Shift+R)
2. **Wait a few seconds** for the app to recalculate:
   - Renewal dates
   - At-risk accounts
   - Revenue segments
   - Notifications

3. **Check the console logs** - you should see:
   - `accountsWithWonEstimates: [number > 0]`
   - `accountsWithRenewalDates: [number > 0]`
   - `atRiskRenewals: [array with accounts]`
   - `🔔 After filtering: [number > 0] renewal_reminder, [number > 0] neglected_account notifications shown`

## Step 5: What Should Work After Fix

✅ **At-Risk Accounts**: Should show accounts with renewals within 180 days  
✅ **Notifications**: Should show renewal reminders and neglected account notifications  
✅ **Revenue Segments**: Accounts should have A/B/C/D segments assigned  
✅ **Revenue Calculation**: Revenue should be calculated from won estimates

## Troubleshooting

### If notifications still show 0:

1. Check if notifications are being snoozed:
   ```sql
   SELECT * FROM notification_snoozes 
   WHERE snoozed_until > NOW();
   ```

2. Check if bulk notifications exist:
   ```sql
   SELECT * FROM user_notification_states 
   WHERE user_id = 'your-user-id';
   ```

3. Check browser console for filtering logs - the code now logs why notifications are filtered

### If at-risk accounts still show 0:

1. Check if accounts have renewal dates:
   ```sql
   SELECT COUNT(*) FROM accounts 
   WHERE calculated_renewal_date IS NOT NULL 
   AND calculated_renewal_date <= CURRENT_DATE + INTERVAL '180 days'
   AND archived = false;
   ```

2. The renewal dates are calculated from estimates, so make sure:
   - Estimates are marked as `'won'`
   - Estimates have `contract_end` dates
   - Accounts are linked to those estimates via `account_id`

### If revenue segments aren't showing:

Revenue segments are calculated from won estimates. After fixing estimates:
1. The segments should auto-calculate on the next page load
2. Check Accounts page - accounts should have `revenue_segment` values (A, B, C, or D)

## Code Changes Made

I've updated the notification filtering logic to:
- Always show renewal reminders (server is source of truth)
- Better logging to show why notifications are filtered
- More lenient filtering when data hasn't loaded yet

The main fix is running the SQL script to update estimate statuses.

