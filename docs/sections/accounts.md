# Accounts Spec

**Version**: 2.0.0  
**Last Updated**: 2025-01-XX  
**Status**: Authoritative

## Purpose

The Accounts section provides the central hub for managing all company accounts in the CRM. It enables users to view, filter, search, and sort accounts by various criteria including type, revenue segment, status, organization score, and last interaction date. The section calculates and displays revenue from won estimates, assigns revenue segments based on selected year revenue percentages, and integrates with at-risk account detection for proactive renewal management.

## Data contract

### Sources

- **Accounts table** (`accounts`): Primary source for all account data
  - `id` (text, PK) - Account identifier
  - `lmn_crm_id` (text, UNIQUE) - LMN CRM identifier for matching during imports
  - `name` (text) - Account name (required)
  - `account_type` (text) - Type: 'prospect', 'customer', 'renewal', 'churned', 'client', 'lead', etc.
  - `status` (text) - Status: 'active', 'archived', 'at_risk', 'negotiating', 'onboarding', 'churned'
  - `revenue_segment` (text) - Revenue segment: 'A', 'B', 'C', 'D'
  - `annual_revenue` (numeric) - Stored annual revenue for selected year (used for segment calculation, backward compatibility)
  - `organization_score` (numeric) - ICP scorecard score (0-100)
  - `tags` (text[]) - Array of tags for additional categorization
  - `archived` (boolean) - Archive flag (preferred over status='archived')
  - `last_interaction_date` (timestamptz) - Last contact/interaction date
  - `renewal_date` (timestamptz) - Contract renewal date
  - `snoozed_until` (timestamptz) - Snooze expiration date
  - Address fields: `address_1`, `address_2`, `city`, `state`, `postal_code`, `country`
  - `created_date`, `created_at`, `updated_at` (timestamptz)

- **Estimates table** (`estimates`): Used for revenue calculation and user filtering
  - `id` (text, PK)
  - `account_id` (text, FK) - Links to accounts
  - `status` (text) - Must be 'won' (case-insensitive) for revenue calculation
  - `total_price` (numeric) - Base price (fallback if total_price_with_tax missing)
  - `total_price_with_tax` (numeric) - Tax-inclusive price (preferred)
  - `contract_start` (timestamptz) - Contract start date
  - `contract_end` (timestamptz) - Contract end date
  - `estimate_date` (timestamptz) - Estimate date
  - `contract_end` (timestamptz) - Contract end date (Priority 1 for year determination, per Estimates spec R2)
  - `estimate_close_date` (timestamptz) - Estimate close date (deprecated, no longer used for year determination priority)
  - `created_date` (timestamptz) - Created date (fallback for year determination)
  - `estimate_type` (text) - 'Standard' (project) or 'Service' (ongoing)
  - `salesperson` (text) - Salesperson name
  - `estimator` (text) - Estimator name

- **Contacts table** (`contacts`): Used to determine which accounts have contacts
  - `account_id` (text, FK) - Links to accounts

- **Scorecards table** (`scorecards`): Used to determine which accounts have completed scorecards
  - `account_id` (text, FK)
  - `completed_date` (timestamptz) - Must be non-null for account to have scorecard

- **Notification cache** (`notification_cache`): Used for at-risk account filtering
  - `cache_key` = 'at-risk-accounts'
  - `cache_data` (jsonb) - Array of at-risk account records

- **Notification snoozes** (`notification_snoozes`): Used to filter out snoozed at-risk accounts
  - `notification_type` (text) - 'at-risk-account'
  - `related_account_id` (text, FK)
  - `snoozed_until` (timestamptz)

### Fields Used

#### Required
- `accounts.id` - Account identifier (required)
- `accounts.name` - Account name (required for creation)

#### Optional but Important
- `accounts.account_type` - Defaults to 'prospect' on creation
- `accounts.status` - Defaults to 'active' on creation
- `accounts.revenue_segment` - Defaults to 'C' if missing
- `accounts.archived` - Archive flag (boolean, preferred over status='archived')
- `estimates.total_price_with_tax` - Preferred for revenue calculation
- `estimates.total_price` - Fallback if total_price_with_tax missing
- `estimates.contract_start`, `contract_end` - Used for multi-year contract annualization

### Types and Units

- **Dates**: All dates stored as timestamptz (UTC) in database
- **Revenue**: Numeric(12,2) - Currency values in dollars
- **Revenue segments**: Single character 'A', 'B', 'C', or 'D'
- **Organization score**: Numeric 0-100
- **Time zone**: UTC for database storage, local time for display

### Nullability Assumptions

- `accounts.name` must be non-null (enforced by UI)
- `accounts.revenue_segment` defaults to 'C' if null
- `estimates.total_price_with_tax` can be null (falls back to `total_price`)
- `estimates.contract_start` and `contract_end` can be null (uses other date fields)
- `accounts.archived` defaults to `false` if null

## Logic

### Ordered End-to-End Flow

1. **Data Fetching** (Accounts page load)
   - Fetch all accounts from `/api/data/accounts` (paginated, max 100k accounts)
   - Fetch all contacts to determine accounts with contacts
   - Fetch all estimates for revenue calculation and user filtering
   - Fetch all scorecards to determine accounts with completed scorecards
   - If filtering by at-risk: Fetch from `/api/notifications?type=at-risk-accounts`
   - If filtering by at-risk: Fetch notification snoozes

2. **Archive Status Filtering** (First filter applied)
   - Determine if account is archived: `account.archived === true` OR `account.status === 'archived'`
   - If `archived` boolean is `true`, account is archived (preferred)
   - If `status === 'archived'`, account is archived (fallback)
   - Active tab: Show non-archived accounts
   - Archived tab: Show archived accounts
   - At-risk filter: Excludes archived accounts

3. **Status Filtering** (If URL parameter present)
   - If `statusFilter === 'at_risk'`:
     - Use `notification_cache` data (not `account.status`)
     - Exclude archived accounts
     - Exclude snoozed accounts (where `snoozed_until > now()`)
   - If `statusFilter === 'archived'`: Show only archived accounts
   - If `statusFilter` is other status: Show non-archived accounts with that status
   - If no `statusFilter`: Use activeTab logic

4. **Type Filtering**
   - Check `account.account_type` (case-insensitive)
   - Check `account.tags` array/string
   - Type mappings:
     - `customer` filter matches: `account_type === 'customer'` OR `account_type === 'client'` OR tags include 'client'/'customer'
     - `prospect` filter matches: `account_type === 'prospect'` OR `account_type === 'lead'` OR tags include 'lead'/'prospect'
     - Other types match directly

5. **Segment Filtering**
   - Match `account.revenue_segment` exactly ('A', 'B', 'C', 'D')

6. **User Filtering**
   - If users selected: Only show accounts with estimates where `salesperson` OR `estimator` matches selected users
   - OR logic: Account matches if ANY estimate has matching salesperson OR estimator

7. **Search Filtering**
   - Case-insensitive substring match on `account.name`

8. **Sorting**
   - `name`: Alphabetical by `account.name`
   - `score`: Descending by `organization_score` (only accounts with completed scorecards)
   - `revenue`: Descending by calculated revenue from won estimates
   - `last_interaction`: Accounts with contacts prioritized, then by `last_interaction_date` descending

9. **Revenue Calculation** (For display and segment assignment)
   - Source: Won estimates for current year (year-based, not rolling 12 months)
   - Year determination priority (per Estimates spec R2):
     1. `contract_end` (primary)
     2. `contract_start` (fallback)
     3. `estimate_date` (fallback)
     4. `created_date` (fallback)
     5. If none: Assumes current year
   - Price field priority:
     1. `total_price_with_tax` (preferred)
     2. `total_price` (fallback if total_price_with_tax missing/zero)
   - Multi-year contracts: Annualized (total price divided by contract years)
   - Contract years calculation: See Contract Duration section

10. **Revenue Segment Assignment**
    - Segment A: ≥15% of total revenue (selected year)
    - Segment B: 5-15% of total revenue (selected year)
    - Segment C: 0-5% of total revenue (selected year)
    - Segment D: Project only (has "Standard" type estimates but no "Service" type estimates)
    - Uses stored `annual_revenue` field (not calculated on-the-fly)
    - Default: 'C' if missing or no revenue data
    - Auto-triggered on import, manual trigger in Admin Settings

### Transformations

1. **Archive Status**: `account.archived === true || account.status === 'archived'` (boolean preferred)
2. **Type Matching**: Case-insensitive comparison, checks both `account_type` and `tags`
3. **Revenue Calculation**: Sum of won estimates for selected year, annualized for multi-year contracts
4. **Segment Calculation**: Percentage of total revenue across all accounts
5. **User Filtering**: OR logic (salesperson OR estimator matches)

### Computations and Formulas

- **Account Revenue**: Sum of `getEstimateYearData(estimate, selectedYear).value` for all won estimates
- **Total Revenue**: Sum of all accounts' `annual_revenue` field
- **Revenue Percentage**: `(account.annual_revenue / totalRevenue) * 100`
- **Contract Duration**: See Contract Duration section
- **Contract Years**: See Contract Duration section
- **Days Since Last Contact**: `differenceInDays(today, last_interaction_date)`

## Contract Duration and Typo Detection

### Contract Duration Calculation

Contract duration is calculated in whole months before converting to years.

**Duration Calculation**:
- Calculate raw duration: `(endYear - startYear) * 12 + (endMonth - startMonth)`
- Add 1 month if `endDate > startDate` (end day is after start day)
- If `endDate === startDate` (same day), don't add 1 (exact N*12 months)

**Contract Years Determination**:
- If `duration_months ≤ 12`: `contract_years = 1`
- If `12 < duration_months ≤ 24`: `contract_years = 2`
- If `24 < duration_months ≤ 36`: `contract_years = 3`
- If `duration_months` is exact multiple of 12: `contract_years = duration_months / 12` (no rounding)
- Otherwise: `contract_years = ceil(duration_months / 12)`

**Typo Detection**:
- Calculate `remainder_months = duration_months % 12`
- If `remainder_months === 1`: Flag as potential typo
- Typo detection does NOT change calculated `contract_years`
- Typo detection is advisory only (does not block saving or reporting)
- Examples of flagged durations: 13 months, 25 months, 37 months (1 month over exact year boundary)

## Rules

### Archive Status Rules

- **R1**: Account is archived if `account.archived === true` OR `account.status === 'archived'`
- **R2**: If both `archived` boolean and `status === 'archived'` exist, `archived` boolean takes precedence
- **R3**: Archived accounts are excluded from at-risk filtering
- **R4**: Archived accounts can be viewed in separate "Archived" tab

### Revenue Calculation Rules

- **R5**: Revenue is calculated only from won estimates (case-insensitive status check)
- **R6**: Only estimates applying to current year are included (year-based, not rolling 12 months)
- **R7**: Use `total_price_with_tax` if available and > 0
- **R8**: If `total_price_with_tax` is missing/zero but `total_price` exists and > 0, use `total_price` as fallback
- **R9**: If fallback to `total_price` is used, notify user once per session (toast notification)
- **R10**: Multi-year contracts are annualized (total price divided by contract years)
- **R11**: Revenue display shows calculated revenue from won estimates, or "-" if none

### Revenue Segment Rules

- **R12**: Segment A: ≥15% of total revenue (selected year)
- **R13**: Segment B: 5-15% of total revenue (selected year)
- **R14**: Segment C: 0-5% of total revenue (selected year)
- **R15**: Segment D: Project only (has "Standard" type but no "Service" type won estimates)
- **R16**: If account has both Standard and Service estimates, assign A/B/C based on revenue (not D)
- **R17**: Default segment is 'C' if missing or no revenue data
- **R18**: Segment calculation uses stored `annual_revenue` field (not calculated on-the-fly)
- **R19**: Segment recalculation auto-triggers on import
- **R20**: Manual segment recalculation available in Admin Settings

### Contract Duration Rules

- **R21**: Contract duration is calculated in months before converting to years
- **R22**: Exact multiples of 12 months must not round up to next year
- **R23**: For non-exact multiples of 12 months, contract years = `ceil(duration_months / 12)`
- **R24**: Typo detection is triggered when `remainder_months === 1` (duration is 1 month over exact year boundary)
- **R25**: Typo detection does not change calculated `contract_years`
- **R26**: Typo detection only flags records for review and does not auto-correct dates
- **R27**: Typo detection is advisory only and does not block saving or reporting

### Filtering Rules

- **R28**: Type filter checks both `account_type` and `tags` fields
- **R29**: User filter uses OR logic (salesperson OR estimator matches)
- **R30**: Search filter is case-insensitive substring match on account name
- **R31**: At-risk filtering uses `notification_cache` data, not `account.status`
- **R32**: At-risk filtering excludes archived and snoozed accounts

### Sorting Rules

- **R33**: Score sorting only applies to accounts with completed scorecards
- **R34**: Accounts without scorecards go to end when sorting by score
- **R35**: Last interaction sorting prioritizes accounts with contacts
- **R36**: Accounts without contacts go to end when sorting by last interaction

### Test Mode Rules

- **R37**: Test mode affects all revenue calculations via `getCurrentYearForCalculation()`
- **R38**: Test mode year is used for: revenue calculation, segment calculation, year determination
- **R39**: All revenue calculation functions must use `getCurrentYearForCalculation()` for consistency

## Precedence and Conflict Resolution

### Archive Status Precedence

1. **Highest**: `account.archived === true` (boolean flag)
2. **Fallback**: `account.status === 'archived'` (status field)
3. **Result**: If either is true, account is archived

### Revenue Price Field Precedence

1. **Primary**: `total_price_with_tax` (if available and > 0)
2. **Fallback**: `total_price` (if total_price_with_tax missing/zero and total_price > 0)
3. **Result**: Use fallback with user notification

### Year Determination Precedence (per Estimates spec R2)

1. **Primary**: `contract_end`
2. **Fallback 1**: `contract_start`
3. **Fallback 2**: `estimate_date`
4. **Fallback 3**: `created_date`
5. **Default**: Selected year (if no dates available, uses selected year from YearSelectorContext)

### Revenue Segment Assignment Precedence

1. **First**: Check for Segment D (project-only)
2. **Then**: Calculate percentage from `annual_revenue`
3. **Assign**: A/B/C based on percentage thresholds

### Filter Application Order

1. Archive status (first)
2. Status filter (if URL parameter)
3. Type filter
4. Segment filter
5. User filter
6. Search filter
7. Sorting (last)

## Examples

### Example 1: Basic Account Display

**Input**:
- Account: `{ id: 'acc-1', name: 'Acme Corp', account_type: 'customer', status: 'active', revenue_segment: 'A', organization_score: 85 }`
- Estimates: `[{ account_id: 'acc-1', status: 'won', total_price_with_tax: 50000, contract_start: '2024-01-01', contract_end: '2024-12-31' }]`
- Current year: 2024

**Output**:
- Revenue: $50,000
- Segment: A
- Score: 85/100
- Type: Customer

**Rules**: R5, R6, R7, R12

### Example 2: Multi-Year Contract Annualization

**Input**:
- Estimate: `{ status: 'won', total_price_with_tax: 120000, contract_start: '2024-01-01', contract_end: '2025-12-31' }`
- Selected year: 2024

**Calculation**:
- Duration: 24 months
- Contract years: 2
- Annual amount: $120,000 / 2 = $60,000
- 2024 revenue: $60,000

**Rules**: R10, R21, R22

### Example 3: Typo Detection

**Input**:
- Estimate: `{ contract_start: '2024-10-01', contract_end: '2025-10-15' }`

**Calculation**:
- Duration: 13 months
- Contract years: 2 (by ceiling rule)
- Remainder: 13 % 12 = 1
- Typo flag: Yes (1 month over exact year boundary)

**Rules**: R24, R25, R26

### Example 4: Archive Status Conflict

**Input**:
- Account: `{ id: 'acc-2', name: 'Old Corp', status: 'active', archived: true }`

**Result**:
- Account is archived (archived boolean takes precedence)

**Rules**: R1, R2

### Example 5: Price Fallback

**Input**:
- Estimate: `{ status: 'won', total_price_with_tax: null, total_price: 45000, contract_start: '2024-01-01', contract_end: '2024-12-31' }`

**Result**:
- Uses `total_price` ($45,000) as fallback
- User notified via toast: "Some estimates are missing tax-inclusive prices. Using base price as fallback."

**Rules**: R7, R8, R9

### Example 6: User Filter OR Logic

**Input**:
- Selected users: ['John Doe']
- Estimates: `[{ account_id: 'acc-3', salesperson: 'John Doe', estimator: 'Jane Smith' }]`

**Result**:
- Account matches (salesperson OR estimator matches)

**Rules**: R29

### Example 7: Segment D (Project Only)

**Input**:
- Account: `{ annual_revenue: 10000 }`
- Estimates: `[{ status: 'won', estimate_type: 'Standard' }, { status: 'won', estimate_type: 'Standard' }]`
- Total revenue: $1,000,000

**Result**:
- Has Standard estimates, no Service estimates
- Revenue percentage: 1% (would be Segment C)
- But assigned Segment D (project-only rule takes precedence)

**Rules**: R15, R16

### Example 8: At-Risk Filtering

**Input**:
- Account: `{ id: 'acc-4', status: 'active', archived: false }`
- Notification cache: `[{ account_id: 'acc-4', renewal_date: '2025-06-01', days_until_renewal: 90 }]`
- Snoozes: `[]`

**Result**:
- Account appears in at-risk filter
- Shows renewal date and days until renewal

**Rules**: R31, R32

## Acceptance Criteria

- **AC1**: Accounts page displays all non-archived accounts by default (R1, R3)
- **AC2**: Revenue is calculated from won estimates for current year only (R5, R6)
- **AC3**: Multi-year contracts are annualized correctly (R10, R21, R22)
- **AC4**: Revenue segments are assigned based on current year revenue percentages (R12-R15)
- **AC5**: Segment D is assigned to project-only accounts (R15, R16)
- **AC6**: Price fallback uses `total_price` when `total_price_with_tax` missing (R8, R9)
- **AC7**: Archive status uses boolean flag preferentially (R1, R2)
- **AC8**: User filter matches accounts with salesperson OR estimator (R29)
- **AC9**: At-risk filtering uses notification cache, excludes archived/snoozed (R31, R32)
- **AC10**: Typo detection flags contracts 1 month over exact year boundary (R24, R25, R26)
- **AC11**: Segment recalculation auto-triggers on import (R19)
- **AC12**: Test mode affects all revenue calculations consistently (R37, R38, R39)

## Special Considerations

### Edge Cases

- **Missing price data**: Falls back to `total_price` with user notification
- **No won estimates**: Revenue displays as "-", segment defaults to 'C'
- **Conflicting archive flags**: Boolean `archived` takes precedence over `status='archived'`
- **No dates on estimate**: Uses selected year for revenue calculation
- **Exact year boundaries**: 12, 24, 36 months don't round up (R22)
- **Typo detection**: Only flags 1-month overages, not 2+ months

### Backward Compatibility

- Archive status checks both `archived` boolean and `status='archived'` for compatibility
- Type filter checks both `account_type` and `tags` for legacy data
- Price fallback ensures revenue calculation works even if tax field missing

### Performance Considerations

- Account fetching uses pagination (1000 per page, max 100 pages = 100k accounts)
- Estimates are grouped by account_id for efficient revenue calculation
- Notification cache reduces database queries for at-risk filtering

### Test Mode

- Test mode allows setting custom year for testing revenue calculations
- All revenue calculations must use `getCurrentYearForCalculation()` for consistency
- Test mode affects: revenue calculation, segment calculation, year determination

### Locale and Accessibility

- Revenue displayed in USD format with thousand separators
- Dates displayed in user's local timezone
- Archive status clearly indicated with visual styling

## Telemetry and Observability

### Key Events to Log

- Account creation/update/deletion
- Revenue segment recalculation (manual and auto)
- Price fallback usage (when total_price_with_tax missing)
- Typo detection flags (contract duration 1 month over boundary)
- Archive status conflicts (when both archived boolean and status='archived' exist)

### Metrics to Monitor

- Total accounts count (active vs archived)
- Accounts by revenue segment (A/B/C/D distribution)
- Revenue calculation accuracy (won estimates vs displayed revenue)
- Segment recalculation frequency
- Price fallback frequency
- Typo detection frequency

### Drift Indicators

- Revenue calculations not matching stored `annual_revenue`
- Segment distribution changes without data changes
- Archive status inconsistencies (boolean vs status field)
- Test mode affecting calculations inconsistently

## Open Questions for the Product Owner

1. Should archive status be normalized (sync `archived` boolean and `status` field)?
2. Should typo detection auto-correct dates, or only flag for review?
3. Should segment recalculation be scheduled (e.g., daily) or only on import?
4. Should price fallback notification be per-estimate or aggregate summary?

## Change Control

This spec governs behavior for the Accounts section. Any change requires explicit product owner approval before editing this file.

