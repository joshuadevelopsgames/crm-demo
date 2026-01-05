# Segmentation Spec

## Purpose

The Segmentation section classifies accounts into revenue segments (A, B, C, D) based on their revenue percentage relative to total revenue for the selected year and their estimate types. Segments enable prioritization, filtering, and strategic account management. Segments are calculated automatically based on revenue data and are read-only in all user interfaces.

## Data Contract

### Sources

- **Accounts Table** (`accounts`):
  - `revenue_segment` (text): Segment classification ('A', 'B', 'C', or 'D')
  - `annual_revenue` (numeric): Stored revenue value for selected year (calculated during import)
  - `id` (text, PK): Account identifier

- **Estimates Table** (`estimates`):
  - `estimate_type` (text): "Standard" (project/one-time) or "Service" (ongoing/recurring)
  - `status` (text): Estimate status (must be "won" to count)
  - `account_id` (text): Links estimate to account
  - Date fields: `contract_end`, `contract_start`, `estimate_date`, `created_date` (for year determination)

- **Selected Year**: Determined by YearSelectorContext (site-wide, user-selectable, persists in user profile)

### Fields Used

**Required Fields:**
- `annual_revenue`: Used for percentage calculation (revenue for selected year)
- `revenue_segment`: Storage field for segment classification

**Optional Fields:**
- `estimate_type`: Used for Segment D classification
- Estimates data: Used for Segment D check and revenue calculation

### Types and Units

- **Segment**: Text value ('A', 'B', 'C', or 'D')
- **Revenue**: Numeric (USD), stored as `numeric(12,2)` in database
- **Selected Year**: Integer (e.g., 2024, 2025)
- **Revenue Percentage**: Float (0-100)

### Nullability Assumptions

- `revenue_segment`: Defaults to 'C' if missing or no revenue data
- `annual_revenue`: Can be `null` if account has no won estimates for selected year
- If `annual_revenue` is `null` or `0`, segment defaults to 'C'

## Logic

### Ordered End-to-End Flow

1. **Get Selected Year**
   - Retrieve from YearSelectorContext (site-wide, user-selectable)
   - Default to current calendar year if context unavailable

2. **Calculate Total Revenue**
   - Sum of all accounts' `annual_revenue` fields for selected year
   - Uses stored `annual_revenue` values (not recalculated from estimates)
   - If `totalRevenue <= 0`, all accounts default to segment 'C'

3. **For Each Account, Calculate Segment**

   a. **Segment D Check** (highest priority, uses selected year):
      - Filter won estimates for selected year only
      - Check if account has "Service" type won estimates
      - If account has NO Service estimates (Standard estimates only or no estimates) → assign Segment D
      - If account has ANY Service estimates → proceed to percentage calculation

   b. **Percentage Calculation** (for A/B/C, uses selected year):
      - `accountRevenue = account.annual_revenue` (revenue for selected year)
      - `revenuePercentage = (accountRevenue / totalRevenue) * 100`
      - If `accountRevenue <= 0` or `totalRevenue <= 0` → default to 'C'

   c. **Segment Assignment**:
      - Segment A: `revenuePercentage > 15%`
      - Segment B: `5% <= revenuePercentage <= 15%`
      - Segment C: `revenuePercentage < 5%` OR no revenue data (default)
      - Segment D: No Service estimates (Standard estimates only or no estimates) for selected year

### Transformations in Sequence

1. **Total Revenue Aggregation**: Sum all accounts' `annual_revenue` for selected year
2. **Segment D Classification**: Check if account has ANY Service estimates for selected year
3. **Revenue Percentage**: Calculate `(accountRevenue / totalRevenue) * 100`
4. **Threshold Comparison**: Compare percentage to segment thresholds (15%, 5%)
5. **Segment Assignment**: Assign A/B/C/D based on rules

### Computations and Formulas

**Revenue Percentage:**
```
revenuePercentage = (account.annual_revenue / totalRevenue) * 100
```

**Total Revenue:**
```
totalRevenue = sum of all accounts.annual_revenue for selected year
```

**Segment Assignment:**
```
if (hasNoServiceEstimates) → 'D'
else if (revenuePercentage > 15) → 'A'
else if (revenuePercentage >= 5 && revenuePercentage <= 15) → 'B'
else → 'C'
```

### Sorting and Grouping Rules

- Segment calculation is per-account (one segment per account)
- Accounts are processed independently
- Total revenue is calculated once for all accounts, then used for all percentage calculations
- No explicit sorting required (calculation is order-independent)

## Rules

**R1**: All segment information is based on total revenue for the selected year.

**R2**: Segment D assignment (highest priority): Account has NO Service type won estimates for selected year. D segment clients have Standard estimates only (or no estimates). If account has ANY Service estimates, it gets A/B/C based on revenue percentage.

**R3**: A, B, and C segment clients can have Standard estimate revenue as well as Service estimate revenue. Only D segment clients have no Service estimates.

**R4**: Segment D check uses only won estimates for the selected year. Historical years do not affect Segment D classification.

**R5**: Revenue percentage calculation: `(account.annual_revenue / totalRevenue) * 100`, where `totalRevenue` is sum of all accounts' `annual_revenue` for selected year.

**R6**: Segment A: Account represents more than 15% of total company revenue by year (`revenuePercentage > 15%`).

**R7**: Segment B: Account represents between 5% and 15% of total company revenue by year (`5% <= revenuePercentage <= 15%`).

**R8**: Segment C: Account represents less than 5% of total company revenue by year (`revenuePercentage < 5%`) OR no revenue data (default).

**R9**: Segment D: Account has no Service estimates (Standard estimates only or no estimates) for selected year.

**R10**: If `totalRevenue <= 0`, all accounts default to segment 'C'.

**R11**: If `account.annual_revenue` is `null` or `0`, segment defaults to 'C'.

**R12**: Segments are always read-only in all UI contexts. No manual override is available.

**R13**: Segment calculation uses stored `annual_revenue` field (revenue for selected year), not recalculated from estimates.

**R14**: Selected year is determined by YearSelectorContext (site-wide, user-selectable, persists in user profile).

**R15**: On account create, if `revenue_segment` is not provided, default to 'C'.

**R16**: When estimates are imported or updated, segments are automatically recalculated for all affected accounts. Segments are not preserved from previous values - they are always recalculated based on current revenue data for the selected year.

**R17**: Segments are automatically recalculated during import (after import completes).

**R18**: Manual segment recalculation is available to admins only via Settings page.

**R19**: Regular users cannot trigger segment recalculation.

**R20**: If segment recalculation fails during import, import continues (non-blocking). Failed updates are logged and user is notified.

**R21**: For accounts with both Standard and Service won estimates, revenue percentage for A/B/C segments is calculated from ALL won estimates (not just Service).

## Precedence and Conflict Resolution

### Segment Assignment Precedence

**Highest Priority**: Segment D Check
- If account has NO Service won estimates (selected year) → D
- If account has ANY Service won estimates (selected year) → proceed to percentage calculation

**Priority 2**: Percentage-Based Segments (A/B/C)
- Calculate `(accountRevenue / totalRevenue) * 100`
- If `> 15%` → A
- If `>= 5% and <= 15%` → B
- Otherwise → C

**Lowest Priority**: Default
- If no revenue data or calculation fails → C

### Conflict Examples

**Example 1: Segment D vs Percentage**
- Account has Standard won estimates ($10k) and Service won estimates ($5k) for selected year 2025
- **Resolution**: Has Service estimates → calculate percentage from ALL won estimates ($15k total) → assign A/B/C based on percentage (not D)

**Example 2: Zero Total Revenue**
- All accounts have `annual_revenue = 0` or `null` for selected year
- **Resolution**: `totalRevenue = 0` → all accounts default to segment 'C' (R10)

**Example 3: Missing Revenue Data**
- Account has no won estimates for selected year, `annual_revenue = null`
- **Resolution**: `annual_revenue` is null → segment defaults to 'C' (R11)

**Example 4: Historical Data Doesn't Affect Segment D**
- Account has Standard estimates in 2024, Service estimates in 2025, selected year = 2025
- **Resolution**: Check only 2025 won estimates → has Service → not Segment D → calculate percentage for A/B/C

**Example 5: Boundary Conditions**
- Account has exactly 15% of total revenue
- **Resolution**: `15% <= 15%` → Segment B (R7, not A because A requires > 15%)
- Account has exactly 5% of total revenue
- **Resolution**: `5% >= 5% and 5% <= 15%` → Segment B (R7)
- Account has 4.99% of total revenue
- **Resolution**: `4.99% < 5%` → Segment C (R8)

**Example 6: A/B/C with Standard Revenue**
- Account has both Standard ($20k) and Service ($80k) won estimates, total = $100k, total revenue = $500k
- **Resolution**: Has Service estimates → calculate percentage from ALL won estimates ($100k) → `(100k / 500k) * 100 = 20%` → Segment A (R3, R6, R21)

## Examples

### Example 1: Segment A (High Revenue)

**Input:**
```json
Account: {
  "id": "acc-001",
  "annual_revenue": 100000
}
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. Check Segment D: No estimates provided, assume has Service estimates (not D)
2. Calculate percentage: `(100000 / 500000) * 100 = 20%`
3. `20% > 15%` → Segment A

**Output:**
- Revenue segment: 'A'
- Rules: R5, R6

### Example 2: Segment B (Medium Revenue)

**Input:**
```json
Account: {
  "id": "acc-002",
  "annual_revenue": 50000
}
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. Calculate percentage: `(50000 / 500000) * 100 = 10%`
2. `10% >= 5% and 10% <= 15%` → Segment B

**Output:**
- Revenue segment: 'B'
- Rules: R5, R7

### Example 3: Segment C (Low Revenue)

**Input:**
```json
Account: {
  "id": "acc-003",
  "annual_revenue": 20000
}
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. Calculate percentage: `(20000 / 500000) * 100 = 4%`
2. `4% < 5%` → Segment C

**Output:**
- Revenue segment: 'C'
- Rules: R5, R8

### Example 4: Segment D (No Service Estimates)

**Input:**
```json
Account: {
  "id": "acc-004",
  "annual_revenue": 20000
}
Estimates (selected year 2025): [
  {
    "status": "won",
    "estimate_type": "Standard",
    "contract_end": "2025-05-01"
  },
  {
    "status": "won",
    "estimate_type": "Standard",
    "contract_end": "2025-08-01"
  }
]
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. Check Segment D: Has Standard won estimates, NO Service won estimates → Segment D
2. Skip percentage calculation

**Output:**
- Revenue segment: 'D'
- Rules: R2, R4, R9

### Example 5: Both Standard and Service (Not D, Segment B)

**Input:**
```json
Account: {
  "id": "acc-005",
  "annual_revenue": 30000
}
Estimates (selected year 2025): [
  {
    "status": "won",
    "estimate_type": "Standard",
    "contract_end": "2025-05-01"
  },
  {
    "status": "won",
    "estimate_type": "Service",
    "contract_end": "2025-08-01"
  }
]
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. Check Segment D: Has Service estimates → not D, proceed to percentage calculation
2. Calculate percentage: `(30000 / 500000) * 100 = 6%`
3. `6% >= 5% and 6% <= 15%` → Segment B

**Output:**
- Revenue segment: 'B'
- Rules: R2, R3, R5, R7, R21

### Example 6: No Revenue Data (Default to C)

**Input:**
```json
Account: {
  "id": "acc-006",
  "annual_revenue": null
}
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. `annual_revenue` is null → default to 'C'

**Output:**
- Revenue segment: 'C'
- Rules: R8, R11

### Example 7: Zero Total Revenue (All Default to C)

**Input:**
```json
Accounts: [
  { "id": "acc-007", "annual_revenue": 10000 },
  { "id": "acc-008", "annual_revenue": 5000 }
]
Total Revenue: $0 (all accounts have annual_revenue = 0 or null)
Selected Year: 2025
```

**Process:**
1. `totalRevenue = 0` → all accounts default to 'C'

**Output:**
- All accounts: segment 'C'
- Rules: R10

### Example 8: Segment A with Standard Revenue

**Input:**
```json
Account: {
  "id": "acc-009",
  "annual_revenue": 100000
}
Estimates (selected year 2025): [
  {
    "status": "won",
    "estimate_type": "Standard",
    "contract_end": "2025-05-01"
  },
  {
    "status": "won",
    "estimate_type": "Service",
    "contract_end": "2025-08-01"
  }
]
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. Check Segment D: Has Service estimates → not D, proceed to percentage calculation
2. Calculate percentage: `(100000 / 500000) * 100 = 20%` (includes both Standard and Service revenue)
3. `20% > 15%` → Segment A

**Output:**
- Revenue segment: 'A'
- Rules: R2, R3, R5, R6, R21

### Example 9: Exact 15% Boundary (Segment B)

**Input:**
```json
Account: {
  "id": "acc-010",
  "annual_revenue": 75000
}
Total Revenue: $500000
Selected Year: 2025
```

**Process:**
1. Calculate percentage: `(75000 / 500000) * 100 = 15%`
2. `15% >= 5% and 15% <= 15%` → Segment B (not A, because A requires > 15%)

**Output:**
- Revenue segment: 'B'
- Rules: R5, R7

## Acceptance Criteria

**AC1**: All segment information is based on total revenue for the selected year. (R1)

**AC2**: Segment D is assigned to accounts with no Service won estimates for selected year only. D segment clients have Standard estimates only (or no estimates). (R2, R4, R9)

**AC3**: A, B, and C segment clients can have Standard estimate revenue as well as Service estimate revenue. Only D segment clients have no Service estimates. (R3)

**AC4**: Segment A: Account represents more than 15% of total company revenue by year. (R6)

**AC5**: Segment B: Account represents between 5% and 15% of total company revenue by year. (R7)

**AC6**: Segment C: Account represents less than 5% of total company revenue by year OR no revenue data (default). (R8)

**AC7**: If total revenue is zero or account has no revenue data, segment defaults to 'C'. (R10, R11)

**AC8**: Segments are always read-only in all UI contexts. No manual override is available. (R12)

**AC9**: Segment calculation uses stored `annual_revenue` field (revenue for selected year), not recalculated from estimates. (R13)

**AC10**: Selected year is determined by YearSelectorContext and applies site-wide. (R14)

**AC11**: On account create, if segment is not provided, default to 'C'. (R15)

**AC12**: When estimates are imported or updated, segments are automatically recalculated for all affected accounts. Segments are not preserved - they are always recalculated based on current revenue data. (R16)

**AC13**: Segments are automatically recalculated during import (after import completes). (R17)

**AC14**: Manual segment recalculation is available to admins only via Settings page. (R18)

**AC15**: Regular users cannot trigger segment recalculation. (R19)

**AC16**: If segment recalculation fails during import, import continues (non-blocking), errors are logged, and user is notified. (R20)

**AC17**: For accounts with both Standard and Service won estimates, revenue percentage is calculated from ALL won estimates. (R21)

## Special Considerations

### Edge Cases

- **Zero Revenue**: Accounts with no won estimates for selected year default to Segment C
- **Exact Thresholds**: Exactly 15% → B (not A, because A requires > 15%), exactly 5% → B, 4.99% → C
- **Stale Data**: If `annual_revenue` is stale, segments may be incorrect until recalculation
- **Year Change**: When selected year changes, segments should be recalculated (requires revenue recalculation first)
- **No Estimates**: Account with no estimates defaults to 'C' (not D, because D requires Standard estimates)

### Exceptions

- **Import Failure**: If segment recalculation fails during import, import continues but user is notified
- **Missing Data**: If `annual_revenue` is missing, segment defaults to 'C' (no error thrown)
- **Read-Only Enforcement**: Segments cannot be manually edited in any UI context

### Backward Compatibility

- Existing accounts without segments default to 'C'
- Segment field must always have a value (never null in database)
- Manual recalculation is new feature - existing behavior (import-only) remains default

### Locale Considerations

- Segments displayed as single letters: 'A', 'B', 'C', 'D'
- No localization needed (segment values are universal)

### Accessibility

- Segment badges displayed with proper contrast
- Filter dropdown includes segment descriptions: "Segment A (>15%)", "Segment B (5-15%)", etc.

## Telemetry and Observability

### Key Events to Log

- Segment calculation start/completion (per account, per batch)
- Segment assignment (A/B/C/D classification counts)
- Segment recalculation trigger (import vs manual)
- Segment recalculation failures (with account IDs)
- Selected year changes (may trigger segment recalculation)

### Metrics to Monitor

- Segment distribution (A/B/C/D counts and percentages)
- Segment recalculation duration (per account, per batch)
- Segment recalculation failure rate
- Zero revenue account count (defaulting to C)
- Segment D account count

### Error Conditions

- Segment recalculation failures (log account IDs and errors)
- Missing `annual_revenue` data (log but default to C)
- Zero total revenue (log but default all to C)
- Invalid segment values (should not occur, but log if happens)

## Open Questions for the Product Owner

~~All questions answered by product owner:~~

1. **Revenue Terminology**: ✅ **ANSWERED**: `annual_revenue` stores revenue for selected year (not necessarily current calendar year). Total revenue is sum of all accounts' revenue for selected year. (R1, R5, R13)

2. **Manual Recalculation Access**: ✅ **ANSWERED**: Only admins can trigger manual recalculation. Regular users cannot. (R18, R19, AC14, AC15)

3. **Segment D Year Scope**: ✅ **ANSWERED**: Segment D check uses selected year only. Historical years do not affect classification. (R2, R4, AC2)

4. **Read-Only Enforcement**: ✅ **ANSWERED**: Segments are always read-only in all UI contexts. No manual override. (R12, AC8)

5. **Import Failure Handling**: ✅ **ANSWERED**: If segment recalculation fails during import, import continues (non-blocking), errors are logged, and user is notified. (R20, AC16)

6. **Segment Rules Clarification**: ✅ **ANSWERED**: All segment information is based on total revenue for selected year. A segment: >15%, B segment: 5-15%, C segment: <5%, D segment: no Service estimates (Standard only). A/B/C can have Standard revenue, but D cannot have Service estimates. (R1, R2, R3, R6, R7, R8, R9)

## Change Control

This spec governs segment assignment, display, filtering, and recalculation behavior across the application.

Any change requires explicit product owner approval before editing this file.

## References

- Revenue Logic Spec: `docs/sections/revenue-logic.md` (for revenue calculation details)
- Year Selection System Spec: `docs/sections/year-selection-system.md` (for selected year determination)
- Accounts Spec: `docs/sections/accounts.md` (for account data structure and display)
- Revenue Segment Calculator: `src/utils/revenueSegmentCalculator.js`
- Accounts Page: `src/pages/Accounts.jsx`
- Settings Page: `src/pages/Settings.jsx`
- Import Dialog: `src/components/ImportLeadsDialog.jsx`

