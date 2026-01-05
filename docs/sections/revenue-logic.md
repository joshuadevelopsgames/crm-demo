# Revenue Logic Specification

**Version**: 2.0.0  
**Last Updated**: 2025-01-XX  
**Status**: Authoritative

## Purpose

This document defines how revenue is calculated, displayed, and used for segment assignment across the application. Revenue calculations determine account financial value, drive revenue segment classification (A/B/C/D), and support reporting and analytics.

## Data Contract

### Sources

- **Estimates Table**: Primary source for revenue data
  - `status` (text): Estimate status, must be "won" (case-insensitive) to count
  - `total_price_with_tax` (numeric): Primary price field for revenue calculations
  - `total_price` (numeric): Fallback price field if `total_price_with_tax` is missing/zero
  - `contract_end` (date): Priority 1 for year determination (per Estimates spec R2)
  - `contract_start` (date): Priority 2 for year determination (per Estimates spec R2)
  - `estimate_close_date` (date): Deprecated, no longer used for year determination priority
  - `contract_start` (date): Contract start date, used for annualization and year fallback
  - `contract_end` (date): Contract end date, used for annualization
  - `estimate_date` (date): Fallback date for year determination
  - `created_date` (date): Last fallback date for year determination
  - `estimate_type` (text): "Standard" (project/one-time) or "Service" (ongoing/recurring)
  - `account_id` (text): Links estimate to account

- **Accounts Table**: Stores calculated revenue and segments
  - `annual_revenue` (numeric): Stored revenue value for selected year (calculated during import, backward compatibility)
  - `revenue_segment` (text): Segment classification ('A', 'B', 'C', or 'D')
  - `revenue_by_year` (jsonb, optional): Historical revenue by year `{ "2024": 50000, "2025": 75000, ... }` (calculated during import for all years)

- **Selected Year**: Determined by YearSelectorContext (site-wide, user-selectable, persists in user profile)
  - User can select any year from available years
  - Selection persists across sessions
  - All revenue calculations and displays use selected year

### Fields Used

**Required Fields:**
- `status`: Must be "won" (case-insensitive) for revenue inclusion (per Estimates spec R1, R11: uses isWonStatus which respects pipeline_status priority)
- At least one date field: `contract_end`, `contract_start`, `estimate_date`, or `created_date` (per Estimates spec R2)
- At least one price field: `total_price_with_tax` or `total_price`

**Optional Fields:**
- `contract_start` + `contract_end`: Used for multi-year contract annualization
- `estimate_type`: Used for Segment D classification

### Types and Units

- **Revenue**: Numeric (USD), stored as `numeric(12,2)` in database
- **Dates**: ISO 8601 date strings or Date objects
- **Selected Year**: Integer (e.g., 2024, 2025)
- **Contract Duration**: Integer (months)
- **Contract Years**: Integer (1, 2, 3, etc.)

### Nullability Assumptions

- `annual_revenue`: Can be `null` if account has no won estimates for selected year
- `revenue_segment`: Defaults to 'C' if missing or no revenue data
- Date fields: At least one must be present (per data validation)
- Price fields: If both are missing/zero, estimate is excluded from revenue

## Logic

### Ordered End-to-End Flow

1. **Get Selected Year**
   - Retrieve from YearSelectorContext (site-wide, user-selectable)
   - Selected year is required (no fallback to calendar year)

2. **Filter Estimates**
   - Only include estimates where `isWonStatus(estimate)` returns true (per Estimates spec R1, R11: respects pipeline_status priority)
   - Only include estimates that apply to selected year (see Year Determination)

3. **Determine Year for Each Estimate** (Priority Order - per Estimates spec R2)
   - Priority 1: `contract_end` (primary)
   - Priority 2: `contract_start` (fallback)
   - Priority 3: `estimate_date` (fallback)
   - Priority 4: `created_date` (fallback)
   - If estimate applies to selected year, proceed; otherwise exclude

4. **Select Price Field**
   - Prefer `total_price_with_tax`
   - If missing/zero, fallback to `total_price`
   - Show toast notification once per session if fallback is used
   - If both missing/zero, exclude estimate from revenue

5. **Calculate Contract Duration** (if both `contract_start` and `contract_end` exist)
   - Calculate months: `(endYear - startYear) * 12 + (endMonth - startMonth)`
   - If `endDay > startDay`, add 1 month
   - If `endDay === startDay`, do NOT add 1 (exact N*12 months)

6. **Determine Contract Years**
   - `durationMonths ≤ 12` → `years = 1`
   - `12 < durationMonths ≤ 24` → `years = 2`
   - `24 < durationMonths ≤ 36` → `years = 3`
   - If `durationMonths % 12 === 0`: `years = durationMonths / 12` (exact multiple, no rounding)
   - Otherwise: `years = Math.ceil(durationMonths / 12)`

7. **Annualize Multi-Year Contracts**
   - If both `contract_start` and `contract_end` exist:
     - `annualAmount = totalPrice / contractYears`
     - Allocate to calendar years: `[startYear, startYear+1, ..., startYear+(years-1)]`
     - If selected year is in allocation, use `annualAmount`; otherwise 0
   - If only `contract_start` exists: use full price for that year
   - If no contract dates: use full price for determined year

8. **Calculate Account Revenue** (during import only)
   - Sum all annualized values for won estimates that apply to each year
   - Calculated for ALL years (not just selected year)
   - If no won estimates for a year → 0 for that year

9. **Store Revenue by Year** (during import only)
   - Store calculated revenue in `revenue_by_year` JSONB field: `{ "2024": 50000, "2025": 75000, ... }`
   - Each account has revenue stored for all years that have won estimates
   - `annual_revenue` field stores value for selected year only (backward compatibility)

10. **Calculate Historical Revenue** (during import only)
    - For each account, calculate revenue for ALL years (not just current year)
    - Store results in `revenue_by_year` JSONB field: `{ "2024": 50000, "2025": 75000, ... }`
    - `annual_revenue` field stores value for current year only

11. **Assign Revenue Segment**
    - Check for Segment D first (project-only accounts)
    - If not D, calculate percentage: `(accountRevenue / totalRevenue) * 100` (using ALL won estimates)
    - Assign A/B/C based on percentage thresholds

### Transformations in Sequence

1. **Year Determination**: Date field selection → Extract year → Compare to selected year
2. **Price Selection**: `total_price_with_tax` → `total_price` (fallback) → Exclude if both missing
3. **Duration Calculation**: Contract dates → Months → Years
4. **Annualization**: Total price → Divide by years → Allocate to calendar years
5. **Revenue Aggregation**: Sum annualized values per account
6. **Segment Calculation**: Revenue percentage → Threshold comparison

### Computations and Formulas

**Contract Duration (Months):**
```
durationMonths = (endYear - startYear) * 12 + (endMonth - startMonth)
if (endDay > startDay) {
  durationMonths += 1
}
```

**Contract Years:**
```
if (durationMonths <= 12) return 1
if (durationMonths <= 24) return 2
if (durationMonths <= 36) return 3
if (durationMonths % 12 === 0) return durationMonths / 12
return Math.ceil(durationMonths / 12)
```

**Annualized Revenue:**
```
annualAmount = totalPrice / contractYears
```

**Revenue Percentage:**
```
revenuePercentage = (accountRevenue / totalRevenue) * 100
```

### Sorting and Grouping Rules

- Revenue calculations are per-account (grouped by `account_id`)
- Estimates are filtered by status and year before aggregation
- No explicit sorting required for calculations (sum is order-independent)

## Rules

**R1**: Only estimates with `status.toLowerCase() === 'won'` are included in revenue calculations.

**R2**: Year determination uses priority order: `contract_end` → `contract_start` → `estimate_date` → `created_date` (per Estimates spec R2).

**R3**: Price field selection: Prefer `total_price_with_tax`, fallback to `total_price` if missing/zero.

**R4**: If `total_price_with_tax` is missing/zero and `total_price` is used, show toast notification once per session.

**R5**: If both price fields are missing/zero, exclude estimate from revenue calculations.

**R6**: Contract duration calculation: `durationMonths = (endYear - startYear) * 12 + (endMonth - startMonth)`. If `endDay > startDay`, add 1 month. If `endDay === startDay`, do NOT add 1 (exact N*12 months).

**R7**: Contract years calculation: Use tiered logic (≤12→1, ≤24→2, ≤36→3) or exact division for multiples of 12, otherwise `Math.ceil()`.

**R8**: Multi-year contracts are annualized: `annualAmount = totalPrice / contractYears`.

**R9**: Multi-year contract revenue is allocated to sequential calendar years starting from `contract_start` year: `[startYear, startYear+1, ..., startYear+(years-1)]`.

**R10**: If estimate applies to selected year, include annualized value; otherwise exclude (value = 0).

**R11**: Account revenue is sum of annualized values for all won estimates that apply to current year.

**R12**: If account has no won estimates for current year, revenue = 0 (displays as "-" in UI).

**R12b**: If account has no won estimates for selected year, stored revenue = 0 (displays as "-" in UI).

**R13**: `revenue_by_year` field is calculated and stored during import only. It is NOT updated by database triggers when estimates change.

**R13a**: `annual_revenue` field stores value for selected year only (backward compatibility, also calculated during import).

**R14**: Total revenue for segment calculation is sum of all accounts' stored `revenue_by_year[selectedYear]` fields (not recalculated from estimates).

**R15**: Segment D assignment: Account has "Standard" type won estimates AND no "Service" type won estimates (selected year only). If account has BOTH Standard and Service, it gets A/B/C based on revenue percentage calculated from ALL won estimates (not just Service).

**R16**: Segment A: `(accountRevenue / totalRevenue) * 100 >= 15%`.

**R17**: Segment B: `5% <= (accountRevenue / totalRevenue) * 100 < 15%`.

**R18**: Segment C: `(accountRevenue / totalRevenue) * 100 < 5%` OR no revenue data (default).

**R19**: Revenue segment calculation uses stored `annual_revenue` field, not recalculated from estimates.

**R20**: Typo detection: Contracts where `durationMonths % 12 === 1` (e.g., 13, 25, 37 months) are flagged as advisory warnings. Typo detection does NOT change contract years calculation.

**R21**: Selected year is determined by YearSelectorContext (site-wide, user-selectable, persists in user profile).

**R22**: Every estimate must have at least one date field (`contract_end`, `contract_start`, `estimate_date`, or `created_date`). Use fallback priority if primary date is missing.

**R23**: Year selector selection persists across sessions (stored in user profile). Selected year applies site-wide until changed.

**R24**: Manual "Recalculate Revenue" button available for admins to refresh `annual_revenue` values without full import. Recalculation updates `annual_revenue` for selected year and `revenue_by_year` for all years.

**R25**: On import, revenue is calculated for ALL years (not just selected year). Results stored in `revenue_by_year` JSONB field: `{ "2024": 50000, "2025": 75000, ... }`. `annual_revenue` field stores value for selected year only.

**R26**: For accounts with both Standard and Service won estimates, revenue percentage for A/B/C segments is calculated from ALL won estimates (not just Service).

## Precedence and Conflict Resolution

### Year Determination Priority

**Highest Priority**: `contract_end` (per Estimates spec R2)
- If present and valid → use this year
- If missing/invalid → fall to next priority

**Priority 2**: `contract_start`
- If present and valid → use this year
- If missing/invalid → fall to next priority

**Priority 3**: `estimate_date`
- If present and valid → use this year
- If missing/invalid → fall to next priority

**Lowest Priority**: `created_date`
- If present and valid → use this year
- If missing/invalid → estimate has no valid date (should not occur per data validation)

### Price Field Selection

**Prefer**: `total_price_with_tax`
- If present and > 0 → use this
- If missing/zero → fall to fallback

**Fallback**: `total_price`
- If present and > 0 → use this (show toast once per session)
- If missing/zero → exclude estimate

### Segment Assignment Precedence

1. **Segment D Check** (highest priority)
   - If account has "Standard" won estimates AND no "Service" won estimates (selected year) → D
   - If account has BOTH Standard and Service → proceed to percentage calculation

2. **Percentage-Based Segments** (A/B/C)
   - Calculate `(accountRevenue / totalRevenue) * 100`
   - If `>= 15%` → A
   - If `>= 5% and < 15%` → B
   - Otherwise → C

### Conflict Examples

**Example 1: Multiple Date Fields**
- Estimate has `contract_end = 2025-06-30` and `contract_start = 2025-06-01`
- **Resolution**: Use `contract_end = 2025` (Priority 1, per Estimates spec R2) → applies to 2025

**Example 2: Price Field Fallback**
- Estimate has `total_price_with_tax = 0` and `total_price = 50000`
- **Resolution**: Use `total_price` (fallback) → show toast once per session

**Example 3: Segment D vs Percentage**
- Account has Standard won estimates ($10k) and Service won estimates ($5k) for selected year
- **Resolution**: Has BOTH types → calculate percentage from ALL won estimates ($15k total) → assign A/B/C based on percentage (not D)

**Example 4: Exact 12-Month Contract**
- Contract: `2024-04-15` to `2025-04-15` (exactly 12 months, same day)
- **Resolution**: `durationMonths = 12` (not 13) → `contractYears = 1` → full price for 2024

**Example 5: Multi-Year Allocation**
- Contract: `2024-01-01` to `2026-12-31`, total price $300k, selected year = 2025
- **Resolution**: `durationMonths = 35` → `contractYears = 3` → `annualAmount = $100k` → allocated to [2024, 2025, 2026] → 2025 gets $100k

## Examples

### Example 1: Single-Year Won Estimate

**Input:**
```json
{
  "id": "est-001",
  "status": "won",
  "total_price_with_tax": 50000,
  "contract_end": "2025-03-31",
  "contract_start": "2024-04-01",
  "estimate_date": "2024-03-15",
  "account_id": "acc-001"
}
```
Current year: 2024

**Process:**
1. Status is "won" → included
2. Year determination: `contract_end = 2025` (Priority 1, per Estimates spec R2) → does NOT apply to 2024
3. Price: `total_price_with_tax = 50000`
4. Contract duration: 12 months → 1 year
5. Annualization: `50000 / 1 = 50000`
6. Allocation: 2024 gets $50000

**Output:**
- Account revenue: $50,000
- Rules: R1, R2, R3, R6, R7, R8, R9, R10, R11

### Example 2: Multi-Year Contract

**Input:**
```json
{
  "id": "est-002",
  "status": "won",
  "total_price_with_tax": 300000,
  "contract_end": "2027-06-30",
  "contract_start": "2024-07-01",
  "estimate_date": "2024-06-01",
  "account_id": "acc-002"
}
```
Current year: 2025

**Process:**
1. Status is "won" → included
2. Year determination: `contract_end = 2027` (Priority 1, per Estimates spec R2) → does NOT apply to 2025
3. **Wait**: Check contract allocation
4. Contract duration: 35 months → 3 years
5. Annualization: `300000 / 3 = 100000`
6. Allocation: [2024, 2025, 2026] → 2025 is included
7. Use contract allocation: 2025 gets $100,000

**Output:**
- Account revenue: $100,000
- Rules: R1, R2, R6, R7, R8, R9, R10, R11

### Example 3: Price Fallback

**Input:**
```json
{
  "id": "est-003",
  "status": "won",
  "total_price_with_tax": 0,
  "total_price": 75000,
  "contract_end": null,
  "contract_start": null,
  "estimate_date": "2024-08-15",
  "account_id": "acc-003"
}
```
Current year: 2024

**Process:**
1. Status is "won" → included
2. Year determination: `contract_end` and `contract_start` are null, so uses `estimate_date = 2024` (Priority 3, per Estimates spec R2) → applies to 2024
3. Price: `total_price_with_tax = 0` → fallback to `total_price = 75000`
4. Show toast: "Some estimates are missing tax-inclusive prices..."
5. No contract dates → use full price

**Output:**
- Account revenue: $75,000
- Toast notification shown (once per session)
- Rules: R1, R2, R3, R4, R11

### Example 4: Segment D (Project Only)

**Input:**
```json
Account: {
  "id": "acc-004",
  "annual_revenue": 20000
}
Estimates: [
  {
    "status": "won",
    "estimate_type": "Standard",
    "contract_end": null,
    "contract_start": null,
    "estimate_date": "2024-05-01"
  },
  {
    "status": "won",
    "estimate_type": "Standard",
    "contract_end": null,
    "contract_start": null,
    "estimate_date": "2024-08-01"
  }
]
Total Revenue: $500000
```
Selected year: 2024

**Process:**
1. Check Segment D: Has "Standard" won estimates, no "Service" won estimates → Segment D
2. Skip percentage calculation

**Output:**
- Revenue segment: 'D'
- Rules: R15

### Example 5: Segment A (High Revenue)

**Input:**
```json
Account: {
  "id": "acc-005",
  "annual_revenue": 100000
}
Total Revenue: $500000
```
Selected year: 2024

**Process:**
1. Check Segment D: No estimates provided, assume not D
2. Calculate percentage: `(100000 / 500000) * 100 = 20%`
3. `20% >= 15%` → Segment A

**Output:**
- Revenue segment: 'A'
- Rules: R14, R16

### Example 6: Segment B (Medium Revenue)

**Input:**
```json
Account: {
  "id": "acc-006",
  "annual_revenue": 50000
}
Total Revenue: $500000
```
Selected year: 2024

**Process:**
1. Calculate percentage: `(50000 / 500000) * 100 = 10%`
2. `10% >= 5% and 10% < 15%` → Segment B

**Output:**
- Revenue segment: 'B'
- Rules: R14, R17

### Example 7: Segment C (Low Revenue)

**Input:**
```json
Account: {
  "id": "acc-007",
  "annual_revenue": 20000
}
Total Revenue: $500000
```
Selected year: 2024

**Process:**
1. Calculate percentage: `(20000 / 500000) * 100 = 4%`
2. `4% < 5%` → Segment C

**Output:**
- Revenue segment: 'C'
- Rules: R14, R18

### Example 8: No Won Estimates

**Input:**
```json
Account: {
  "id": "acc-008",
  "annual_revenue": 0
}
Estimates: [
  {
    "status": "lost",
    "contract_end": null,
    "contract_start": null,
    "estimate_date": "2024-03-01"
  }
]
```
Current year: 2024

**Process:**
1. No won estimates → revenue = 0
2. Display as "-" in UI

**Output:**
- Account revenue: 0 (displays as "-")
- Rules: R1, R11, R12

## Acceptance Criteria

**AC1**: Only won estimates (case-insensitive) are included in revenue calculations. (R1)

**AC2**: Year determination uses priority order: `contract_end` → `contract_start` → `estimate_date` → `created_date` (per Estimates spec R2). (R2)

**AC3**: Price field selection prefers `total_price_with_tax`, falls back to `total_price` if missing/zero, shows toast once per session. (R3, R4)

**AC4**: Estimates with both price fields missing/zero are excluded from revenue. (R5)

**AC5**: Contract duration calculation handles exact 12-month contracts correctly (12 months, not 13). (R6)

**AC6**: Contract years use tiered logic (≤12→1, ≤24→2, ≤36→3) or exact division for multiples of 12. (R7)

**AC7**: Multi-year contracts are annualized by dividing total price by contract years. (R8)

**AC8**: Multi-year contract revenue is allocated to sequential calendar years starting from contract start year. (R9)

**AC9**: Account revenue is sum of annualized values for won estimates that apply to current year. (R11)

**AC10**: Accounts with no won estimates for current year have revenue = 0 (displays as "-"). (R12)

**AC11**: `revenue_by_year` field is calculated and stored during import only, not updated by triggers. (R13)

**AC11a**: `annual_revenue` field stores value for selected year only (backward compatibility). (R13a)

**AC12**: Total revenue for segment calculation is sum of all accounts' stored `revenue_by_year[selectedYear]` fields. (R14)

**AC13**: Segment D is assigned to accounts with "Standard" won estimates and no "Service" won estimates (selected year only). (R15)

**AC14**: Segment A/B/C are assigned based on revenue percentage thresholds (≥15%→A, 5-15%→B, <5%→C). (R16, R17, R18)

**AC15**: Revenue segment calculation uses stored `annual_revenue` field, not recalculated from estimates. (R19)

**AC16**: Typo detection flags contracts with duration % 12 === 1 as advisory warnings only. (R20)

**AC17**: Selected year is determined by YearSelectorContext (site-wide, user-selectable, persists in user profile). (R21)

**AC18**: Every estimate has at least one date field, using fallback priority if primary is missing. (R22)

**AC19**: Year selector selection persists across sessions (stored in user profile). (R23)

**AC20**: Manual "Recalculate Revenue" button available for admins refreshes `annual_revenue` and `revenue_by_year` without full import. (R24)

**AC21**: On import, revenue is calculated for all years and stored in `revenue_by_year` JSONB field. (R25)

**AC22**: For accounts with both Standard and Service won estimates, revenue percentage is calculated from ALL won estimates. (R26)

## Special Considerations

### Edge Cases

- **Zero Revenue**: Accounts with no won estimates display "-" in UI, default to Segment C
- **Exact Year Boundaries**: Contracts ending exactly on start date + N years are calculated as N years (not N+1)
- **Typo Detection**: Advisory only, does not affect calculations
- **Price Fallback**: Toast notification shown once per session to avoid spam

### Exceptions

- **No Contract Dates**: Use full price for determined year (no annualization)
- **Missing Dates**: Should not occur per data validation, but fallback priority handles gracefully
- **Both Price Fields Zero**: Estimate excluded from revenue (no error thrown)

### Backward Compatibility

- `revenue_by_year` field is calculated and stored during import - existing accounts will have it populated on next import
- `annual_revenue` field stores value for selected year only (backward compatibility, also calculated during import)
- Revenue segment defaults to 'C' if missing (preserves existing behavior)
- Test mode will be replaced with year selector (behavior change requires spec approval)
- `revenue_by_year` field is new - existing accounts will have it populated on next import
- Manual recalculation button is new feature - existing behavior (import-only) remains default

### Locale Considerations

- Revenue displayed in USD format: `$${revenue.toLocaleString()}`
- Dates parsed as ISO 8601 strings or Date objects
- No timezone conversion (dates used as-is)

### Accessibility

- Revenue values displayed with proper formatting for screen readers
- "-" displayed for zero revenue (clear indication of no data)

## Telemetry and Observability

### Key Events to Log

- Revenue calculation start/completion (per account)
- Price field fallback usage (toast trigger)
- Typo detection warnings (advisory flags)
- Segment assignment (A/B/C/D classification)
- Import revenue calculation (bulk operation)

### Metrics to Monitor

- Revenue calculation duration (per account, per import)
- Price fallback frequency (how often `total_price` is used)
- Typo detection rate (contracts with duration % 12 === 1)
- Segment distribution (A/B/C/D counts)
- Zero revenue account count
- Multi-year contract count and average duration

### Error Conditions

- Missing date fields (should not occur, but log if happens)
- Invalid date parsing (log and exclude estimate)
- Division by zero in annualization (should not occur, but log if happens)
- Negative revenue values (should not occur, but log if happens)

## Open Questions for the Product Owner

~~All questions answered by product owner:~~

1. **Year Selector Implementation**: ✅ **ANSWERED**: Selected year persists across sessions (stored in user profile). (R23, AC19)

2. **Revenue Recalculation**: ✅ **ANSWERED**: Yes, manual "Recalculate Revenue" button for admins. (R24, AC20)

3. **Historical Revenue**: ✅ **ANSWERED**: Yes, on import revenue is calculated for all years and stored in `revenue_by_year` JSONB field. (R25, AC21)

4. **Segment D Clarification**: ✅ **ANSWERED**: Revenue percentage calculated from ALL won estimates (not just Service). (R26, AC22)

## Change Control

This spec governs revenue calculation, display, and segment assignment behavior across the application.

Any change requires explicit product owner approval before editing this file.

## References

- Accounts Spec: `docs/sections/accounts.md`
- Revenue Segment Calculator: `src/utils/revenueSegmentCalculator.js`
- Total Work Component: `src/components/account/TotalWork.jsx`
- Import Logic: `src/utils/lmnMergeData.js`
- Test Mode Context: `src/contexts/TestModeContext.jsx` (to be replaced with year selector)

