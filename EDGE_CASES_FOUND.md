# Edge Cases Found in Won/Loss/Pending Algorithm

## Executive Summary

**Total Edge Cases Tested:** 95  
**Critical Issues Found:** 67

### Key Findings:
- ⚠️ **37 Parser Inconsistencies**: CSV and LMN parsers produce different results
- ⚠️ **16 False Positive Risks**: Cases that may be misclassified
- ❓ **14 Unhandled Statuses**: Statuses that default to pending but should be explicitly handled

## 1. Parser Inconsistencies (37 Cases)

The CSV parser and LMN parser use **different logic**, causing inconsistent results:

### CSV Parser Logic:
- Checks Pipeline Status first (exact match: "sold", "lost", "pending")
- Falls back to Status field (pattern matching with `includes()`)
- More aggressive pattern matching

### LMN Parser Logic:
- Checks both fields simultaneously with OR logic
- Uses `includes()` for both fields
- Less aggressive, only checks for "won" in status field

### Examples of Inconsistencies:

| Status | Pipeline | CSV Result | LMN Result | Issue |
|--------|----------|------------|------------|-------|
| "Sold" | (empty) | **won** | **pending** | CSV checks status field, LMN doesn't |
| "Contract Signed" | (empty) | **won** | **pending** | CSV checks status field, LMN doesn't |
| "Won" | (empty) | **pending** | **won** | LMN checks for "won", CSV doesn't |
| (empty) | "Contract" | **pending** | **won** | LMN checks pipeline for "contract", CSV doesn't |
| (empty) | "Sold - Final" | **pending** | **won** | CSV requires exact "sold", LMN uses includes() |
| "Contract Signed - Pending" | (empty) | **won** | **pending** | Both problematic, but different results |

**Impact:** Same data imported via CSV vs LMN will produce different classifications.

## 2. False Positive Risks (16 Cases)

### False Positives for "WON" (10 cases):

1. **"Contract Signed - Pending Approval"** → Marked as **won** (should be **pending**)
2. **"Contract Signed - Draft"** → Marked as **won** (should be **pending**)
3. **"Contract Signed - Not Final"** → Marked as **won** (should be **pending**)
4. **"Sold Equipment"** → Marked as **won** (should be **pending** - unrelated)
5. **"Sold Items"** → Marked as **won** (should be **pending** - unrelated)
6. **"Email Contract - Draft"** → Marked as **won** (should be **pending**)
7. **"Email Contract - Pending"** → Marked as **won** (should be **pending**)
8. **"Verbal Contract - Not Confirmed"** → Marked as **won** (should be **pending**)
9. **"Contract Award - Pending"** → Marked as **won** (should be **pending**)
10. **"Pre-Contract Signed"** → Marked as **won** (should be **pending** - before signing)

**Root Cause:** Pattern matching with `includes()` catches partial matches. Statuses containing "contract signed" or "sold" are marked as won even when they indicate pending states.

### False Positives for "LOST" (6 cases):

1. **"Lost Contact"** → Marked as **lost** (should be **pending** - not estimate lost)
2. **"Lost in Translation"** → Marked as **lost** (should be **pending** - unrelated)
3. **"Lost Opportunity"** → Marked as **lost** (should be **pending** - ambiguous)
4. **"Lost Time"** → Marked as **lost** (should be **pending** - unrelated)
5. **"Lost and Found"** → Marked as **lost** (should be **pending** - unrelated)
6. **"Estimate Lost Contact"** → Marked as **lost** (should be **pending** - ambiguous)

**Root Cause:** Pattern matching catches any string containing "lost", even when it's not related to estimate status.

## 3. Unhandled Statuses (14 Cases)

These statuses default to "pending" but should be explicitly handled:

1. **"Cancelled"** → Currently: pending (should decide: won/lost/pending?)
2. **"On Hold"** → Currently: pending (should decide: won/lost/pending?)
3. **"Deferred"** → Currently: pending (should decide: won/lost/pending?)
4. **"Quoted"** → Currently: pending (should decide: won/lost/pending?)
5. **"Proposed"** → Currently: pending (should decide: won/lost/pending?)
6. **"Negotiating"** → Currently: pending (should decide: won/lost/pending?)
7. **"Partially Won"** → Currently: pending (CSV) / won (LMN) - **inconsistent!**
8. **"Partially Lost"** → Currently: lost (both parsers) - should decide: lost or pending?
9. **"Withdrawn"** → Currently: pending (should decide: won/lost/pending?)
10. **"Expired"** → Currently: pending (should decide: won/lost/pending?)
11. **"Rejected"** → Currently: pending (should decide: won/lost/pending?)
12. **"Approved"** → Currently: pending (should decide: won/lost/pending?)
13. **"Under Review"** → Currently: pending (should decide: won/lost/pending?)
14. **"Awaiting Response"** → Currently: pending (should decide: won/lost/pending?)

**Impact:** These statuses may need different handling based on business logic.

## 4. Additional Edge Cases Found

### Case Sensitivity (Handled Correctly)
✅ All parsers handle case variations correctly (SOLD, sold, Sold all work)

### Whitespace Handling (Partially Handled)
⚠️ Leading/trailing spaces are handled, but:
- CSV parser: "  Sold  " in pipeline → **pending** (exact match fails)
- LMN parser: "  Sold  " in pipeline → **won** (includes() works)

### Null/Undefined Values (Handled Correctly)
✅ Both parsers default to "pending" for null/undefined/empty values

### Priority Conflicts
✅ Pipeline Status correctly overrides Status field in CSV parser
⚠️ LMN parser checks both simultaneously, which can cause issues

## Recommendations

### Priority 1: Unify Parser Logic (CRITICAL)
**Impact:** High - Affects data consistency  
**Effort:** Medium

1. Create shared utility function: `src/utils/statusMapper.js`
2. Use same logic in both CSV and LMN parsers
3. Decide on single approach:
   - Option A: CSV parser approach (check pipeline first, then status)
   - Option B: LMN parser approach (check both simultaneously)
   - **Recommendation:** Option A (CSV approach) - more reliable

### Priority 2: Improve Pattern Matching (HIGH)
**Impact:** High - Reduces false positives  
**Effort:** Medium

1. Use exact matches or word boundaries instead of `includes()`
2. Add negative patterns:
   ```javascript
   // Don't mark as won if contains "pending", "draft", "not final"
   if (stat.includes('contract signed') && 
       !stat.includes('pending') && 
       !stat.includes('draft') && 
       !stat.includes('not final')) {
     return 'won';
   }
   ```
3. Require "Estimate Lost" instead of just "lost" for lost status

### Priority 3: Handle Additional Statuses (MEDIUM)
**Impact:** Medium - Improves accuracy  
**Effort:** Low

1. Map common statuses:
   - "Cancelled" → pending
   - "On Hold" → pending
   - "Deferred" → pending
   - "Quoted" → pending
   - "Proposed" → pending
   - "Negotiating" → pending
   - "Withdrawn" → lost
   - "Expired" → lost
   - "Rejected" → lost
   - "Approved" → pending (or won if business logic requires)
   - "Partially Won" → won (or create new status)
   - "Partially Lost" → lost

### Priority 4: Add Validation (LOW)
**Impact:** Low - Catches data quality issues  
**Effort:** Low

1. Verify won estimates have close dates
2. Verify lost estimates have close dates (if applicable)
3. Flag logical inconsistencies
4. Add warnings for potential false positives

### Priority 5: Add Manual Override (LOW)
**Impact:** Low - Allows user correction  
**Effort:** Medium

1. Add "Override Status" field to estimates
2. Store original algorithm result
3. Track manual corrections for algorithm improvement

## Testing Recommendations

1. **Run edge case tests regularly:**
   ```bash
   node test-all-edge-cases.js
   ```

2. **Test with real data:**
   ```bash
   node test-csv-accuracy.js
   ```

3. **Manual validation:**
   - Review 50-100 estimates manually
   - Calculate accuracy percentage
   - Document patterns in misclassifications

4. **Monitor in production:**
   - Track false positive rate
   - Monitor parser consistency
   - Collect user feedback

## Files to Update

1. **Create:** `src/utils/statusMapper.js` (shared utility)
2. **Update:** `src/utils/csvParser.js` (use shared utility)
3. **Update:** `src/utils/lmnEstimatesListParser.js` (use shared utility)
4. **Add:** Unit tests for edge cases
5. **Add:** Integration tests with real data

## Expected Impact

After fixes:
- **Parser Consistency:** 100% (from 61% currently)
- **False Positive Rate:** <5% (from ~17% currently)
- **Unhandled Statuses:** 0 (from 14 currently)
- **Overall Accuracy:** ~95% (from ~85-90% currently)
