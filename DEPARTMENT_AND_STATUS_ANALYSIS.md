# Department and Win/Loss Status Analysis

## Summary

✅ **Deployed to dev repo** - Changes committed and pushed successfully

## Department Categorization

### ✅ Working Correctly

The `normalizeDepartment` function properly handles:
- **Known departments**: All 6 departments are correctly identified
- **Case variations**: Handles uppercase, lowercase, mixed case
- **Partial matches**: "Maintenance" → "Snow and Ice Maintenance", "Construction" → "Landscape Construction"
- **Unassigned values**: All unassigned variations (`<unassigned>`, `null`, `undefined`, `n/a`, etc.) → "Uncategorized"
- **Unknown departments**: All unrecognized values → "Uncategorized"

### Potential Uncategorized Departments

These will be grouped under "Uncategorized" (which is correct):
- Snow Removal
- Ice Management
- Lawn Care
- Groundskeeping
- Hardscaping
- Softscaping
- Arborist Services
- Sprinkler Systems
- Other, Misc, General, Unknown, TBD

**Recommendation**: ✅ Current behavior is correct. All unknown departments are properly categorized as "Uncategorized".

## Win/Loss Status Edge Cases

### ✅ Explicitly Handled Statuses

**Won:**
- Email Contract Award ✅
- Verbal Contract Award ✅
- Work Complete ✅
- Work In Progress ✅
- Billing Complete ✅
- Contract Signed ✅

**Lost:**
- Estimate In Progress - Lost ✅
- Review + Approve - Lost ✅
- Client Proposal Phase - Lost ✅
- Estimate Lost ✅
- Estimate On Hold ✅
- Estimate Lost - No Reply ✅
- Estimate Lost - Price too high ✅

### ⚠️ Potential Edge Cases Found

#### 1. Statuses that might need explicit handling:

**Potentially Should Be WON (currently lost via pattern/default):**
- "Contract Awarded" → Currently: **won** (pattern match) ✅
- "Proposal Accepted" → Currently: **lost** (might should be won?)
- "Quote Accepted" → Currently: **lost** (might should be won?)
- "Estimate Accepted" → Currently: **lost** (might should be won?)
- "Approved" → Currently: **lost** (might should be won?)
- "Completed" → Currently: **lost** (might should be won?)

**Potentially Should Be LOST (currently lost via pattern/default):**
- "Estimate Rejected" → Currently: **lost** ✅
- "Estimate Cancelled" → Currently: **lost** ✅
- "Estimate Withdrawn" → Currently: **lost** ✅
- "Estimate Expired" → Currently: **lost** ✅
- "Client Declined" → Currently: **lost** ✅
- "Project Cancelled" → Currently: **lost** ✅
- "Rejected" → Currently: **lost** ✅
- "Cancelled" → Currently: **lost** ✅

**Ambiguous Statuses:**
- "Contract Signed - Pending" → Currently: **won** (contains "contract signed")
- "Work In Progress - On Hold" → Currently: **lost** (contains "on hold")
- "Billing In Progress" → Currently: **lost** (contains "in progress")

#### 2. Statuses that are correctly handled but might need clarification:

- "Work In Progress" → **won** (work has started, so it's won)
  - ⚠️ This might be confusing - consider if this should be won or a different status

### Recommendations

#### High Priority

1. **Add explicit handling for "Accepted" statuses:**
   ```javascript
   // These might indicate won estimates
   if (stat.includes('accepted') || 
       stat === 'approved' ||
       stat === 'completed') {
     return 'won';
   }
   ```

2. **Handle "Contract Signed - Pending" more carefully:**
   ```javascript
   // If contains "pending" after "contract signed", might not be final
   if (stat.includes('contract signed') && 
       stat.includes('pending')) {
     return 'lost'; // Or handle differently
   }
   ```

#### Medium Priority

3. **Add explicit handling for common statuses:**
   - "Proposal Accepted" → won
   - "Quote Accepted" → won
   - "Estimate Accepted" → won
   - "Approved" → won
   - "Completed" → won (if it means work is done)

4. **Consider adding a warning for ambiguous statuses:**
   - Log when status contains conflicting keywords
   - Allow manual override

#### Low Priority

5. **Document status meanings:**
   - Create a status reference guide
   - Clarify what "Work In Progress" means (won because work started?)

## Current Status

### ✅ What's Working

1. **Department categorization**: All unknown/unassigned values → "Uncategorized" ✅
2. **Explicit status handling**: All specified statuses are correctly mapped ✅
3. **Pattern matching fallback**: Handles variations of known statuses ✅
4. **Default behavior**: Unknown statuses default to lost (no pending) ✅

### ⚠️ Potential Issues

1. **"Accepted" statuses might be won**: "Proposal Accepted", "Quote Accepted", "Estimate Accepted" are currently lost
2. **"Approved" might be won**: Currently defaults to lost
3. **"Completed" might be won**: Currently defaults to lost
4. **Ambiguous statuses**: "Contract Signed - Pending" is marked as won but contains "pending"

## Next Steps

1. ✅ **Deployed** - Changes are live on dev
2. ⚠️ **Review** - Check if "Accepted", "Approved", "Completed" statuses should be won
3. ⚠️ **Clarify** - Determine if "Work In Progress" should be won (work started = won?)
4. ⚠️ **Handle** - Add explicit handling for ambiguous statuses like "Contract Signed - Pending"

## Test Results

- **Departments**: 12 categorized, 25 uncategorized (all correctly handled)
- **Statuses**: 9 won, 41 lost, 29 edge cases identified
- **Issues**: 4 potential issues found (mostly ambiguous statuses)
