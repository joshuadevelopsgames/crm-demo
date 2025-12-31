# Salesperson Performance Report Comparison

## LMN vs Our Data (2025)

### Key Differences

| Metric | LMN | Our Data | Difference |
|--------|-----|----------|------------|
| **Total Estimates** | 1,086 | 2,136 | +96.7% (1,050 more) |
| **Estimates Sold** | 927 | 1,063 | +14.7% (136 more) |
| **$ of Estimates Sold** | $11.05M | $18.85M | +70.6% ($7.80M more) |
| **Total Estimated $** | $14.90M | $52.28M | +250.9% ($37.38M more) |
| **Gross Profit Sold** | 11.9% | 8.6% | -3.3% |
| **Gross Profit Estimated** | 11.2% | 12.3% | +1.1% |
| **Rev/Hr Sold** | $460 | $513.20 | +$53.20 |
| **Rev/Hr Estimated** | $508 | $650.69 | +$142.69 |

## Root Causes

### 1. **Date Filtering Strategy**

**Our Current Approach:**
- Uses `estimate_close_date` OR `estimate_date` (whichever exists)
- This includes estimates that were made in 2025 OR closed in 2025

**LMN's Likely Approach:**
- **For "This year" in Salesperson Performance**: Only uses `estimate_close_date` (when estimate was sold/closed)
- This matches the description: "All sales figures based on estimates sold"

**Evidence:**
- Filtering by `estimate_close_date` only gives us 1,383 estimates (closer to LMN's 1,086)
- Still 27% more, but much closer than our current 96% difference

### 2. **"Sold" Definition**

**Our Current Approach:**
- Uses `status='won'` to identify sold estimates

**LMN's Likely Approach:**
- Uses `pipeline_status='Sold'` to identify sold estimates
- This is separate from the `status` field

**Problem:**
- **`pipeline_status` is NOT being populated** in our database (all estimates show null)
- This means we can't match LMN's "Sold" definition
- The import code was updated to save `pipeline_status`, but existing data doesn't have it

### 3. **Missing Data**

- **36 estimates** are marked `exclude_stats=true` (we're already excluding these)
- **259 sold estimates** are missing `labor_hours` (affects Rev/Hr calculation)
- **18 total estimates** are missing `total_cost` (affects Gross Profit calculation)

### 4. **Price Field Usage**

- We're using `total_price_with_tax` for all calculations
- LMN might be using `total_price` (without tax) for some calculations
- This could explain the dollar amount differences

## Recommended Fixes

### Priority 1: Fix Date Filtering for Salesperson Performance

**For "This year" in Salesperson Performance reports:**
- **Only use `estimate_close_date`** (not `estimate_date`)
- This matches LMN's description: "All sales figures based on estimates sold"
- This will reduce our count from 2,136 to ~1,383 (still 27% more, but closer)

### Priority 2: Populate `pipeline_status` Field

**Issue:** All estimates have `pipeline_status = null`

**Solution:**
1. Re-import the data with the updated parser (which now saves `pipeline_status`)
2. OR: Backfill `pipeline_status` from the Excel export if available

**Impact:**
- Will allow us to use `pipeline_status='Sold'` instead of `status='won'`
- This should match LMN's "Sold" definition more closely

### Priority 3: Use `pipeline_status='Sold'` for "Sold" Definition

**Change the "Sold" filter to:**
```javascript
const soldEstimates = estimates.filter(est => {
  const pipelineStatus = est.pipeline_status?.toLowerCase() || '';
  return pipelineStatus === 'sold';
});
```

**Fallback:** If `pipeline_status` is not available, use `status='won'`

### Priority 4: Verify Price Field Usage

**Check if LMN uses:**
- `total_price` (without tax) for some calculations
- `total_price_with_tax` for others

**Test both approaches** and see which matches LMN's values more closely

## Testing Different Filtering Strategies

### Strategy 1: By `estimate_close_date` only
- Total: 1,383 (diff: +297, +27.3%)
- Sold: 1,026 (diff: +99, +10.7%)
- $: $34.19M (diff: +$19.29M, +129.5%)

**This is the closest match to LMN's values!**

### Strategy 2: By `estimate_date` only
- Total: 2,005 (diff: +919, +84.6%)
- Sold: 1,009 (diff: +82, +8.8%)
- $: $43.53M (diff: +$28.63M, +192.2%)

### Strategy 3: By `close_date` OR `estimate_date` (current)
- Total: 2,136 (diff: +1,050, +96.7%)
- Sold: 1,063 (diff: +136, +14.7%)
- $: $52.28M (diff: +$37.38M, +250.9%)

## Remaining Discrepancies (Even After Fixes)

Even with the closest filtering strategy (by `estimate_close_date` only), we still have:
- **27% more total estimates** (1,383 vs 1,086)
- **10.7% more sold estimates** (1,026 vs 927)
- **129% more dollar amount** ($34.19M vs $14.90M)

**Possible reasons:**
1. **Additional filters in LMN** that we're not aware of:
   - Division/Department filter
   - Salesperson filter
   - Pipeline Status filter
   - Exclude archived estimates
   - Other business rules

2. **Different price calculation:**
   - LMN might exclude certain estimate types
   - LMN might use different price field
   - LMN might have additional exclusions

3. **Data quality issues:**
   - Some estimates might be duplicates
   - Some estimates might have incorrect dates
   - Some estimates might be in wrong year due to date parsing issues

## Next Steps

1. ✅ **Fix date filtering** - Use only `estimate_close_date` for "This year" in Salesperson Performance
2. ✅ **Re-import data** - Ensure `pipeline_status` is populated
3. ✅ **Update "Sold" definition** - Use `pipeline_status='Sold'` when available
4. ⚠️ **Investigate remaining 27% difference** - Check for additional filters or data quality issues
5. ⚠️ **Verify price calculations** - Test using `total_price` vs `total_price_with_tax`

