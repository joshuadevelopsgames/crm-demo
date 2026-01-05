# On-the-Fly Calculations Summary

## Data That Should Only Change on Import

Based on your requirement: **"Data only changes on import"**, the following should be calculated during import and stored, not calculated on-the-fly:

1. **Revenue** (`revenue_by_year` JSONB field)
2. **Segments** (`segment_by_year` JSONB field)  
3. **Annual Revenue** (`annual_revenue` field - backward compatibility)

## Current On-the-Fly Calculations

### 1. ⚠️ TotalWork.jsx - "WON VALUE" Calculation

**Location**: `src/components/account/TotalWork.jsx`  
**Lines**: 262-310 (soldBreakdown calculation), 308-310 (totalSold calculation)

**Current Behavior**:
- Calculates `totalSold` from won estimates on-the-fly
- Uses `getEstimateYearData()` to determine year and annualize
- Shows breakdown of which estimates contribute

**Issue**:
- "WON VALUE" should use stored `account.revenue_by_year[selectedYear]`
- Currently calculates from estimates array instead

**Fix Required**:
- Pass `account` prop to TotalWork component
- Use `getRevenueForYear(account, selectedYear)` for "WON VALUE" total
- Keep breakdown calculation for display/transparency (but total should match stored value)

**Note**: "ESTIMATED VALUE" calculation is OK - it shows all estimates (not just won), so calculation is appropriate.

### 2. ✅ Already Fixed

- **Accounts.jsx** - Uses `getRevenueForYear()` (reads from stored data)
- **Accounts.jsx** - Uses `getSegmentForYear()` (reads from stored data)
- **EditAccountDialog.jsx** - Uses `getSegmentForYear()` (reads from stored data)

### 3. 📦 Unused Functions (Not Called in UI)

- **`getAccountRevenue()`** - `src/utils/revenueSegmentCalculator.js:311`
  - Calculates revenue from estimates on-the-fly
  - **Status**: Not called anywhere in UI
  - **Action**: Deprecate or remove

- **`calculateRevenueFromEstimates()`** - `src/utils/revenueSegmentCalculator.js:264`
  - Calculates revenue from estimates array
  - **Status**: Only used by `getAccountRevenue()` (which isn't called)
  - **Note**: Still used during import (which is correct)

### 4. 🧹 Unused Imports

- **Accounts.jsx** imports `calculateRevenueSegment` and `calculateTotalRevenue`
  - **Status**: Imported but not used
  - **Action**: Remove unused imports

## Summary Table

| Component | Data | Current | Should Be | Status |
|-----------|------|---------|-----------|--------|
| **TotalWork.jsx** | WON VALUE total | Calculated from estimates | Use `getRevenueForYear()` | ⚠️ Needs Fix |
| **TotalWork.jsx** | ESTIMATED VALUE | Calculated from estimates | OK (all estimates, not just won) | ✅ OK |
| **Accounts.jsx** | Revenue display | Uses `getRevenueForYear()` | ✅ Correct | ✅ Fixed |
| **Accounts.jsx** | Segment display | Uses `getSegmentForYear()` | ✅ Correct | ✅ Fixed |
| **EditAccountDialog.jsx** | Segment display | Uses `getSegmentForYear()` | ✅ Correct | ✅ Fixed |

## Recommended Actions

### High Priority

1. **Update TotalWork.jsx**
   - Add `account` prop
   - Use `getRevenueForYear(account, selectedYear)` for "WON VALUE" total
   - Keep breakdown calculation for display (but verify it matches stored value)

### Medium Priority

2. **Remove Unused Imports**
   - Remove `calculateRevenueSegment` and `calculateTotalRevenue` from Accounts.jsx

3. **Deprecate Unused Functions**
   - Add deprecation notice to `getAccountRevenue()`
   - Document that `getRevenueForYear()` should be used instead

## Code Locations

### TotalWork Component
- **File**: `src/components/account/TotalWork.jsx`
- **Used in**: `src/pages/AccountDetail.jsx:424`
- **Current Props**: `{ estimates = [] }`
- **Needs**: Add `account` prop

### Unused Functions
- **File**: `src/utils/revenueSegmentCalculator.js`
- **Functions**: `getAccountRevenue()` (line 311), `calculateRevenueFromEstimates()` (line 264)
- **Status**: Not called in UI (only used during import, which is correct)

