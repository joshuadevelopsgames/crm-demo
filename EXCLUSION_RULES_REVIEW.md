# Exclusion Rules Review - Price-Per-Hour Analysis

## Executive Summary

**Target:** $11,050,000 (LMN's "Estimates Sold $")  
**Result:** $11,025,550.62  
**Accuracy:** 99.78% (only $24,449.38 off, or 0.22%)

**Best Rule Found:** Exclude estimates with price-per-hour > $10,000

---

## Detailed Analysis

### Excluded Estimates Summary

- **Total Excluded:** 64 estimates
- **Total Value Excluded:** ~$4.25M
- **All from Division:** "LE Maintenance (Summer/Winter)" (100%)
- **Hours Distribution:**
  - 23 estimates with 1 hour
  - 40 estimates with 2 hours  
  - 1 estimate with 5 hours

### Price-Per-Hour Range

- **Minimum:** $10,612.62/hour
- **Maximum:** $168,415.00/hour
- **Pattern:** All excluded estimates have PPH > $10,000

### Examples of Excluded Estimates

**High-value, low-hour contracts:**
- $336,830 with 2 hours = $168,415/hour (EST3339221, EST3339229, EST3339233)
- $138,900 with 2 hours = $69,450/hour (EST3338967, EST3338996, EST3339002)
- $81,007 with 1 hour = $81,007/hour (EST2997198)
- $78,665 with 1 hour = $78,665/hour (EST2955829)

**Lower threshold examples:**
- $13,334 with 1 hour = $13,334/hour (EST3224652)
- $13,200 with 1 hour = $13,200/hour (EST3270334)
- $10,612 with 5 hours = $10,612/hour (EST2990117) - only one with >2 hours

### Date Clustering Pattern

**Heavy clustering suggests bulk import:**
- **29 estimates** from Oct 13, 2025 (45% of all excluded)
- **10 estimates** from Oct 14, 2025 (16% of all excluded)
- **7 estimates** from Mar 3, 2025
- **4 estimates** from Sep 25, 2025

This pattern strongly suggests these were created in batches, likely from:
- Bulk import of annual maintenance contracts
- Template-based estimates for recurring services
- System-generated estimates rather than individual sales

### Value Statistics

- **Average excluded estimate:** $66,362.80
- **Minimum:** $11,319.84
- **Maximum:** $336,830.00
- **Total excluded value:** $4.25M

**Note:** Only 4 kept estimates have PPH between $5,000-$10,000, confirming the $10,000 threshold is well-chosen.

---

## Kept Estimates Analysis

### Division Breakdown (Kept Estimates)

- **LE Maintenance (Summer/Winter):** 278 estimates (still included)
- **LE Irrigation:** 216 estimates
- **LE Tree Care:** 152 estimates
- **LE Paving:** 151 estimates
- **LE Landscapes:** 123 estimates
- **LE Maintenance Enchancements:** 35 estimates
- **Other:** 8 estimates

### Key Finding

**No kept estimates have price-per-hour > $10,000**

This confirms the rule is working correctly - it's only excluding the abnormally high PPH estimates, not all maintenance contracts.

---

## Business Logic Assessment

### Why These Estimates Are Likely Excluded by LMN

1. **Annual/Bulk Maintenance Contracts**
   - High dollar values ($10K-$336K)
   - Very few recorded labor hours (1-2 hours)
   - Likely represent annual contracts or bulk service agreements
   - Labor hours may not reflect full contract value

2. **Data Entry Pattern**
   - All from same division: "LE Maintenance (Summer/Winter)"
   - Clustered dates (many from Oct 2025)
   - Similar price points (many duplicates: $29,160, $27,040, $26,680, etc.)
   - Suggests bulk import or template-based estimates

3. **Price-Per-Hour Anomaly**
   - Normal estimates: $100-$1,000/hour
   - Excluded estimates: $10,000-$168,000/hour
   - 10-100x higher than typical rates
   - Indicates these aren't production estimates

### Potential Issues to Consider

1. **False Positives?**
   - Are there legitimate high-value, low-hour estimates that should be included?
   - The $10,612/hour estimate with 5 hours (EST2990117) is close to threshold
   - Should we verify with business users?

2. **Division-Specific Rule?**
   - All excluded are from "LE Maintenance (Summer/Winter)"
   - Could we use a division-based rule instead?
   - But algorithm found PPH rule works better than division blacklist

3. **Threshold Sensitivity**
   - $10,000/hour is the threshold
   - What if LMN uses $9,500 or $10,500?
   - Small threshold changes could affect accuracy

---

## Comparison with Original Problem

### Before Exclusion Rule
- **WonSet Sum:** $15,272,766.99
- **Target:** $11,050,000
- **Difference:** +$4,222,766.99 (38.2% too high)

### After Exclusion Rule
- **Kept Sum:** $11,025,550.62
- **Target:** $11,050,000
- **Difference:** -$24,449.38 (0.22% off)

**Improvement:** From 38.2% error to 0.22% error ✅

---

## Recommendations

### ✅ Proceed with Integration

**The rule makes business sense:**
1. All excluded estimates are from maintenance division
2. They have abnormally high price-per-hour ratios
3. Pattern suggests annual/bulk contracts, not production estimates
4. Kept estimates still include 278 maintenance estimates (normal ones)
5. Accuracy is excellent (99.78%)

### Implementation Considerations

1. **Add to `filterEstimatesByYear` function**
   - Calculate price-per-hour: `total_price / labor_hours`
   - Exclude if PPH > $10,000 AND labor_hours > 0
   - Handle division by zero (if labor_hours is 0 or null, don't exclude)

2. **Make threshold configurable**
   - Consider adding as a constant: `EXCLUSION_PPH_THRESHOLD = 10000`
   - Allows easy adjustment if needed

3. **Document the rule**
   - Add comment explaining why maintenance contracts with high PPH are excluded
   - Reference this analysis

4. **Optional: Add logging**
   - Log excluded estimates for audit trail
   - Could help identify if rule needs adjustment

### Questions to Verify

1. **Business Validation**
   - Confirm with business users: Should annual maintenance contracts be excluded from "Estimates Sold $"?
   - Are these estimates actually sold, or are they recurring service agreements?

2. **Edge Cases**
   - What about the $10,612/hour estimate (EST2990117) with 5 hours?
   - Should we have a minimum hours threshold? (e.g., exclude if PPH > $10k AND hours < 3)

3. **Future-Proofing**
   - Will this rule work for other years?
   - Should we test with 2024 data to verify?

---

## Conclusion

The price-per-hour exclusion rule (> $10,000/hour) is **highly effective** and **makes business sense**. It:

- ✅ Achieves 99.78% accuracy vs LMN's target
- ✅ Excludes only maintenance contracts with abnormal PPH ratios
- ✅ Doesn't exclude normal maintenance estimates (278 still included)
- ✅ Targets a clear pattern (annual/bulk contracts vs production estimates)

**Recommendation: Proceed with integration after business validation.**

---

## Files Generated

- `won_kept.csv` - 963 estimates that should be included
- `won_excluded.csv` - 64 estimates that should be excluded (with reasons)

Review these files to verify the excluded estimates make sense for your business.

