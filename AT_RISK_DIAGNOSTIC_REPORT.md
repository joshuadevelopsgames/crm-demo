# At-Risk Accounts Diagnostic Report

## Summary

**Date:** Generated from import files analysis
**Status:** ❌ Critical Issues Found

### Key Findings

1. **42 accounts should be at-risk** based on won estimates expiring within 180 days
2. **0 accounts are currently marked as at-risk** in the database
3. **All 2145 won estimates in database are missing `contract_end` dates**
4. **663 won estimates in import files have `contract_end` dates** - but they're not being saved

## Root Cause

The `contract_end` field is **not being saved to the database** during import, even though:
- The parser correctly extracts `contract_end` from "Contract End" column
- The import files contain 663 won estimates with valid `contract_end` dates
- The database has 2145 won estimates, but **0 have `contract_end` values**

## At-Risk Accounts That Should Be Flagged

Based on import file analysis, these 42 accounts have won estimates expiring within 180 days:

1. Colliers International (2357283) - Renewal: 3/12/2026 (69 days)
2. Edon Management (2759654) - Renewal: 3/28/2026 (85 days)
3. Catalyst Condo Management Ltd (3667133) - Renewal: 3/29/2026 (86 days)
4. Choice Properties Limited Partnership (4108877) - Renewal: 3/29/2026 (86 days)
5. Riverpark Properties (2357371) - Renewal: 4/12/2026 (100 days)
6. c/o Martello Property Services (2412422) - Renewal: 4/12/2026 (100 days)
7. Public Storage (3661753) - Renewal: 4/13/2026 (101 days)
8. Remington Development Corporation (5049799) - Renewal: 4/13/2026 (101 days)
9. RioCan (8521849) - Renewal: 4/13/2026 (101 days)
10. Congebec (5283831) - Renewal: 4/13/2026 (101 days)
... and 32 more

## Field Mapping Comparison

### Accounts (from Contacts Export.xlsx)

| Excel Column | Database Field | Status |
|-------------|---------------|--------|
| CRM ID | `lmn_crm_id` | ✅ Working |
| CRM Name | `name` | ✅ Working |
| Type | `account_type` | ✅ Working |
| Classification | `classification` | ✅ Working |
| Archived | `status` (archived/active) | ✅ Working |
| Tags | `tags` | ✅ Working |

### Estimates (from Estimates List.xlsx)

| Excel Column | Database Field | Status |
|-------------|---------------|--------|
| Estimate ID | `lmn_estimate_id` | ✅ Working |
| Estimate Date | `estimate_date` | ✅ Working |
| Contract Start | `contract_start` | ⚠️ **NOT BEING SAVED** |
| Contract End | `contract_end` | ❌ **NOT BEING SAVED** |
| Status | `status` (won/lost) | ✅ Working |
| Contact ID | `lmn_contact_id` | ✅ Working |
| Total Price With Tax | `total_price_with_tax` | ✅ Working |

## Critical Issues

### Issue 1: `contract_end` Not Being Saved
- **Impact:** At-risk account calculation cannot work without `contract_end` dates
- **Evidence:** 0 out of 2145 won estimates have `contract_end` in database
- **Expected:** 663 won estimates should have `contract_end` dates

### Issue 2: `contract_start` Not Being Saved
- **Impact:** Revenue calculation may be affected
- **Evidence:** Need to verify in database

### Issue 3: `at_risk_status` Column Missing
- **Impact:** Cannot mark accounts as at-risk
- **Error:** `column accounts.at_risk_status does not exist`

## Recommendations

### Immediate Actions

1. **Fix `contract_end` import:**
   - Verify `api/data/estimates.js` is preserving `contract_end` during upsert
   - Check if there's any filtering/transformation removing `contract_end`
   - Re-import Estimates List.xlsx after fix

2. **Fix `contract_start` import:**
   - Same as above for `contract_start`

3. **Add `at_risk_status` column:**
   ```sql
   ALTER TABLE accounts ADD COLUMN IF NOT EXISTS at_risk_status BOOLEAN DEFAULT FALSE;
   ```

4. **Re-run at-risk calculation:**
   - After fixing `contract_end` import, re-run renewal notification service
   - Should mark 42 accounts as at-risk

### Verification Steps

1. After re-import, verify won estimates have `contract_end`:
   ```sql
   SELECT COUNT(*) FROM estimates 
   WHERE status = 'won' AND contract_end IS NOT NULL;
   ```
   Expected: ~663

2. Verify at-risk accounts are marked:
   ```sql
   SELECT COUNT(*) FROM accounts WHERE at_risk_status = true;
   ```
   Expected: ~42

3. Check sample at-risk account:
   ```sql
   SELECT a.name, a.lmn_crm_id, a.at_risk_status, e.contract_end
   FROM accounts a
   JOIN estimates e ON e.lmn_contact_id = a.lmn_crm_id
   WHERE a.lmn_crm_id = '2357283' AND e.status = 'won'
   LIMIT 1;
   ```

## Files Analyzed

- ✅ Contacts Export.xlsx (1,687 rows, 1,161 unique accounts)
- ✅ Estimates List.xlsx (7,934 rows, 7,934 estimates, 663 won with contract_end)
- ✅ Leads.xlsx (verified exists)
- ✅ Jobsite Export (1).xlsx (verified exists)

