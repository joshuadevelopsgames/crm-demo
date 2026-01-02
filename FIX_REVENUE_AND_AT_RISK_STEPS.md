# Fix Revenue and At-Risk Accounts

## Problem
- Accounts don't show revenue
- No at-risk accounts are showing
- BUT individual account pages show estimates (won and lost) in the estimates tab

## Root Cause
If estimates show as "WON" in the EstimatesTab, then `status = 'won'` is correct. The issue is likely:
1. **Missing `contract_end` dates** - This prevents at-risk account calculation
2. **Revenue calculation may not be running** - Or estimates don't have `total_price_with_tax` values

## Diagnostic Steps

### Step 1: Check Estimate Statuses
Run `CHECK_ESTIMATE_STATUS_IN_DB.sql` in Supabase SQL Editor to see:
- What status values exist in the database
- How many are marked as 'won' (exact match)
- How many have `contract_end` dates

### Step 2: Check if Estimates Have Prices
Run this query:
```sql
SELECT 
  COUNT(*) as total_estimates,
  COUNT(*) FILTER (WHERE status = 'won') as won_estimates,
  COUNT(*) FILTER (WHERE status = 'won' AND total_price_with_tax IS NOT NULL) as won_with_price,
  COUNT(*) FILTER (WHERE status = 'won' AND total_price_with_tax > 0) as won_with_positive_price,
  AVG(total_price_with_tax) FILTER (WHERE status = 'won') as avg_won_price
FROM estimates;
```

### Step 3: Check Accounts with Won Estimates
Run this query:
```sql
SELECT 
  a.id,
  a.name,
  a.revenue_segment,
  COUNT(e.id) as total_estimates,
  COUNT(e.id) FILTER (WHERE e.status = 'won') as won_estimates,
  COUNT(e.id) FILTER (WHERE e.status = 'won' AND e.contract_end IS NOT NULL) as won_with_contract_end,
  SUM(e.total_price_with_tax) FILTER (WHERE e.status = 'won') as total_revenue
FROM accounts a
LEFT JOIN estimates e ON e.account_id = a.id
WHERE a.archived = false
GROUP BY a.id, a.name, a.revenue_segment
HAVING COUNT(e.id) FILTER (WHERE e.status = 'won') > 0
ORDER BY won_estimates DESC
LIMIT 20;
```

## Fix Steps

### Fix 1: Update Estimate Statuses (if needed)
If the diagnostic shows estimates with status values like "Email Contract Award", "Work Complete", etc. (not 'won'), run:
```sql
-- Run FIX_EXISTING_WON_ESTIMATES.sql
```

### Fix 2: Backfill Contract End Dates
Run the Node.js script to backfill missing `contract_end` dates from your Excel file:
```bash
node fix-contract-end-import.js
```

This script will:
- Read `Estimates List.xlsx` from your Downloads folder
- Find won estimates with `contract_end` dates
- Update the database with the missing dates

### Fix 3: Recalculate Revenue Segments
After fixing the data, go to the Accounts page and click "Recalculate Revenue Segments" button. This will:
- Calculate revenue from won estimates for each account
- Assign revenue segments (A, B, C, D) based on revenue percentages
- Update all accounts in the database

### Fix 4: Verify At-Risk Accounts
After backfilling `contract_end` dates, at-risk accounts should appear automatically. The Dashboard calculates at-risk accounts based on:
- Won estimates with `contract_end` dates
- Renewal dates within 180 days (or past due)

## Expected Results

After fixes:
- **Revenue**: Accounts with won estimates should show revenue segments (A, B, C, or D)
- **At-Risk Accounts**: Accounts with won estimates and `contract_end` dates within 180 days should appear in the Dashboard

## If Still Not Working

1. **Check browser console** for errors
2. **Check Network tab** to see if API calls are returning data
3. **Verify estimates are linked to accounts** - Check that `estimates.account_id` matches `accounts.id`
4. **Check if revenue calculation is running** - Look for "Recalculate Revenue Segments" button in Accounts page

