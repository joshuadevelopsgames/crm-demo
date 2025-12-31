# Export Comparison Analysis

## Summary

After comparing our database to LMN's Excel exports, here are the key findings:

## Step 1: Our Database vs "Estimates List.xlsx" (General Export)

**Result: Our database is essentially exact from the general export**

- **In both:** 7,925 estimates
- **Missing from our DB:** 7 estimates (all "Lost" status with $0 or very low prices)
- **Extra in our DB:** 0 estimates

**Conclusion:** Our database contains 99.9% of the estimates from "Estimates List.xlsx". The 7 missing estimates are all "Lost" status with $0 or very low prices, which may have been filtered during import or are edge cases.

## Step 2: "Estimates List.xlsx" vs "Estimate List - Detailed Export.xlsx"

**Result: The detailed export is a heavily filtered subset**

- **General export:** 7,932 estimates (all estimates regardless of status)
- **Detailed export:** 1,086 estimates (filtered subset)
- **In both:** 1,054 estimates
- **Only in general:** 6,878 estimates
- **Only in detailed:** 32 estimates (all have "Unknown" division, mostly "Sold" status)

### Detailed Export Filtering Criteria

The "Estimate List - Detailed Export.xlsx" appears to filter by:

1. **Has Close Date** (100% match) - **REQUIRED**
   - All 1,086 estimates in detailed export have a close date
   - 5,748 estimates in general export don't have close dates and are excluded

2. **Not Archived** (100% match) - **REQUIRED**
   - All estimates in detailed export are not archived
   - 0 archived estimates in detailed export

3. **Not Exclude Stats** (100% match) - **REQUIRED**
   - All estimates in detailed export have exclude_stats = false
   - 44 estimates in general export have exclude_stats = true and are excluded

4. **Price > 0** (99.8% match) - **ALMOST REQUIRED**
   - 1,084 of 1,086 estimates have price > 0
   - 2,633 estimates in general export have price = $0 and are excluded

5. **Status Distribution:**
   - **Sold:** 924 estimates (85.1%)
   - **Lost:** 129 estimates (11.9%)
   - **Pending:** 33 estimates (3.0%)

### What Gets Excluded from Detailed Export

**By Status (top exclusions):**
- Estimate In Progress: 4,573
- Contract Signed: 818 (but some are in detailed export as "Sold")
- Estimate Lost: 460
- Client Proposal Phase: 422
- Work Complete: 254
- Billing Complete: 100

**By Price:**
- $0: 2,633
- $1-100: 949
- $100-1,000: 1,497
- $1,000+: 1,799

**By Close Date:**
- No close date: 5,748 (excluded)
- Has close date: 1,130 (some excluded, some included)

## Key Insights

1. **Our database matches the general export exactly** - we're importing all estimates from "Estimates List.xlsx" correctly.

2. **The detailed export is NOT just "Sold" estimates** - it includes:
   - 924 Sold estimates (85.1%)
   - 129 Lost estimates (11.9%)
   - 33 Pending estimates (3.0%)

3. **The detailed export requires a close date** - this is the most significant filter, excluding 5,748 estimates that don't have close dates.

4. **The detailed export excludes archived and exclude_stats estimates** - but these are already filtered in our reports.

5. **The 924 "Sold" estimates in detailed export** match the 924 estimates we found in LMN's "Sales Pipeline Detail.xlsx" report - this is the exact list LMN uses for their "Estimates Sold" calculations.

## Recommendations

1. **For matching LMN's "Estimates Sold" calculations:**
   - Use the 924 "Sold" estimates from "Estimate List - Detailed Export.xlsx" as the source of truth
   - Apply the exclusion rules we identified earlier (PPH > $5k, Price < $100, etc.)

2. **For our general reporting:**
   - Continue using "Estimates List.xlsx" as the source (which we already do)
   - Our database is correctly importing all estimates from this export

3. **For understanding LMN's filtering:**
   - The detailed export filters by: Has Close Date + Not Archived + Not Exclude Stats + Price > 0
   - Then further filters to mostly "Sold" status (but includes some Lost/Pending)

## Files Generated

- `export_comparison.csv` - Full comparison of all three data sources
- `detailed_export_filtering_analysis.csv` - Analysis of filtering criteria

