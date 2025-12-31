# LMN Exclusion Rules Analysis - Final Findings

## Summary

After analyzing LMN's exact list of 924 estimates and comparing it with our database, we've identified the key patterns in LMN's exclusion logic.

## Current Best Rule Set

**Base Rules (already implemented):**
1. Exclude if: `price < $100`
2. Exclude if: `price_per_hour > $5,000` (when hours > 0)
3. Exclude if: `hours = 0 AND price < $1,000 AND division includes 'Maintenance'`

**Additional Rule (recommended):**
4. Exclude if: `division includes 'Maintenance' AND type includes 'Service' AND (version includes '2026' OR version includes '2027') AND hours NOT IN [1, 2]`

This rule achieves:
- **Count accuracy:** 92.10% (851 vs 924 target)
- **Dollar accuracy:** 74.55% ($8.24M vs $11.05M target)
- **Exact match with LMN list:** 89.18% (824 of 924 estimates match exactly)

## Key Findings

### What LMN Excludes (that we include)

**Pattern 1: Maintenance Service with Version 2026/2027**
- **Count:** 77 estimates (85% of the 103 we include but LMN excludes)
- **Characteristics:**
  - Division: LE Maintenance (Summer/Winter)
  - Type: Service
  - Version: 2026 (56 estimates) or 2027 (21 estimates)
  - Hours: Mix (0-300 hours)
  - Price: $4k-$132k
  - PPH: $95-$4,800 (all below $5k threshold)
  - Date clustering: 29 in March 2025, 20 in February 2025

**Pattern 2: Other Divisions**
- LE Irrigation: 7 estimates
- LE Paving: 4 estimates
- LE Landscapes: 4 estimates
- LE Tree Care: 3 estimates

### What LMN Includes (that we exclude)

**Pattern 1: Maintenance with 1-2 Hours and Price > $1k**
- **Count:** 39 estimates (75% of the 52 LMN includes but we exclude)
- **Characteristics:**
  - Division: LE Maintenance (Summer/Winter) - 45 of 52
  - Hours: 1-2 hours (39 estimates)
  - Price: $1,000+ (45 estimates)
  - **Key insight:** LMN includes these even if they have high PPH or other characteristics we exclude

**Pattern 2: Zero Hours with Price > $1k**
- **Count:** 11 estimates
- **Characteristics:**
  - Division: Mostly Maintenance
  - Hours: 0
  - Price: $1,000+ (above our $1k threshold for zero hours)

**Pattern 3: Low Price Estimates**
- **Count:** 6 estimates with price < $100
- **Note:** These should be excluded by our base rule, but LMN includes them

## Recommended Approach

### Option 1: Use Refined Rules (Current Best)

Apply the rule set above. This gets us to **89.18% exact match** with LMN's list.

**Pros:**
- Logical, rule-based approach
- Can be implemented in code
- Handles new estimates automatically

**Cons:**
- Still 100 estimates different from LMN's exact list
- Dollar accuracy is lower (74.55%)

### Option 2: Hybrid Approach

1. Use the refined rules as the base
2. For the remaining 100 estimates that LMN includes but we exclude, create a specific allowlist
3. For the 27 estimates we include but LMN excludes, create a specific blocklist

**Pros:**
- Can achieve 100% match with LMN's list
- Maintains rule-based logic for new estimates

**Cons:**
- Requires maintaining allowlist/blocklist
- Less "pure" rule-based approach

### Option 3: Use LMN's Exact List as Source of Truth

If LMN provides regular exports, we could:
1. Import LMN's exact list periodically
2. Use that as the authoritative source for "Sold" estimates
3. Apply rules only for estimates not yet in LMN's export

**Pros:**
- 100% accuracy with LMN
- No guessing at rules

**Cons:**
- Requires regular LMN exports
- Not fully automated

## Implementation Code

```javascript
function shouldExcludeEstimate(estimate) {
  const price = parseFloat(estimate.total_price) || 0;
  const hours = parseFloat(estimate.labor_hours) || 0;
  const division = (estimate.division || '').toString().trim();
  const type = (estimate.estimate_type || '').toString().trim();
  const version = (estimate.version || '').toString().trim();
  
  // Base rules
  if (price < 100) return true;
  
  if (hours > 0) {
    const pph = price / hours;
    if (pph > 5000) return true;
  }
  
  if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
    return true;
  }
  
  // New rule: Maintenance Service with Version 2026/2027 (but allow 1-2 hours)
  if (division.includes('Maintenance') && 
      type.toLowerCase().includes('service') &&
      (version.includes('2026') || version.includes('2027'))) {
    // Allow if 1-2 hours (LMN includes these)
    if (hours >= 1 && hours <= 2) {
      return false;
    }
    return true;
  }
  
  return false;
}
```

## Next Steps

1. **Decide on approach:** Choose Option 1, 2, or 3 above
2. **If Option 1:** Implement the refined rules in `src/utils/reportCalculations.js`
3. **If Option 2:** Create allowlist/blocklist tables and integrate with rules
4. **If Option 3:** Set up periodic import process for LMN exports

## Files Generated

- `lmn_vs_our_detailed_comparison.csv` - Detailed comparison of all differences
- `refined_kept.csv` - Estimates kept by refined rules
- `refined_excluded.csv` - Estimates excluded by refined rules

## Notes

- The 100 estimates LMN includes but we exclude are mostly Maintenance with 1-2 hours and price > $1k
- The 27 estimates we include but LMN excludes are mostly Maintenance Service with version 2026/2027 (but not 1-2 hours)
- There may be additional LMN-specific business logic we haven't identified (e.g., date-based rules, customer-specific rules, etc.)

