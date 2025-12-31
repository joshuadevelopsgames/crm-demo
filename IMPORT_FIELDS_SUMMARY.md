# Estimate Import Fields Summary

## Fields Being Extracted from Excel

The parser looks for these **exact column names** in the Excel file:

### Date Fields (Critical for Reports)
- **`Estimate Date`** → maps to `estimate_date`
- **`Estimate Close Date`** → maps to `estimate_close_date`
- **`Contract Start`** → maps to `contract_start`
- **`Contract End`** → maps to `contract_end`
- **`Proposal First Shared`** → maps to `proposal_first_shared`
- **`Proposal Last Shared`** → maps to `proposal_last_shared`
- **`Proposal Last Updated`** → maps to `proposal_last_updated`

### Identification Fields
- **`Estimate ID`** → maps to `lmn_estimate_id` and `estimate_number`
- **`Estimate Type`** → maps to `estimate_type`
- **`Contact ID`** → maps to `lmn_contact_id` (note: this is actually the Account ID in LMN)
- **`Contact Name`** → maps to `contact_name`

### Project Information
- **`Project Name`** → maps to `project_name`
- **`Version`** → maps to `version`

### Contact Information
- **`Address`** → maps to `address`
- **`Billing Address`** → maps to `billing_address`
- **`Phone 1`** → maps to `phone_1`
- **`Phone 2`** → maps to `phone_2`
- **`Email`** → maps to `email`

### Sales Information
- **`Salesperson`** → maps to `salesperson`
- **`Estimator`** → maps to `estimator`
- **`Status`** → maps to `status` (parsed to 'won', 'lost', or 'pending')
- **`Sales Pipeline Status`** → maps to `pipeline_status` (not used for win/loss determination)
- **`Division`** → maps to `division`
- **`Referral`** → maps to `referral`
- **`Ref. Note`** → maps to `referral_note`
- **`Confidence Level`** → maps to `confidence_level`

### Financial Fields
- **`Material Cost`** → maps to `material_cost`
- **`Material Price`** → maps to `material_price`
- **`Labor Cost`** → maps to `labor_cost`
- **`Labor Price`** → maps to `labor_price`
- **`Labor Hours`** → maps to `labor_hours`
- **`Equipment Cost`** → maps to `equipment_cost`
- **`Equipment Price`** → maps to `equipment_price`
- **`Other Costs`** → maps to `other_costs`
- **`Other Price`** → maps to `other_price`
- **`Sub Costs`** → maps to `sub_costs`
- **`Sub Price`** → maps to `sub_price`
- **`Total Price`** → maps to `total_price`
- **`Total Price With Tax`** → maps to `total_price_with_tax`
- **`Total Cost`** → maps to `total_cost`
- **`Total Overhead`** → maps to `total_overhead`
- **`Breakeven`** → maps to `breakeven`
- **`Total Profit`** → maps to `total_profit`
- **`Predicted Sales`** → maps to `predicted_sales`

### Metadata Fields
- **`CRM Tags`** → maps to `crm_tags`
- **`Archived`** → maps to `archived` (boolean)
- **`Exclude Stats`** → maps to `exclude_stats` (boolean)

## Date Parsing Logic

The `parseDate` function handles:
1. **Excel serial dates** (numbers) - converts to YYYY-MM-DD format
2. **ISO date strings** (YYYY-MM-DD) - uses directly
3. **Date strings with timezone** - parses as UTC and extracts date components

**Important**: Dates are returned as **YYYY-MM-DD strings** (not Date objects or timestamps).

## Potential Issues

If `estimate_date` or `estimate_close_date` are not being saved:

1. **Column name mismatch**: The Excel file might have different column names
   - Check if columns are named exactly "Estimate Date" and "Estimate Close Date"
   - Case-sensitive matching is used

2. **Empty/null values**: If the columns exist but are empty, `parseDate` returns `null`
   - This is expected behavior - empty dates are stored as `null`

3. **Date format issues**: If dates are in an unrecognized format, `parseDate` might return `null`
   - Check the actual date format in the Excel file

4. **Column index issues**: If `findIndex` returns -1 (not found), the field will be `undefined`
   - The parser should log errors for missing columns

## How to Debug

1. Check the import logs for any column mapping errors
2. Verify the Excel file has columns named exactly:
   - "Estimate Date"
   - "Estimate Close Date"
3. Check if these columns have data (not empty)
4. Verify the date format in Excel matches what `parseDate` expects

