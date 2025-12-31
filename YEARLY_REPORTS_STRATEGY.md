# Yearly Reports Strategy: Detailed Export vs. Filtering Rules

## The Question

For yearly reports that match LMN's "Sales Pipeline Detail" report, should we:
1. **Get the detailed export for each year** (constant access needed)
2. **Use filtering rules on the general export** (filtered by year)

## Analysis

### Option 1: Get Detailed Export for Each Year

**How it works:**
- Request "Estimate List - Detailed Export.xlsx" for each year (2024, 2025, 2026, etc.)
- Import the detailed export for each year
- Use those as the source of truth for yearly reports

**Pros:**
- ✅ **100% accuracy** - Exact match with LMN's yearly reports
- ✅ **No guessing** - No need to reverse-engineer filtering rules
- ✅ **Future-proof** - Works even if LMN changes their filtering logic
- ✅ **Simple** - Just import the pre-filtered list
- ✅ **Reliable** - No risk of missing estimates due to rule changes

**Cons:**
- ⚠️ **Requires access** - Need to get the detailed export for each year
- ⚠️ **Manual process** - May need to request exports periodically
- ⚠️ **Dependency** - Relies on LMN providing the exports

**Best For:**
- Exact alignment with LMN's official yearly numbers
- Compliance reporting
- When 100% accuracy is critical
- When you have reliable access to LMN's detailed exports

---

### Option 2: Use Filtering Rules on General Export

**How it works:**
- Import the general "Estimates List.xlsx" (contains all years)
- Apply filtering rules (basic + advanced)
- Filter by year (estimate_close_date in that year)
- Generate yearly reports from filtered data

**Pros:**
- ✅ **Self-sufficient** - No need for detailed exports
- ✅ **Automated** - Rules apply automatically
- ✅ **Flexible** - Can generate reports for any year
- ✅ **Complete data** - Have all estimates, can analyze differently

**Cons:**
- ⚠️ **~89% accuracy** - Only matches 824 of 924 estimates
- ⚠️ **Rule maintenance** - May need to update rules as patterns emerge
- ⚠️ **Unknown logic** - 100 estimates difference suggests additional rules we haven't found
- ⚠️ **Risk of drift** - If LMN changes logic, rules may become less accurate

**Best For:**
- When you don't have reliable access to detailed exports
- When ~89% accuracy is acceptable
- When you want to analyze data differently than LMN
- When you need flexibility in reporting

---

## Recommendation: **Hybrid Approach**

### For Yearly Reports: **Get Detailed Export for Each Year**

**Why:**
1. **Accuracy is critical** - Yearly reports are often used for:
   - Financial reporting
   - Performance reviews
   - Compliance
   - Client presentations
   - Board meetings

2. **Consistency matters** - If you're comparing year-over-year or presenting to stakeholders, exact alignment with LMN's numbers is important

3. **The 11% difference matters** - 100 estimates difference could represent significant dollar amounts or important business insights

4. **Future-proof** - LMN's filtering logic may evolve, but the detailed export will always reflect their current logic

### Implementation Strategy

**Yearly Report Workflow:**
1. **At year-end or quarterly:**
   - Request "Estimate List - Detailed Export.xlsx" for the completed year
   - Import into your system
   - Tag/flag as "LMN Official [Year]" data

2. **Use for reporting:**
   - Generate yearly reports from the detailed export
   - This ensures 100% match with LMN's numbers

3. **Use general export for analysis:**
   - Keep the general export for pipeline analysis
   - Use for in-progress estimates
   - Use for custom analysis

**Example:**
```
2025 Yearly Report:
- Source: "Estimate List - Detailed Export.xlsx" (2025)
- Result: 924 Sold estimates, $11,049,470.84
- Accuracy: 100% match with LMN

2024 Yearly Report:
- Source: "Estimate List - Detailed Export.xlsx" (2024)
- Result: Exact match with LMN's 2024 numbers
- Accuracy: 100% match with LMN
```

---

## Alternative: **Rules + Periodic Verification**

If you can't get detailed exports regularly, use this approach:

1. **Apply filtering rules** to general export (filtered by year)
2. **Periodically verify** against LMN's "Sales Pipeline Detail" report
3. **Adjust rules** as you identify new patterns
4. **Document discrepancies** and investigate causes

**Accuracy:** ~89% initially, improves as you refine rules

**Best For:**
- When detailed exports aren't readily available
- When you can accept ~89% accuracy with periodic verification
- When you want to maintain flexibility

---

## Practical Recommendation

### **For Yearly Reports: Get Detailed Export for Each Year**

**Reasons:**
1. ✅ **100% accuracy** - Critical for yearly financial reporting
2. ✅ **No ambiguity** - Clear, official numbers from LMN
3. ✅ **Professional** - Can confidently present numbers that match LMN
4. ✅ **Low maintenance** - No need to maintain and update complex rules
5. ✅ **Future-proof** - Works regardless of LMN's logic changes

**Process:**
- Request detailed export at year-end (or quarterly if needed)
- Import as "LMN Official [Year]" data
- Use for all yearly reports
- Keep general export for other analysis

### **For Other Reports: Use Filtering Rules**

**Reasons:**
- General export is always available
- Rules work for most use cases (~99% for detailed export match)
- Flexible for custom analysis
- Good for pipeline and in-progress estimates

---

## Conclusion

**For yearly reports specifically:** Yes, get the detailed export for each year.

**Why:**
- Yearly reports are often used for critical business decisions
- 100% accuracy is more important than convenience
- The detailed export is the official source of truth
- It's a one-time import per year (not constant access needed)

**Workflow:**
1. At year-end: Request detailed export for that year
2. Import into system
3. Generate yearly reports from detailed export
4. Use general export for everything else

This gives you:
- ✅ 100% accurate yearly reports
- ✅ Flexibility for other analysis
- ✅ Minimal maintenance
- ✅ Professional, reliable reporting

**Bottom Line:** For yearly reports, the extra effort to get the detailed export is worth it for 100% accuracy and peace of mind.

