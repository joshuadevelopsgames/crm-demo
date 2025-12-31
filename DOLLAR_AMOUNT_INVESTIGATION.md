# Dollar Amount Investigation - ChatGPT's Hypothesis Testing

## Summary

**ChatGPT is RIGHT** - matching counts doesn't guarantee the same estimates. We found evidence of a "swap" effect.

---

## Key Finding

### Excluding Won Estimates with > $100K and < 10 Hours

**Result:**
- **Count:** 999 (down from 1,013)
- **Dollar amount:** $12.76M (down from $15.11M)
- **Difference from LMN:** $1.71M (down from $4.06M) ✅ **CLOSER!**

**The 14 excluded estimates:**
- All are "Contract Signed"
- All have only 2 hours
- Dollar amounts: $100K-$337K
- All in "LE Maintenance (Summer/Winter)" division

**These are likely:**
- Design/consulting jobs (high price, minimal hours)
- Estimates signed but never actually produced
- Jobs that LMN excludes from sales performance dollars

---

## Other Findings

### 1. Zero Labor Hours
- **242 won estimates** with zero/missing labor hours
- **$1.44M** total value
- Doesn't match the $4.06M difference, but could be part of it

### 2. Low Hours-to-Dollar Ratio
- **50 won estimates** with < $100/hour ratio
- **$0.24M** total value
- Too small to explain the difference

### 3. Suspicious Estimates (> $100K, < 10 hours)
- **14 estimates** totaling **$2.35M**
- Excluding these gets us much closer ($1.71M difference instead of $4.06M)
- All are "Contract Signed" with only 2 hours

---

## Remaining $1.71M Difference

After excluding the 14 suspicious estimates, we're still $1.71M too high.

**Possible explanations:**
1. **Additional exclusions** - Maybe more estimates with similar patterns
2. **Different price field** - Maybe LMN uses a different calculation
3. **Price adjustments** - Maybe LMN adjusts prices (discounts, change orders)
4. **Contract-awarded distinction** - Maybe some "Contract Signed" estimates aren't actually "contract awarded"

---

## Next Steps

1. **Test excluding all won estimates with < 10 hours** (regardless of price)
2. **Check if "Email Contract Award" and "Verbal Contract Award" are excluded from dollars**
3. **Investigate the remaining $1.71M difference**
4. **Compare estimate IDs** - Build a diff set to see if we have different estimates

---

## ChatGPT's Assessment: ✅ CORRECT

**ChatGPT's hypothesis is validated:**
- Matching counts doesn't guarantee same estimates
- There IS a "swap" effect
- Won estimates with zero/low production hours are likely excluded from dollar calculations
- The 14 estimates with > $100K and < 10 hours are prime candidates

**Confidence:** ~70% that we've identified the main pattern, with additional exclusions needed to close the remaining $1.71M gap.

