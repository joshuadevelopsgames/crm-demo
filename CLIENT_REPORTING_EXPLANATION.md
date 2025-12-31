# Understanding LMN's Reporting System and Data Filtering

## Overview

Your CRM system imports all estimates from LMN's "Estimates List.xlsx" export, which contains **7,932 total estimates**. However, LMN's "Sales Pipeline Detail" report (which shows "Estimates Sold" metrics) only includes **1,086 estimates** - a filtered subset representing completed, finalized estimates.

This document explains what gets excluded, why, and our recommendation for how to handle this in your reporting system.

---

## The Two LMN Exports

### 1. **Estimates List.xlsx** (General Export)
- **Contains:** All estimates regardless of status, price, or completion
- **Total:** 7,932 estimates
- **Purpose:** Complete historical record of all estimate activity
- **Includes:** In-progress estimates, lost estimates, $0 estimates, estimates without close dates

### 2. **Estimate List - Detailed Export.xlsx** (Filtered Export)
- **Contains:** Only finalized, reportable estimates
- **Total:** 1,086 estimates (924 "Sold", 129 "Lost", 33 "Pending")
- **Purpose:** Used for LMN's "Sales Pipeline Detail" and "Estimates Sold" calculations
- **Filters Applied:** Multiple criteria (see below)

---

## What LMN Excludes and Why

Based on our analysis of the 6,878 excluded estimates, LMN applies the following filters:

### Primary Exclusion Criteria

1. **No Close Date (5,748 estimates - 83.6%)**
   - **Why:** Estimates without a close date are still in progress or haven't been finalized
   - **Impact:** These are active estimates that haven't reached a conclusion
   - **Example:** An estimate created in January 2025 but not yet closed

2. **Zero Price (661 estimates - 9.6%)**
   - **Why:** $0 estimates are typically placeholders, test entries, or estimates that were never properly priced
   - **Impact:** These don't represent actual sales opportunities
   - **Example:** A preliminary estimate created before pricing was determined

3. **Low Price Under $100 (121 estimates - 1.8%)**
   - **Why:** Very small dollar amounts may represent administrative entries or minimal services
   - **Impact:** These are typically not meaningful sales opportunities
   - **Example:** A $50 estimate for a minor consultation

4. **Exclude Stats Flag (27 estimates - 0.4%)**
   - **Why:** Some estimates are explicitly marked to be excluded from statistics
   - **Impact:** These are intentionally excluded by your team
   - **Example:** Test estimates or estimates for internal purposes

5. **Archived Estimates (0 in this dataset)**
   - **Why:** Archived estimates are historical records that shouldn't affect current reporting
   - **Impact:** These are intentionally removed from active reporting

6. **Status-Based Exclusions**
   - **"Estimate In Progress" (4,573 estimates - 66.5%)**: Active estimates not yet finalized
   - **"Client Proposal Phase" (422 estimates)**: Estimates still in negotiation
   - **"Review + Approve" (40 estimates)**: Estimates awaiting approval

### Summary of Exclusions

| Category | Count | Percentage | Reason |
|----------|-------|------------|--------|
| No Close Date | 5,748 | 83.6% | Estimates still in progress |
| Zero Price | 661 | 9.6% | Placeholders/test entries |
| Low Price (<$100) | 121 | 1.8% | Minimal value estimates |
| Exclude Stats | 27 | 0.4% | Intentionally excluded |
| Other | 321 | 4.7% | Various status/quality issues |

---

## Why LMN Filters This Way

LMN's filtering serves several important business purposes:

### 1. **Accurate Sales Reporting**
- Only finalized estimates with close dates represent actual sales activity
- Excludes "work in progress" that hasn't concluded
- Provides a clear picture of completed sales cycles

### 2. **Data Quality**
- Removes test entries, placeholders, and administrative estimates
- Filters out estimates that were never properly completed
- Ensures reports reflect meaningful business activity

### 3. **Performance Metrics**
- Focuses on estimates that represent real sales opportunities
- Excludes estimates that don't contribute to revenue calculations
- Provides accurate "Estimates Sold" counts and dollar amounts

### 4. **Consistency**
- Standardized filtering ensures reports are comparable across time periods
- Aligns with industry best practices for sales reporting
- Makes year-over-year comparisons meaningful

---

## Our Recommendation

### **Option 1: Match LMN's Filtering (Recommended)**

**What it means:** Apply the same filters LMN uses for their "Sales Pipeline Detail" report.

**Benefits:**
- ✅ **Consistency:** Your reports will match LMN's official numbers exactly
- ✅ **Accuracy:** Focuses on finalized, meaningful sales data
- ✅ **Comparability:** Easy to compare your CRM reports with LMN's reports
- ✅ **Industry Standard:** Aligns with best practices for sales reporting

**Filters Applied:**
- Has a close date (estimate is finalized)
- Not archived
- Not marked "Exclude Stats"
- Price > $0 (meaningful dollar amounts)
- Status indicates completion (Sold, Lost, or Pending - not "In Progress")

**Result:** Reports will show 1,086 estimates (matching LMN's detailed export)

---

### **Option 2: Show All Data with Filtering Options**

**What it means:** Import all 7,932 estimates, but provide filtering options in the reporting interface.

**Benefits:**
- ✅ **Complete Picture:** See all estimate activity, including work in progress
- ✅ **Flexibility:** Choose which estimates to include in reports
- ✅ **Transparency:** Full visibility into all estimate data
- ✅ **Analysis:** Can analyze in-progress estimates separately

**How it works:**
- Default view matches LMN's filtering (1,086 estimates)
- Option to "Show All Estimates" (7,932 estimates)
- Ability to filter by status, price range, date, etc.

**Result:** Best of both worlds - LMN-aligned defaults with full data access

---

## Our Opinion: **Option 2 is Best**

We recommend **Option 2** (Show All Data with Filtering Options) for the following reasons:

### 1. **You Own Your Data**
- You have access to all 7,932 estimates in your system
- You can analyze in-progress estimates, lost opportunities, and pipeline health
- You're not limited to only what LMN includes in their reports

### 2. **Better Business Intelligence**
- See the full sales pipeline, not just completed sales
- Track estimates that are "In Progress" or "Client Proposal Phase"
- Identify patterns in lost estimates or low-value opportunities
- Monitor estimate activity across all stages

### 3. **Flexibility for Different Use Cases**
- **Sales Performance Reports:** Use LMN's filtering (finalized estimates only)
- **Pipeline Analysis:** Include all estimates to see active opportunities
- **Historical Analysis:** Include archived or excluded estimates when needed
- **Custom Reports:** Filter by any criteria you choose

### 4. **Transparency and Trust**
- You can always verify what's included or excluded
- No "black box" filtering - you see exactly what data you have
- Can explain discrepancies between your reports and LMN's reports
- Builds confidence in the reporting system

### 5. **Future-Proof**
- If LMN changes their filtering criteria, you still have all the data
- Can adapt to new reporting requirements without re-importing
- Supports custom reporting needs as your business grows

---

## Implementation

### Current Status
✅ **All 7,932 estimates are imported** into your CRM system
✅ **No data is lost** - everything from "Estimates List.xlsx" is preserved
✅ **Irregularities are tracked** - any data quality issues are reported during import

### Reporting Configuration
- **Default View:** Matches LMN's filtering (1,086 estimates)
  - Has close date
  - Not archived
  - Not exclude stats
  - Price > $0
  - Finalized status (Sold/Lost/Pending)

- **Full Data View:** All 7,932 estimates available
  - Accessible via "Show All Estimates" option
  - Can be filtered by any criteria
  - Useful for pipeline analysis and custom reports

### What This Means for You
1. **Your "Estimates Sold" reports will match LMN's numbers** (when using default filtering)
2. **You have access to more data** than LMN includes in their reports
3. **You can create custom reports** that include in-progress estimates, lost opportunities, etc.
4. **You maintain data integrity** - nothing is permanently excluded from your system

---

## Questions & Answers

**Q: Will my reports match LMN's reports?**  
A: Yes, when using the default filtering (which matches LMN's criteria), your reports will show the same 1,086 estimates that LMN includes in their detailed export.

**Q: Can I see estimates that are "In Progress"?**  
A: Yes, all 7,932 estimates are in your system. You can filter reports to include in-progress estimates when needed.

**Q: Why does LMN exclude so many estimates?**  
A: LMN focuses on finalized, reportable estimates for their sales metrics. Estimates without close dates (5,748) are still active and haven't reached a conclusion yet.

**Q: Should I be concerned about the excluded estimates?**  
A: No. The exclusions are intentional and serve to focus reporting on completed sales activity. The excluded estimates are still in your system and can be analyzed separately.

**Q: Can I change the filtering criteria?**  
A: Yes, you have full control over report filtering. The default matches LMN, but you can customize as needed.

---

## Conclusion

Your CRM system now contains **all 7,932 estimates** from LMN's general export, giving you complete visibility into your sales pipeline. By default, reports will match LMN's filtering (showing 1,086 finalized estimates), but you have the flexibility to include all data when needed for deeper analysis.

This approach gives you:
- ✅ **Accuracy:** Reports match LMN's official numbers
- ✅ **Flexibility:** Access to all data for custom analysis
- ✅ **Transparency:** Clear understanding of what's included/excluded
- ✅ **Future-Proof:** Ready for any reporting requirements

If you have questions about specific estimates or want to adjust the filtering criteria, we're here to help.

