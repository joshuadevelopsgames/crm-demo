# Complete Import Data Collection Summary

## Overview
This document details all data collected during import from LMN Excel files and explains how revenue is calculated.

## Files Required for Import

1. **Contacts Export.xlsx** - Contact information
2. **Leads List.xlsx** - Account information  
3. **Estimates List.xlsx** - Estimate/proposal data (REQUIRED for revenue)
4. **Jobsite Export.xlsx** - Jobsite information

## Data Collected Per File

### 1. Contacts Export.xlsx

**Account Fields:**
- Name (from Lead Name)
- Account Type (default: 'prospect')
- Status (default: 'active')
- Revenue Segment (default: 'C' - will be recalculated after import)
- Source: "lmn_import"
- Phone, Website, Address, Industry
- Annual Revenue (if provided in CSV)
- Notes: "Imported from LMN on [date]"

**Contact Fields:**
- First Name, Last Name
- Position/Title
- Email 1, Email 2
- Phone 1, Phone 2
- Billing Contact (Yes/No)
- Do Not Email, Do Not Mail, Do Not Call
- Send SMS preferences
- Notes
- Role (auto-assigned)
- Source: "lmn_import"

### 2. Leads List.xlsx

**Account Fields:**
- Name
- Account Type
- Status
- Classification
- Tags
- Address fields (Address 1, Address 2, City, State, Postal Code, Country)
- Source
- Created Date
- Last Interaction Date
- Renewal Date
- Archived status

### 3. Estimates List.xlsx (CRITICAL FOR REVENUE)

**All Financial Fields Collected:**
- `Material Cost` → `material_cost`
- `Material Price` → `material_price`
- `Labor Cost` → `labor_cost`
- `Labor Price` → `labor_price`
- `Labor Hours` → `labor_hours`
- `Equipment Cost` → `equipment_cost`
- `Equipment Price` → `equipment_price`
- `Other Costs` → `other_costs`
- `Other Price` → `other_price`
- `Sub Costs` → `sub_costs`
- `Sub Price` → `sub_price`
- **`Total Price`** → `total_price` (used for revenue calculation)
- **`Total Price With Tax`** → `total_price_with_tax` (also used)
- `Total Cost` → `total_cost`
- `Total Overhead` → `total_overhead`
- `Breakeven` → `breakeven`
- `Total Profit` → `total_profit`
- `Predicted Sales` → `predicted_sales`

**Status Field (CRITICAL):**
- `Status` column determines if estimate is "won", "lost", or "pending"
- **Won statuses include:**
  - "Email Contract Award"
  - "Verbal Contract Award"
  - "Work Complete"
  - "Work In Progress"
  - "Billing Complete"
  - "Contract Signed"
- **Lost statuses include:**
  - "Estimate In Progress - Lost"
  - "Review + Approve - Lost"
  - "Client Proposal Phase - Lost"
  - "Estimate Lost"
  - "Estimate On Hold"
  - "Estimate Lost - No Reply"
  - "Estimate Lost - Price Too High"

**Date Fields:**
- `Estimate Date` → `estimate_date`
- `Estimate Close Date` → `estimate_close_date`
- `Contract Start` → `contract_start`
- `Contract End` → `contract_end` (CRITICAL for at-risk accounts)
- `Proposal First Shared` → `proposal_first_shared`
- `Proposal Last Shared` → `proposal_last_shared`
- `Proposal Last Updated` → `proposal_last_updated`

**Other Fields:**
- Estimate ID, Estimate Type, Project Name, Version
- Contact Name, Contact ID (actually Account ID in LMN)
- Address, Billing Address, Phone 1, Phone 2, Email
- Salesperson, Estimator
- Division, Referral, Ref. Note
- Confidence Level
- CRM Tags
- Archived, Exclude Stats

### 4. Jobsite Export.xlsx

**Jobsite Fields:**
- Jobsite Name
- Address fields
- Account ID (linked to account)
- Contact ID (linked to contact)
- Created Date
- Notes

## How Revenue is Calculated

### Revenue Calculation Logic

1. **Only "Won" Estimates Count**
   - Revenue is calculated ONLY from estimates with `status === 'won'`
   - Lost or pending estimates are NOT included in revenue

2. **Current Year Revenue Only**
   - Revenue is calculated from won estimates that apply to the current year
   - Uses `estimate_close_date` if available, otherwise `estimate_date`
   - Multi-year contracts are annualized (divided by number of years)

3. **Revenue Value Used**
   - Primary: `total_price_with_tax` (if available)
   - Fallback: `total_price` (if `total_price_with_tax` is null/empty)

4. **Account Revenue**
   - Sum of all won estimates for that account in the current year
   - Annualized for multi-year contracts

### Revenue Segment Calculation

Revenue segments (A, B, C, D) are calculated based on:
1. **Total Revenue**: Sum of all account revenues (current year)
2. **Account Revenue**: Sum of won estimates for that account (current year)
3. **Percentage**: (Account Revenue / Total Revenue) × 100

**Segment Thresholds:**
- **Segment A**: ≥ 15% of total revenue
- **Segment B**: 5-15% of total revenue
- **Segment C**: 0-5% of total revenue
- **Segment D**: Project only (has "Standard" estimates but NO "Service" estimates)

## Why Revenue Might Not Be Showing

### Issue 1: No "Won" Estimates
**Problem:** If no estimates are marked as "won", revenue will be $0 for all accounts.

**Check:**
- Look at the debug logs: `accountsWithWonEstimates: 0`
- Check the `statusCounts` in the console to see what status values exist
- Verify estimates have status values that match "won" criteria

**Solution:**
- Check if your Excel file's "Status" column has values that match the won statuses
- The parser is case-insensitive, so "Won", "WON", "won" all work
- But the status must match one of the won statuses listed above

### Issue 2: Estimates Not Linked to Accounts
**Problem:** If estimates don't have `account_id` set, they won't be counted in account revenue.

**Check:**
- Look for `estimatesWithoutContactId` in import stats
- Verify `Contact ID` column in Estimates List matches Account IDs

**Solution:**
- Ensure "Contact ID" column in Estimates List.xlsx contains the Account ID
- Note: In LMN, "Contact ID" in estimates is actually the Account ID

### Issue 3: No Current Year Estimates
**Problem:** Revenue only counts estimates from the current year.

**Check:**
- Verify estimates have `estimate_date` or `estimate_close_date` in the current year
- Check if dates are being parsed correctly

**Solution:**
- Ensure date columns are formatted correctly in Excel
- Dates should be in Excel date format or YYYY-MM-DD format

### Issue 4: Missing Financial Fields
**Problem:** If `total_price` and `total_price_with_tax` are empty, revenue will be $0.

**Check:**
- Verify "Total Price" and "Total Price With Tax" columns exist in Estimates List.xlsx
- Check if these columns have numeric values

**Solution:**
- Ensure these columns are present and contain numeric values
- The parser handles currency formatting (removes $, commas, etc.)

### Issue 5: Revenue Segments Not Calculated
**Problem:** Segments default to 'C' if revenue calculation fails.

**Check:**
- After import, run "Recalculate Segments" button in Accounts page
- This recalculates all segments based on current year revenue

**Solution:**
- Click "Recalculate Segments" button after import completes
- This will update all accounts with correct A/B/C/D segments

## Debugging Steps

1. **Check Console Logs:**
   - Look for `🔍 At-Risk Accounts Debug:` log
   - Check `statusCounts` to see what status values exist
   - Check `accountsWithWonEstimates` count

2. **Check Import Stats:**
   - After import, check the import results
   - Look for errors or warnings about missing data

3. **Verify Excel Columns:**
   - Ensure "Status" column exists and has values
   - Ensure "Total Price" or "Total Price With Tax" columns exist
   - Ensure "Contact ID" column exists and matches Account IDs

4. **Check Database:**
   - Query estimates table: `SELECT status, COUNT(*) FROM estimates GROUP BY status;`
   - Query accounts: `SELECT revenue_segment, COUNT(*) FROM accounts GROUP BY revenue_segment;`
   - Check if estimates have `account_id` set: `SELECT COUNT(*) FROM estimates WHERE account_id IS NULL;`

## Summary

**Revenue is calculated from:**
- ✅ Won estimates only (`status === 'won'`)
- ✅ Current year only (based on estimate dates)
- ✅ `total_price_with_tax` or `total_price` field
- ✅ Linked to accounts via `account_id`

**Revenue segments are calculated from:**
- ✅ Total revenue across all accounts
- ✅ Each account's percentage of total revenue
- ✅ Requires "Recalculate Segments" to be run after import

**If revenue isn't showing:**
1. Check if estimates are marked as "won"
2. Check if estimates have `total_price` or `total_price_with_tax` values
3. Check if estimates are linked to accounts (`account_id` is set)
4. Run "Recalculate Segments" after import

