# On-the-Fly Calculations Audit

## Purpose

This document identifies data that should only change on import but is currently being calculated on-the-fly in the application.

## Data That Should Only Change on Import

Based on the spec: **Data only changes on import**. The following should be calculated during import and stored, not calculated on-the-fly:

1. **Revenue** (`revenue_by_year` JSONB field)
2. **Segments** (`segment_by_year` JSONB field)
3. **Annual Revenue** (`annual_revenue` field - backward compatibility)

## Current State Analysis

### ✅ Already Fixed (Using Stored Data)

1. **Accounts.jsx** - Revenue Display
   - ✅ Uses `getRevenueForYear(account, selectedYear)` 
   - ✅ Reads from `revenue_by_year[selectedYear]`
   - ✅ No on-the-fly calculation

2. **Accounts.jsx** - Segment Display
   - ✅ Uses `getSegmentForYear(account, selectedYear)`
   - ✅ Reads from `segment_by_year[selectedYear]`
   - ✅ No on-the-fly calculation

3. **EditAccountDialog.jsx** - Segment Display
   - ✅ Uses `getSegmentForYear(account, selectedYear)`
   - ✅ Reads from stored segment
   - ✅ No on-the-fly calculation (fixed in previous update)

### ⚠️ Still Calculating On-the-Fly

1. **TotalWork.jsx** - Revenue Breakdown Calculation
   - **Location**: `src/components/account/TotalWork.jsx`
   - **Issue**: Calculates revenue from estimates on-the-fly for display
   - **Lines**: 222-310 (estimatedBreakdown, soldBreakdown)
   - **Current Behavior**: 
     - Calculates `totalEstimated` and `totalSold` from estimates array
     - Uses `getEstimateYearData()` to determine year and annualize
     - Calculates breakdown for display
   - **Should Be**: 
     - For "SOLD" (won estimates), should use stored `account.revenue_by_year[selectedYear]`
     - For "ESTIMATED" (all estimates), calculation is OK (shows breakdown of all estimates, not just won)
   - **Note**: This is a display/breakdown component, but the "SOLD" total should match stored revenue

2. **Unused Functions** (Not Currently Called, But Exist)
   - **`getAccountRevenue()`** - `src/utils/revenueSegmentCalculator.js:311`
     - Calculates revenue from estimates on-the-fly
     - **Status**: Not called anywhere in UI (safe, but should be deprecated)
   - **`calculateRevenueFromEstimates()`** - `src/utils/revenueSegmentCalculator.js:264`
     - Calculates revenue from estimates array
     - **Status**: Only used by `getAccountRevenue()` (which isn't called)
     - **Note**: Still used during import (which is correct)

3. **Unused Imports** (Not Actually Used)
   - **Accounts.jsx** imports `calculateRevenueSegment` and `calculateTotalRevenue`
     - **Status**: Imported but not used in the file
     - **Action**: Remove unused imports

## Recommendations

### High Priority

1. **TotalWork.jsx - SOLD Total**
   - **Current**: Calculates `totalSold` from estimates on-the-fly
   - **Should**: Use `getRevenueForYear(account, selectedYear)` for "SOLD" total
   - **Rationale**: "SOLD" represents won estimates revenue, which is stored in `revenue_by_year`
   - **Note**: Keep breakdown calculation for display, but total should match stored value

2. **Remove Unused Imports**
   - Remove `calculateRevenueSegment` and `calculateTotalRevenue` from Accounts.jsx imports
   - These are only used during import/manual recalculation

### Medium Priority

3. **Deprecate `getAccountRevenue()`**
   - Add deprecation notice
   - Document that it should not be used (use `getRevenueForYear()` instead)
   - Keep for backward compatibility if needed

### Low Priority

4. **TotalWork.jsx - ESTIMATED Total**
   - **Current**: Calculates from all estimates (not just won)
   - **Status**: OK - This is for display/breakdown purposes
   - **Note**: "ESTIMATED" includes all estimates (won and not won), so calculation is appropriate

## Summary

### Data Calculated On-the-Fly (Should Use Stored Data)

| Component | Data | Current | Should Be | Priority |
|-----------|------|---------|-----------|----------|
| TotalWork.jsx | SOLD total | Calculated from estimates | Use `getRevenueForYear()` | High |
| TotalWork.jsx | ESTIMATED total | Calculated from estimates | OK (all estimates, not just won) | N/A |

### Functions That Calculate On-the-Fly (Not Used in UI)

| Function | Location | Status | Action |
|----------|----------|--------|--------|
| `getAccountRevenue()` | revenueSegmentCalculator.js:311 | Not called | Deprecate |
| `calculateRevenueFromEstimates()` | revenueSegmentCalculator.js:264 | Only used by getAccountRevenue | Keep (used during import) |

### Unused Imports

| File | Import | Action |
|------|--------|--------|
| Accounts.jsx | `calculateRevenueSegment` | Remove |
| Accounts.jsx | `calculateTotalRevenue` | Remove |

## Next Steps

1. Update TotalWork.jsx to use stored revenue for "SOLD" total
2. Remove unused imports from Accounts.jsx
3. Add deprecation notice to `getAccountRevenue()`

