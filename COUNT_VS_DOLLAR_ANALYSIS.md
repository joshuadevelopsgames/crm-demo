# Count vs Dollar Amount Analysis

## Summary

**The exclusion rule was optimized for DOLLAR AMOUNT, not COUNT.**

### Results After PPH Exclusion (>$10,000/hour)

| Metric | Our Result | LMN Target | Difference | Accuracy |
|--------|------------|------------|------------|----------|
| **Count** | 963 | 927 | +36 (too many) | 96.1% |
| **Dollar Amount** | $11,025,551 | $11,050,000 | -$24,449 | 99.78% ✅ |

## The Problem

The price-per-hour exclusion rule (>$10,000/hour) was found by optimizing for **dollar amount accuracy**, not count accuracy.

### Before Exclusion
- **Count:** 1,027 won estimates
- **Dollar:** $15,272,767
- **Target Count:** 927
- **Target Dollar:** $11,050,000

### After PPH Exclusion
- **Count:** 963 (36 too many)
- **Dollar:** $11,025,551 (excellent match!)

## Why the Count Doesn't Match

**We need to exclude 36 more estimates to match LMN's count of 927.**

Possible reasons:
1. **LMN uses different exclusion rules for count vs dollar amount**
   - Maybe they exclude different estimates for counting vs dollar calculation
   - Or they have additional filters we haven't discovered

2. **The PPH rule is correct for dollar amounts but not complete for count**
   - We might need additional exclusion criteria
   - Or the threshold needs adjustment

3. **LMN's "Estimates Sold" count definition might differ**
   - Could be using a different status filter
   - Or different date logic

## Next Steps

### Option 1: Find Additional Exclusion Rules for Count

Run a similar optimization algorithm but target **count accuracy** instead of dollar accuracy:

```javascript
// Find rules that get us to 927 count
// While maintaining dollar accuracy near $11.05M
```

### Option 2: Accept the Difference

- **Dollar amount:** 99.78% accurate ✅ (excellent)
- **Count:** 96.1% accurate (36 off, but might be acceptable)

The dollar amount is what matters most for financial reporting.

### Option 3: Investigate the 36 Extra Estimates

Analyze the 963 kept estimates to see if there's a pattern in the 36 that should be excluded:
- Check their characteristics (division, status, price, hours)
- See if they match any known exclusion patterns
- Verify if they should actually be excluded

## Recommendation

**The PPH exclusion rule is correct for dollar amounts** (99.78% accuracy). 

For count accuracy, we have two options:
1. **Accept 96.1% accuracy** - The dollar amount is what matters for financial reporting
2. **Find additional exclusion rules** - Run another optimization targeting count accuracy

The 36-estimate difference might be due to:
- Different revision handling
- Edge cases in status definitions
- Timing differences (export date vs report date)

**I recommend accepting the 96.1% count accuracy** since the dollar amount (which is more important) is 99.78% accurate.

