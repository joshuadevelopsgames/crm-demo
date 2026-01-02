# Fix Revenue and At-Risk Accounts

## Root Cause
Your estimates in the database are not marked as `status = 'won'`, which causes:
1. **No revenue calculation** - Revenue is calculated from won estimates only
2. **No at-risk accounts** - At-risk accounts are calculated from renewal dates, which come from won estimates with `contract_end` dates

## The Problem

From your console logs:
- `accountsWithWonEstimates: 0` - No estimates are marked as 'won'
- `accountsWithRenewalDates: 0` - No renewal dates because no won estimates
- `estimatesWithContractEnd: 0` - No contract_end dates (but this might be because estimates aren't won)

## The Solution

### Step 1: Check Current Status Values

Run `CHECK_ESTIMATE_STATUSES.sql` in Supabase SQL Editor to see:
- What status values exist in your database
- How many estimates should be 'won' but aren't
- Sample estimates that need to be updated

### Step 2: Fix the Estimates

Run `FIX_EXISTING_WON_ESTIMATES.sql` in Supabase SQL Editor. This will:
- Update all estimates with "won" statuses (Contract Signed, Work Complete, etc.) to `status = 'won'`
- Only updates estimates that aren't already `'won'`
- Shows you how many were updated

**Important**: After running this, you should see:
- Many estimates with `status = 'won'`
- Many of those with `contract_end` dates

### Step 3: Verify the Fix

After running the fix script, check:
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

### Step 4: Refresh the Application

After fixing the estimates:

1. **Hard refresh your browser** (Cmd+Shift+R or Ctrl+Shift+R)
2. **Wait a few seconds** for the app to recalculate:
   - Revenue from won estimates
   - Renewal dates from won estimates
   - At-risk accounts (renewal within 180 days)
   - Revenue segments (A/B/C/D)

3. **Check the console logs** - you should see:
   - `accountsWithWonEstimates: [number > 0]`
   - `accountsWithRenewalDates: [number > 0]`
   - `atRiskRenewals: [array with accounts]`
   - Revenue showing in the Accounts page

## How Revenue Works

Revenue is calculated from:
- **Won estimates** only (status = 'won')
- **Current year** only (estimates that apply to the current year)
- **Annualized** for multi-year contracts (divided by number of years)

If no estimates are marked as 'won', revenue will be 0.

## How At-Risk Accounts Work

At-risk accounts are calculated from:
- **Won estimates** with `contract_end` dates
- **Latest contract_end date** becomes the renewal date
- **Within 180 days** or **past due** = at-risk

If no estimates are marked as 'won', there are no renewal dates, so no at-risk accounts.

## Troubleshooting

### If revenue still shows 0 after fixing estimates:

1. Check if estimates have `contract_end` dates:
   ```sql
   SELECT COUNT(*) FROM estimates 
   WHERE status = 'won' AND contract_end IS NOT NULL;
   ```

2. Check if estimates have price values:
   ```sql
   SELECT COUNT(*) FROM estimates 
   WHERE status = 'won' 
   AND (total_price > 0 OR total_price_with_tax > 0);
   ```

3. Check the console logs for revenue calculation errors

### If at-risk accounts still show 0 after fixing estimates:

1. Check if won estimates have contract_end dates:
   ```sql
   SELECT COUNT(*) FROM estimates 
   WHERE status = 'won' AND contract_end IS NOT NULL;
   ```

2. Check if any renewal dates are within 180 days:
   ```sql
   SELECT COUNT(DISTINCT account_id) 
   FROM estimates 
   WHERE status = 'won' 
   AND contract_end IS NOT NULL
   AND contract_end <= CURRENT_DATE + INTERVAL '180 days';
   ```

3. The renewal dates are calculated from estimates, so make sure:
   - Estimates are marked as `'won'`
   - Estimates have `contract_end` dates
   - Accounts are linked to those estimates via `account_id`

## Code References

- Revenue calculation: `src/utils/revenueSegmentCalculator.js` - `calculateRevenueFromEstimates()`
- At-risk calculation: `src/utils/renewalDateCalculator.js` - `calculateRenewalDate()`
- Dashboard display: `src/pages/Dashboard.jsx` - `atRiskRenewals`
- Accounts revenue display: `src/pages/Accounts.jsx` - `getAccountRevenue()`

