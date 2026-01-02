# Fix Missing Contract End Dates

## Problem
You have 2145 estimates marked as 'won', but **0 of them have `contract_end` dates**. This is why:
- ❌ No at-risk accounts are showing (need `contract_end` to calculate renewal dates)
- ✅ Revenue should still work (doesn't require `contract_end`)

## Solution Options

### Option 1: Re-import from Excel (Recommended)
If your `Estimates List.xlsx` file has the "Contract End" column populated:

1. Go to the Accounts page
2. Click "Import from LMN"
3. Re-import the Estimates List sheet
4. The parser will read `contract_end` dates from the "Contract End" column

**Note**: The parser already reads `contract_end` correctly (line 242 in `lmnEstimatesListParser.js`), so if the Excel file has the dates, they'll be imported.

### Option 2: Use the Fix Script (If you have the Excel file)
If you have the `Estimates List.xlsx` file in your Downloads folder, you can run:

```bash
node fix-contract-end-import.js
```

This script will:
- Read the Excel file
- Find won estimates with `contract_end` dates
- Update the database estimates with the missing dates

### Option 3: Manual SQL Update (If you know the dates)
If you know the `contract_end` dates for specific estimates, you can update them manually:

```sql
UPDATE estimates
SET contract_end = '2024-12-31T00:00:00Z'  -- Replace with actual date
WHERE id = 'lmn-estimate-XXXXX'  -- Replace with estimate ID
AND status = 'won';
```

## Why This Happened

The `contract_end` dates are read from the "Contract End" column in your Excel file. If:
- The column is empty in Excel → dates won't be imported
- The dates were filtered out during import → they weren't saved
- The dates weren't in the original import → they need to be backfilled

## Verification

After fixing, check:
```sql
SELECT 
  COUNT(*) as total_won,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as won_without_contract_end
FROM estimates
WHERE status = 'won';
```

**Expected Result**: `won_with_contract_end` should be > 0

## Impact on At-Risk Accounts

At-risk accounts are calculated from:
- Won estimates with `contract_end` dates
- Latest `contract_end` becomes the renewal date
- Accounts with renewals within 180 days = at-risk

**Without `contract_end` dates, there are no renewal dates, so no at-risk accounts.**

## Next Steps

1. **Check your Excel file**: Open `Estimates List.xlsx` and verify the "Contract End" column has dates for won estimates
2. **Re-import if needed**: If the Excel file has the dates, re-import the Estimates List
3. **Or run the fix script**: If you have the Excel file locally, use `fix-contract-end-import.js`

After fixing, refresh your browser and at-risk accounts should appear!

