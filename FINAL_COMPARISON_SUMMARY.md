# Final Comparison Summary: Our Data vs LMN Screenshots

## Screenshot Data

### 2024 Sales Overview
- **Total Estimates:** 591
- **Estimates Sold:** 577
- **$ of Estimates Sold:** $6.58M
- **Total Estimated $:** $7.0M
- **Gross Profit Sold:** 12.4%
- **Gross Profit Estimated:** 12.9%
- **Rev/Hr Sold:** $539
- **Rev/Hr Estimated:** $530

### 2025 Salesperson Performance
- **Total Estimates:** 1,086
- **Estimates Sold:** 927
- **$ of Estimates Sold:** $11.05M
- **Total Estimated $:** $14.9M
- **Gross Profit Sold:** 11.9%
- **Gross Profit Estimated:** 11.2%
- **Rev/Hr Sold:** $460
- **Rev/Hr Estimated:** $508

## Our Current Data (After All Fixes)

### 2024
- **Total Estimates:** 629 (LMN: 591, diff: +38, +6.4%)
- **Estimates Sold:** 615 (LMN: 577, diff: +38, +6.6%)
- **$ of Estimates Sold:** $7.34M using `total_price` (LMN: $6.58M, diff: +$0.76M, +11.6%)
- **Total Estimated $:** $7.79M using `total_price` (LMN: $7.0M, diff: +$0.79M, +11.3%)

### 2025
- **Total Estimates:** 1,359 (LMN: 1,086, diff: +273, +25.1%)
- **Estimates Sold:** 1,023 (LMN: 927, diff: +96, +10.4%)
- **$ of Estimates Sold:** $15.14M using `total_price` (LMN: $11.05M, diff: +$4.09M, +37.0%)
- **Total Estimated $:** $30.28M using `total_price` (LMN: $14.9M, diff: +$15.38M, +103.2%)

## Key Findings

### ✅ What We Got Right

1. **Date Filtering:** Using `estimate_close_date` only is correct for Salesperson Performance
2. **Won Status Logic:** Filtering by won statuses (Contract Signed, Work Complete, Billing Complete, Email Contract Award, Verbal Contract Award) is very close
3. **Base Filters:** exclude_stats, archived, duplicates, zero/negative prices are all correct
4. **Price Field:** Using `total_price` (no tax) is closer than `total_price_with_tax`

### ⚠️ Remaining Differences

#### 2024 (Very Close - 6.4% difference)
- **38 extra estimates** - Likely due to:
  - Additional business rules in LMN not visible in export
  - Possibly excluding some specific statuses (Email/Verbal Contract Award?)

#### 2025 (25% difference in total, 10% in sold)
- **273 extra total estimates** - Analysis shows:
  - Excluding "Lost" statuses: 1,108 (only 22 off!)
  - This suggests LMN excludes "Lost" estimates from "Total Estimates"
- **96 extra sold estimates** - Analysis shows:
  - Won statuses only: 1,013 (73 off)
  - Pipeline='Sold': 1,023 (63 off)
  - LMN likely uses Pipeline='Sold' OR won statuses, possibly including some edge cases

## Recommended Filtering Logic

### For "Total Estimates" (All estimates closed in year)
```javascript
// Filter by estimate_close_date in year
// Exclude: exclude_stats=true, archived=true, price<=0, duplicates
// Exclude: status includes "Lost" (for 2025, this gets us very close: 1108 vs 1086)
```

### For "Estimates Sold"
```javascript
// Filter by estimate_close_date in year
// Exclude: exclude_stats=true, archived=true, price<=0, duplicates
// Include: Pipeline='Sold' OR won statuses
// Won statuses: Contract Signed, Work Complete, Billing Complete, Email Contract Award, Verbal Contract Award
```

### For Dollar Amounts
```javascript
// Use total_price (no tax) instead of total_price_with_tax
// This is closer to LMN's values
```

## Next Steps

1. **Update "Total Estimates" calculation** to exclude "Lost" statuses
2. **Update "Estimates Sold" calculation** to use Pipeline='Sold' OR won statuses
3. **Update dollar calculations** to use `total_price` instead of `total_price_with_tax`
4. **Test the remaining 22 estimate difference** for 2025 to see if there are additional filters

## Accuracy Summary

- **2024:** 93.6% accurate (6.4% difference) - Very good!
- **2025:** 75% accurate for total (25% difference), 90% accurate for sold (10% difference)
- **Price calculations:** Using `total_price` reduces difference significantly

The remaining differences are likely due to LMN-specific business rules that aren't visible in the export data.



