# Verifying contract_end Dates Are Being Saved

## Code Analysis

The API code in `api/data/estimates.js` confirms that `contract_end` dates **should** be saved:

1. **Line 274-278**: The spread operator preserves ALL fields from the estimate object, including `contract_end`:
   ```javascript
   const { id, account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutIds } = estimate;
   const estimateData = {
     ...estimateWithoutIds,  // This preserves contract_end
     updated_at: new Date().toISOString()
   };
   ```

2. **Line 307-309**: Explicit comment confirms date fields are preserved:
   ```javascript
   // NOTE: Date fields (estimate_date, estimate_close_date, contract_start, contract_end) are preserved
   // by the spread operator above - no need to explicitly preserve them
   ```

## Verification Query

Run this SQL query in your Supabase SQL Editor to check if `contract_end` dates are actually being saved:

```sql
-- Check if contract_end dates are being saved
SELECT 
  COUNT(*) as total_won_estimates,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as won_without_contract_end,
  ROUND(100.0 * COUNT(*) FILTER (WHERE contract_end IS NOT NULL) / COUNT(*), 2) as percent_with_contract_end
FROM estimates
WHERE status = 'won';

-- Sample some won estimates with contract_end
SELECT 
  id,
  lmn_estimate_id,
  status,
  contract_end,
  account_id
FROM estimates
WHERE status = 'won' AND contract_end IS NOT NULL
LIMIT 10;
```

## If contract_end Dates Are Missing

If the query shows that `contract_end` dates are missing:

1. **Check the import source**: Verify that the Excel file (`Estimates List.xlsx`) has the "Contract End" column populated
2. **Check the parser**: Verify that `src/utils/lmnEstimatesListParser.js` is correctly reading the "Contract End" column
3. **Re-import**: If the Excel file has the dates but they're not in the database, re-import the Estimates List sheet

## Expected Result

After a successful import with contract_end dates:
- `won_with_contract_end` should be > 0
- `percent_with_contract_end` should show the percentage of won estimates that have contract_end dates

