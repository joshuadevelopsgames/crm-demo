# Dollar Amount Analysis - Findings

## Summary

**Our dollar amounts don't line up with LMN's, but we found important patterns:**

1. **"Total Estimated $" might only include won estimates** (not all estimates)
2. **We're still $4.06M too high on "Estimates Sold"** (36.8% difference)

---

## Current Results

### Our Calculations (using total_price, no tax):

- **Total Estimated $:** $23.81M
- **$ of Estimates Sold:** $15.11M

### LMN Shows:

- **Total Estimated $:** $14.90M
- **$ of Estimates Sold:** $11.05M

### Differences:

- **Total:** $8.91M too high (59.8%)
- **Sold:** $4.06M too high (36.8%)

---

## Key Finding

### Hypothesis: LMN's "Total Estimated $" Only Includes Won Estimates

**Evidence:**
- Our sold amount: **$15.11M**
- LMN's total: **$14.90M**
- Difference: **$0.21M (only 1.4% off!)** ✅

This is **much closer** than including all estimates ($23.81M vs $14.90M = 59.8% off).

**Conclusion:** LMN's "Total Estimated $" in the Salesperson Performance report likely only counts **won estimates**, not all estimates with close_date.

---

## The Problem: "Estimates Sold" Still Too High

We're still **$4.06M too high** on "Estimates Sold" ($15.11M vs $11.05M).

### What We're Including:

- **1,086 total estimates** (matches LMN's count ✅)
- **1,013 won estimates** (sold)
- **73 non-won estimates** (EIP revisions)

### The 73 Non-Won Estimates:

- All are **"Estimate In Progress"** (EIP revisions)
- Total value: **$8.70M**
- These are included in our count but not in our "sold" calculation (correct)

### But Why Is Our Sold Amount Too High?

Possible reasons:

1. **LMN excludes EIP revisions from dollar calculations** (even if they're won)
2. **Different price field** - maybe LMN uses a different field than `total_price`
3. **Additional exclusions** - maybe some won estimates are excluded from dollar calculations
4. **Price adjustments** - maybe LMN adjusts prices (discounts, change orders, etc.)

---

## Next Steps to Investigate

1. **Check if EIP revisions are excluded from dollar calculations**
   - Even if they're won, maybe EIP revisions don't count toward dollar amounts

2. **Check for price field differences**
   - Maybe LMN uses `subtotal` or `base_price` instead of `total_price`
   - Maybe they exclude certain line items

3. **Check for additional exclusions**
   - Maybe some won estimates are excluded from dollar calculations
   - Check for specific statuses or conditions

4. **Check the 73 EIP revisions**
   - Are they all Pipeline="Pending"?
   - Do they have different characteristics than the won EIP revisions?

---

## Current Status

✅ **Count accuracy:** 100% (1,086 vs 1,086)
❌ **Dollar accuracy:** 
   - Total: 59.8% too high (but 1.4% off if only counting won)
   - Sold: 36.8% too high

**The count matches perfectly, but dollar amounts need more investigation.**

