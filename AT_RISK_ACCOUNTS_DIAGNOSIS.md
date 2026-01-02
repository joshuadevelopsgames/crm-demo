# At-Risk Accounts Diagnosis Report

## Problem
**No at-risk accounts are displaying in the application.**

## Root Cause
All 231 won estimates in the database have `contract_end: null`.

The at-risk account logic requires:
1. Estimates with `status = 'won'`
2. Those estimates must have a `contract_end` date
3. The latest `contract_end` date becomes the renewal date
4. Accounts with renewals within 180 days (or past) are marked as `at_risk`

**Since no won estimates have `contract_end` dates, no accounts can be marked as at-risk.**

## Current Database State
- **Total estimates**: 1,000
- **Won estimates**: 231
- **Won estimates with `contract_end`**: 0 ❌
- **Won estimates without `contract_end`**: 231

## Sample Won Estimates (Missing contract_end)
```
- Estimate ID: lmn-estimate-EST3143942
  Account ID: lmn-account-8148368
  Status: won
  contract_start: null
  contract_end: null ❌
  estimate_date: null

- Estimate ID: lmn-estimate-EST4650520
  Account ID: lmn-account-5324593
  Status: won
  contract_start: null
  contract_end: null ❌
  estimate_date: null
```

## Why This Happened
The `contract_end` dates are likely:
1. **Not in the Excel export** - The Estimates List.xlsx file may not include contract end dates
2. **Not being imported** - Even if they exist in Excel, they may not be mapped during import
3. **Missing from source data** - The LMN system may not export contract end dates

## Solutions

### Option 1: Import contract_end dates from Excel (Recommended)
1. Check if `Estimates List.xlsx` has a "Contract End" column with dates
2. If yes, verify the import process is mapping this column to `contract_end`
3. Re-import the estimates file

### Option 2: Use estimate_date as fallback
Modify the renewal date calculation to use `estimate_date` when `contract_end` is missing:
- This would allow accounts to be marked at-risk based on estimate dates
- Less accurate than contract_end, but better than nothing

### Option 3: Manual entry
Manually add `contract_end` dates to won estimates in the database, but this is not scalable.

## Verification Steps
After fixing, run:
```bash
node check-won-estimates-and-contracts.js
```

This should show:
- Won estimates with `contract_end`: > 0
- Accounts that should be at-risk: > 0

Then refresh the application and check:
1. Dashboard should show at-risk accounts count > 0
2. Accounts page should show accounts with `status = 'at_risk'`
3. The renewal notification service should update account statuses

## Next Steps
1. ✅ Check if Excel file has contract_end dates
2. ✅ Verify import process maps contract_end correctly
3. ✅ Re-import if needed
4. ✅ Or implement estimate_date fallback logic

