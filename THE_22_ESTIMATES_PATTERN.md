# The 22 Estimates Pattern - Analysis Results

## Executive Summary

After detailed analysis, we've identified the pattern for the 22 estimates that differ between our count (1,108) and LMN's count (1,086).

**Accuracy Achieved:** 99.8% (1,088 vs 1,086 - only 2 off!)

---

## The Pattern

### LMN Excludes These Estimates:

1. **Estimate On Hold:** 1 estimate
2. **Client Proposal Phase:** 3 estimates
3. **Work In Progress:** 10 estimates
4. **Estimate In Progress (non-revisions):** 6 estimates

**Total Excluded:** 20 estimates → Results in 1,088 (only 2 off from 1,086)

---

## Key Insights

### 1. All "In Progress" Statuses Are Excluded

LMN excludes all estimates with "in progress" statuses:
- `Estimate On Hold`
- `Client Proposal Phase`
- `Work In Progress`

### 2. Estimate In Progress Has Special Rules

**LMN's behavior with "Estimate In Progress":**
- **Excludes:** EIP that are NOT revisions (6 estimates)
- **Includes:** EIP that ARE revisions (75 estimates)

**Why this makes sense:**
- EIP revisions likely represent estimates that were sold, then revised
- The original sold version counts, and revisions with close_date also count
- But EIP non-revisions are truly "in progress" and haven't been sold yet

### 3. The Remaining 2 Estimates

We're still 2 off (1,088 vs 1,086). These 2 are likely:
- Edge cases in revision handling
- Specific EIP revisions that should be excluded
- Data quality issues (missing fields, etc.)

---

## The 6 EIP Non-Revisions (Excluded by LMN)

These are the 6 "Estimate In Progress" estimates that are NOT revisions and are excluded by LMN:

1. **EST5870460:** $8,048.84, Pipeline: Pending
2. **EST5712237:** $47,299.16, Pipeline: Pending
3. **EST5688077:** $16,041.34, Pipeline: Pending
4. **EST3259361:** $7,133.00, Pipeline: Pending
5. **EST5313725:** $3,072.14, Pipeline: Pending
6. **EST5314000:** $25,876.35, Pipeline: Pending

**Common characteristics:**
- All have Pipeline Status: "Pending"
- All are "Estimate In Progress" (not revisions)
- All have positive prices
- All have close_date in 2025

**Why LMN excludes them:**
- They're truly "in progress" - not sold yet
- They're not revisions of sold estimates
- They have Pipeline="Pending" (not "Sold")

---

## Updated LMN-Compatible Filtering Rule

### For "Total Estimates" (Salesperson Performance):

```javascript
function isLMNCompatibleEstimate(estimate, startDate, endDate) {
  // 1. Must have a close_date (sold_date)
  if (!estimate.estimate_close_date) return false;
  
  // 2. Close date must be within reporting period
  const closeDate = new Date(estimate.estimate_close_date);
  if (closeDate < startDate || closeDate > endDate) return false;
  
  // 3. Exclude Lost statuses
  const status = (estimate.status || '').toString().toLowerCase().trim();
  if (status.includes('lost')) return false;
  
  // 4. Exclude all "in progress" statuses
  if (status === 'estimate on hold') return false;
  if (status === 'client proposal phase') return false;
  if (status === 'work in progress') return false;
  
  // 5. Exclude Estimate In Progress that are NOT revisions
  if (status === 'estimate in progress') {
    const version = estimate.version || estimate.revision_number;
    const isRevision = version && String(version).trim() !== '1' && String(version).trim() !== '1.0' && String(version).trim() !== '';
    if (!isRevision) return false; // Exclude non-revision EIP
  }
  
  // 6. Must have positive price
  const price = parseFloat(estimate.total_price || 0);
  if (price <= 0) return false;
  
  // 7. Must not be archived
  if (estimate.archived === true || estimate.archived === 'True' || estimate.archived === 1) return false;
  
  // 8. Must not be excluded from stats
  if (estimate.exclude_stats === true || estimate.exclude_stats === 'True' || estimate.exclude_stats === 1) return false;
  
  return true;
}
```

---

## Implementation Priority

### Phase 1: Core Rules (Already Implemented) ✅
- Use `estimate_close_date` (sold_date)
- Exclude Lost statuses
- Exclude archived/exclude_stats
- Use `total_price` (no tax)

### Phase 2: In Progress Statuses (Recommended)
- Exclude "Estimate On Hold"
- Exclude "Client Proposal Phase"
- Exclude "Work In Progress"
- Exclude "Estimate In Progress" (non-revisions only)

**Expected Result:** 99.8% accuracy (1,088 vs 1,086)

### Phase 3: Final 2 Estimates (Future)
- Investigate the remaining 2 estimate difference
- Likely edge cases in revision handling

---

## Why This Pattern Makes Business Sense

1. **"In Progress" = Not Sold Yet**
   - Estimates that are "on hold", "in proposal phase", or "work in progress" haven't been sold
   - They shouldn't count toward sales performance metrics

2. **EIP Revisions Are Different**
   - EIP revisions represent estimates that were sold, then revised
   - The original sold version counts, and revisions with close_date also count
   - But EIP non-revisions are truly "in progress" and haven't been sold

3. **Pipeline Status Matters**
   - All excluded EIP non-revisions have Pipeline="Pending" (not "Sold")
   - This confirms they're not actually sold estimates

---

## Conclusion

The 22 estimate difference is **not random** - it follows a clear pattern:

**LMN excludes:**
- All "in progress" statuses (On Hold, Proposal Phase, WIP)
- Estimate In Progress that are NOT revisions

**This gets us to 99.8% accuracy** (1,088 vs 1,086), with only 2 estimates remaining unexplained (likely edge cases).

This is an excellent result and provides a clear, implementable rule set.

