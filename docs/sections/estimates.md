# Estimates Specification

**Version**: 1.3.0  
**Last Updated**: 2025-01-27  
**Status**: Authoritative

## Purpose

This document defines how estimates (proposals/quotes) are imported, processed, validated, and used throughout the application. Estimates are the primary source of revenue data, drive win/loss reporting, link to accounts and contacts, and support at-risk account detection.

## Data Contract

### Sources

- **Primary Source**: `Estimates List.xlsx` from LMN
  - This is the only source of estimate data
  - All estimates must come from this export file
  - LMN export is the source of truth for all estimate data

### Entities and Models

**Estimates Table** (`estimates`):
- `id` (uuid, PK): Database primary key
- `lmn_estimate_id` (text, UNIQUE): LMN's estimate identifier (required, immutable)
- `estimate_number` (text): Human-readable estimate number
- `estimate_type` (text): Type of estimate
- `estimate_date` (timestamptz): Date estimate was created
- `contract_start` (timestamptz): Contract start date
- `contract_end` (timestamptz): Contract end date (primary for year determination)
- `project_name` (text): Project description
- `version` (text): Estimate version/revision
- `account_id` (text, FK): Links to accounts table
- `contact_id` (text, FK): Links to contacts table
- `lmn_contact_id` (text): LMN's contact identifier
- `status` (text): Estimate status (won/lost)
- `pipeline_status` (text): Sales pipeline status (preferred for won/lost determination)
- `division` (text): Department/division
- `archived` (boolean): Archive flag
- `total_price` (numeric): Price without tax
- `total_price_with_tax` (numeric): Price with tax (preferred)
- `material_cost`, `material_price`, `labor_cost`, `labor_price`, etc.: Detailed cost/price breakdowns
- `created_date` (timestamptz): When estimate was created in LMN
- `created_at` (timestamptz): When record was created in our database
- `updated_at` (timestamptz): When record was last updated

### Fields Used

**Required Fields:**
- `lmn_estimate_id`: Must be present (error if missing)
- At least one date field: `contract_end`, `contract_start`, `estimate_date`, or `created_date`
- At least one price field: `total_price_with_tax` or `total_price` (for revenue calculations)

**Optional Fields:**
- `account_id`, `contact_id`: May be null (orphaned estimates)
- `pipeline_status`: Used for won/lost determination (preferred over `status`)
- `status`: Used as fallback for won/lost determination
- All other fields are optional

### Types, Units, Time Zones

- **Dates**: Stored as `timestamptz` in database, normalized to YYYY-MM-DD date-only strings for application logic
- **Prices**: Numeric (USD), stored as `numeric(12,2)`
- **Status**: Text strings (case-insensitive matching)
- **IDs**: Text strings (format: `lmn-estimate-XXXXX`)

### Nullability Assumptions

- `lmn_estimate_id`: Never null (required, validation error if missing)
- `account_id`, `contact_id`: May be null (orphaned estimates are allowed but warned)
- Date fields: May be null, but at least one must exist for year determination
- Price fields: May be null, but at least one must exist for revenue calculations

## Logic

### Ordered End-to-End Flow

1. **Import Process**:
   - Parse `Estimates List.xlsx` file
   - Normalize all date formats to YYYY-MM-DD
   - Determine won/lost status (pipeline_status preferred, status as fallback)
   - Link estimates to accounts/contacts (priority order)
   - Validate required fields (lmn_estimate_id, dates, prices)
   - Detect duplicates within import batch
   - Upsert to database (fresh import - overwrites existing)

2. **Status Determination**:
   - Priority 1: Check `pipeline_status` field
     - If `pipeline_status.toLowerCase().trim() === 'sold'` → WON
     - If `pipeline_status.toLowerCase().trim().includes('sold')` → WON
   - Priority 2: Check `status` field (fallback)
     - Won statuses: "contract signed", "work complete", "billing complete", "email contract award", "verbal contract award", "contract in progress", "contract + billing complete"
     - Lost statuses: "estimate lost", "estimate in progress - lost", "review + approve - lost", "client proposal phase - lost", "estimate on hold", etc.
     - Default: LOST (if unrecognized, log warning)

3. **Date Normalization**:
   - Accept formats: Excel serial dates, ISO strings, MM/DD/YYYY, timestamps
   - Convert all to: YYYY-MM-DD date-only strings
   - Validate: Dates must be between 2000-2100
   - Invalid dates: Log error, notify user, skip date parsing

4. **Account Linking** (Priority Order):
   - Method 1: Direct `account_id` match
     - If estimate has `account_id`, use it directly (if account exists in database)
   - Method 2: `lmn_contact_id` treated as CRM ID (Account ID) first
     - Try matching `lmn_contact_id` to `account.lmn_crm_id` (case-insensitive)
     - If match found, use that account_id
   - Method 3: `lmn_contact_id` treated as contact ID → maps to account
     - If Method 2 fails, try matching `lmn_contact_id` to `contact.lmn_contact_id`
     - If contact found and has `account_id`, use that account_id
   - Method 4: Email → contact → account
     - Match estimate email (case-insensitive) to contact email
     - If contact found and has `account_id`, use that account_id
   - Method 5: Phone → contact → account
     - Normalize phone numbers (remove all non-digits)
     - Match estimate phone to contact phone (normalized)
     - If contact found and has `account_id`, use that account_id
   - Method 6: Contact name → fuzzy match to account name
     - Normalize names: lowercase, trim, remove punctuation, remove common suffixes (inc, llc, ltd, corp, etc.)
     - Calculate similarity (character overlap / longer length)
     - If similarity > 0.85, match contact name to account name
     - If match found, use that account_id
   - Method 7: CRM tags → account match
     - Split estimate `crm_tags` by comma
     - Match each tag (case-insensitive, trimmed) to `account.lmn_crm_id`
     - Supports partial matches and space-normalized matches
     - If match found, use that account_id
   - Method 8: Address → fuzzy match to account address
     - Normalize addresses (lowercase, trim, remove punctuation)
     - Calculate similarity (character overlap / longer length)
     - If similarity > 0.85, match estimate address to account address
     - If match found, use that account_id
   - Method 9: Orphaned (no link) → `account_id = null` (warn user)
     - If no match found via any method, set `account_id = null`
     - Track with `_is_orphaned = true` and `_link_method = null`
     - Log warning and notify user in import summary

5. **Year Determination** (Priority Order):
   - Priority 1: `contract_end` (if present and valid)
   - Priority 2: `contract_start` (if present and valid)
   - Priority 3: `estimate_date` (if present and valid)
   - Priority 4: `created_date` (if present and valid)

### Transformations

- **Date Parsing**: Multiple formats → YYYY-MM-DD strings
- **Status Normalization**: Various status strings → 'won' or 'lost'
- **Price Selection**: `total_price_with_tax` preferred, `total_price` fallback
- **Account Linking**: Multiple matching methods → single `account_id` assignment

### Computations and Formulas

- **Win Rate**: `(won estimates / total estimates) * 100`
  - Archived estimates excluded from both numerator and denominator
  - Uses `isWonStatus()` function to respect `pipeline_status` priority
  - **Multi-year contracts**: Treated as single-year contracts for count-based calculations (appear only in determined year, typically `contract_start`). See Won Loss Ratio spec R40 for details.
- **Department Total**: Sum of `total_price_with_tax` (or `total_price`) for all estimates in department
- **Department Win Rate**: `(won estimates in department / total estimates in department) * 100`
  - Archived estimates excluded
  - Uses `isWonStatus()` function for status determination
- **Year Extraction**: Extract year from date string (first 4 characters of YYYY-MM-DD)
  - Validates year is between 2000-2100
  - Returns null if invalid or missing

### Sorting and Grouping Rules

- **Default Sort**: Newest first by `estimate_date`
- **Grouping**: By division/department (with "Uncategorized" for missing/empty)
- **Department Sort**: Uncategorized first, then known divisions, then alphabetically

### Division Normalization

- **Known Divisions** (exact match, case-insensitive):
  - 'LE Irrigation'
  - 'LE Landscapes'
  - 'LE Maintenance (Summer/Winter)'
  - 'LE Maintenance Enchancements'
  - 'LE Paving'
  - 'LE Tree Care'
  - 'Line Painting'
  - 'Parking Lot Sweeping'
  - 'Snow'
  - 'Warranty'
- **Normalization Rules**:
  - Empty/null/whitespace → "Uncategorized"
  - Values like '<unassigned>', 'unassigned', '[unassigned]', 'null', 'undefined', 'n/a', 'na' → "Uncategorized"
  - Exact match (case-insensitive) to known division → return exact category name (preserves casing)
  - No match → "Uncategorized"

### User Filtering

- **Supported Filters**: Filter estimates by salesperson or estimator
- **Filter Logic**: If users selected, only show estimates where:
  - `estimate.salesperson` matches selected user, OR
  - `estimate.estimator` matches selected user
- **User Extraction**: Extract unique users from estimates with counts
  - Includes both salesperson and estimator fields
  - Sorted alphabetically by name

### Department Grouping and Sorting

- **Grouping**: Estimates grouped by normalized division/department
- **Sorting Within Department**: Newest first by `estimate_date`
- **Department Sort Order**:
  1. "Uncategorized" always first
  2. Known divisions (in order listed above)
  3. Other divisions alphabetically
- **Department Totals**: Sum of `total_price_with_tax` (or `total_price`) for all estimates in department
- **Department Win Rate**: `(won estimates in department / total estimates in department) * 100`
  - Archived estimates excluded from win rate calculation

## Rules

**R1**: Only estimates with won status are included in revenue calculations. Won status is determined by `pipeline_status` (preferred) or `status` field (fallback).

**R2**: Year determination uses priority order: `contract_end` → `contract_start` → `estimate_date` → `created_date`.

**R3**: All date fields are normalized to YYYY-MM-DD format during import. Database stores as `timestamptz`, but application logic uses date-only strings.

**R4**: Price field selection: Prefer `total_price_with_tax`, fallback to `total_price` if missing/zero.

**R5**: Missing `lmn_estimate_id` is an error - estimate is skipped, error is logged, and user is notified in import summary.

**R6**: Duplicate `lmn_estimate_id` within import batch is an error - duplicate is skipped, error is logged, and user is notified in import summary.

**R7**: Estimates with no `account_id` AND no `contact_id` are orphaned - logged as warning, imported with `account_id = null`, and user is notified in import summary.

**R8**: Each import is treated as fresh data. LMN export is the source of truth. Import data overwrites existing database values when `lmn_estimate_id` matches.

**R9**: Unrecognized status values are logged as warnings, default to 'lost', and user is notified in import summary with count and list of unrecognized statuses.

**R10**: Invalid dates (outside 2000-2100 range or unparseable) are logged as errors, user is notified, and date parsing is skipped (estimate still imported if other validations pass).

**R11**: Status determination priority: `pipeline_status` field is checked first (if "sold" → won), then `status` field is used as fallback.

**R12**: Archived estimates (`archived = true`) are excluded from reports and calculations.

**R13**: Duplicate detection: Within-batch duplicates are skipped; across-imports use `lmn_estimate_id` matching (updates existing record).

**R14**: Account linking stores `_link_method` for tracking (no manual review required for fuzzy matches). Link methods: 'crm_id_direct', 'contact_id', 'email_to_contact', 'phone_to_contact', 'name_match_fuzzy', 'crm_tags', 'address_match', or null (orphaned).

**R16**: Division normalization maps empty/null/unassigned values to "Uncategorized". Known divisions matched exactly (case-insensitive), unknown divisions also map to "Uncategorized".

**R17**: User filtering supports filtering by salesperson or estimator. If users selected, only estimates where salesperson OR estimator matches are shown.

**R18**: Department grouping organizes estimates by normalized division. Departments sorted: Uncategorized first, then known divisions, then others alphabetically. Estimates within department sorted newest first by `estimate_date`.

**R19**: Win rate calculations exclude archived estimates from both numerator and denominator. Uses `isWonStatus()` function to respect `pipeline_status` priority over `status` field.

**R15**: Date validation: All dates must be between 2000-2100. Dates outside this range are invalid and trigger error notification.

## Precedence and Conflict Resolution

### Status Determination Precedence

**Highest Priority**: `pipeline_status` field
- If `pipeline_status.toLowerCase().trim() === 'sold'` or includes 'sold' → WON
- If `pipeline_status` indicates sold → WON

**Fallback Priority**: `status` field
- Check against won/lost status lists
- Default to LOST if unrecognized

### Date Priority (Year Determination)

**Priority 1**: `contract_end`
- If present and valid → use this year
- If missing/invalid → fall to next priority

**Priority 2**: `contract_start`
- If present and valid → use this year
- If missing/invalid → fall to next priority

**Priority 3**: `estimate_date`
- If present and valid → use this year
- If missing/invalid → fall to next priority

**Priority 4**: `created_date`
- If present and valid → use this year
- If missing/invalid → estimate has no valid date (should not occur per validation)

### Price Field Selection

**Prefer**: `total_price_with_tax`
- If present and > 0 → use this
- If missing/zero → fall to fallback

**Fallback**: `total_price`
- If present and > 0 → use this
- If missing/zero → exclude from revenue calculations

### Conflict Examples

1. **Estimate has both pipeline_status="Sold" and status="Estimate Lost"**
   - Resolution: Use `pipeline_status` (Priority 1) → WON

2. **Estimate has contract_end=2025-06-15 and estimate_date=2024-12-01**
   - Resolution: Use `contract_end` (Priority 1) → applies to 2025

3. **Estimate has total_price_with_tax=0 and total_price=5000**
   - Resolution: Use `total_price` (fallback) → 5000

4. **Estimate has duplicate lmn_estimate_id in same import batch**
   - Resolution: Skip duplicate, log error, notify user

5. **Estimate has invalid date "1899-01-01"**
   - Resolution: Log error, notify user, skip date parsing, estimate still imported if other validations pass

## Examples

### Example 1: Estimate with contract_end (Year Determination)
**Input:**
```json
{
  "lmn_estimate_id": "12345",
  "contract_end": "2025-06-15",
  "estimate_date": "2024-12-01",
  "status": "won",
  "total_price_with_tax": 10000
}
```
**Output:**
- Year determination: Uses 2025 (contract_end priority)
- Applies to: 2025 revenue calculations
- **Rule IDs**: R2, R3

### Example 2: Missing lmn_estimate_id (Error)
**Input:**
```json
{
  "estimate_number": "EST-001",
  "status": "won",
  "total_price": 5000
}
```
**Output:**
- Result: Skipped (error)
- Log: "Estimate missing lmn_estimate_id - skipped (row X)"
- Import summary: "X estimates skipped due to missing ID"
- **Rule IDs**: R5

### Example 3: Duplicate lmn_estimate_id (Error)
**Input:**
```json
[
  { "lmn_estimate_id": "12345", "status": "won", "total_price": 5000 },
  { "lmn_estimate_id": "12345", "status": "won", "total_price": 6000 }
]
```
**Output:**
- Result: First estimate imported, second skipped (error)
- Log: "Duplicate lmn_estimate_id '12345' - skipped (row Y)"
- Import summary: "X duplicates detected and skipped"
- **Rule IDs**: R6, R13

### Example 4: Orphaned Estimate (Warning)
**Input:**
```json
{
  "lmn_estimate_id": "12345",
  "status": "won",
  "total_price": 5000,
  "account_id": null,
  "contact_id": null
}
```
**Output:**
- Result: Imported with `account_id = null`
- Log: "Estimate '12345' has no account_id or contact_id - orphaned"
- Import summary: "X orphaned estimates (no account/contact link)"
- **Rule IDs**: R7

### Example 5: Unrecognized Status (Warning)
**Input:**
```json
{
  "lmn_estimate_id": "12345",
  "status": "custom new status",
  "total_price": 5000
}
```
**Output:**
- Result: Status defaults to 'lost', imported
- Log: "Unrecognized status: 'custom new status' (row X) - defaulting to 'lost'"
- Import summary: "X estimates with unrecognized status values - review recommended"
- **Rule IDs**: R9, R11

### Example 6: Invalid Date (Error Notification)
**Input:**
```json
{
  "lmn_estimate_id": "12345",
  "contract_end": "1899-01-01",
  "status": "won",
  "total_price": 5000
}
```
**Output:**
- Result: Date parsing skipped, estimate still imported
- Log: "Invalid date '1899-01-01' for estimate '12345' - outside valid range (2000-2100)"
- Import summary: "X estimates with invalid dates - review recommended"
- **Rule IDs**: R10, R15

### Example 7: Pipeline Status Preferred (Status Determination)
**Input:**
```json
{
  "lmn_estimate_id": "12345",
  "pipeline_status": "Sold",
  "status": "Estimate Lost",
  "total_price": 5000
}
```
**Output:**
- Status determination: WON (pipeline_status="Sold" takes priority)
- **Rule IDs**: R1, R11

### Example 8: Date Format Normalization
**Input:**
```json
{
  "lmn_estimate_id": "12345",
  "contract_end": "06/15/2025",
  "status": "won",
  "total_price": 5000
}
```
**Output:**
- Date normalized: "2025-06-15"
- Stored in database: `timestamptz` equivalent
- Application logic uses: "2025-06-15"
- **Rule IDs**: R3

## Acceptance Criteria

**AC1**: All estimates from LMN export are imported (except those with missing `lmn_estimate_id`). (R5, R8)

**AC2**: Year determination uses standardized priority order: `contract_end` → `contract_start` → `estimate_date` → `created_date`. (R2, R3)

**AC3**: Import validation errors (missing ID, duplicates, invalid dates) are logged and reported in import summary with user notifications. (R5, R6, R10, R15)

**AC4**: Import data overwrites existing database values when `lmn_estimate_id` matches. (R8)

**AC5**: Unrecognized statuses are logged, counted, and listed in import summary with user notification. (R9)

**AC6**: All dates are normalized to YYYY-MM-DD format during import. (R3)

**AC7**: Status determination prefers `pipeline_status` over `status` field. (R1, R11)

**AC8**: Orphaned estimates (no account_id or contact_id) are imported with warnings and user notifications. (R7)

**AC9**: Invalid dates trigger error notifications and are excluded from date-based calculations. (R10, R15)

## Special Considerations

### Edge Cases

- **Estimates with only `created_date`**: Use `created_date` for year determination (Priority 4)
- **Estimates with invalid dates**: Skip date parsing, log error, notify user, estimate still imported if other validations pass
- **Estimates with both won and lost indicators**: `pipeline_status` wins (Priority 1)
- **Estimates with no valid dates**: Excluded from year-based reports but may still be imported
- **Estimates with zero prices**: Excluded from revenue calculations but may be imported

### Exceptions

- **Archived estimates**: Excluded from all reports and calculations (R12)
- **Orphaned estimates**: Allowed but warned (R7)

### Backward Compatibility Notes

- Date priority change: `contract_end` now takes priority over `estimate_close_date` (which is no longer used)
- Status determination change: `pipeline_status` now preferred over `status` field

### Locale or Accessibility Considerations

- Date formats: Accept multiple input formats but standardize to YYYY-MM-DD
- Status matching: Case-insensitive, trimmed

## Telemetry and Observability

### Key Events to Log

- Import started/completed
- Validation errors: Missing `lmn_estimate_id`, duplicates, invalid dates
- Warnings: Orphaned estimates, unrecognized statuses
- Estimates created/updated counts
- Account linking statistics (methods used, success rates)

### Metrics That Indicate Drift or Failure

- Import success rate: % of estimates successfully imported
- Data quality metrics: % linked to accounts, % with valid dates, % with recognized statuses
- Duplicate rate: % of duplicates detected
- Orphaned rate: % of estimates without account/contact links
- Unrecognized status frequency: Count and list of unrecognized statuses per import

### User Notifications

All validation errors and warnings must notify users in the import summary:
- **Errors**: Missing `lmn_estimate_id`, duplicate IDs, invalid dates
- **Warnings**: Orphaned estimates, unrecognized statuses
- **Summary**: Total counts, success/failure breakdown

## Total Estimates by Year (Pre-calculation)

### Purpose

Similar to how `revenue_by_year` is pre-calculated during import, `total_estimates_by_year` stores the count of all estimates (won + lost) per year for each account. This avoids on-the-fly filtering and improves performance when displaying estimate counts.

### Calculation During Import

**R20**: Total estimates are calculated for ALL years during import (not just selected year)
- For each account:
  - Get all estimates linked to account (won + lost, excluding archived)
  - Determine year for each estimate using date priority (R2): `contract_end` → `contract_start` → `estimate_date` → `created_date`
  - **For count-based calculations** (win rate, estimate counts): Multi-year contracts are treated as single-year contracts (appear only in determined year, typically `contract_start`). See Won Loss Ratio spec R40.
  - **For dollar-based calculations** (revenue, totals): Multi-year contracts use annualization (allocated to sequential years with annualized amounts). See Revenue Logic spec R8, R9.
  - Store count in `total_estimates_by_year` JSONB: `{ "2024": 15, "2025": 23, ... }`

**R21**: `total_estimates_by_year` field is calculated and stored during import only. It is NOT updated by database triggers when estimates change.

**R22**: Archived estimates are excluded from `total_estimates_by_year` calculations (per R12).

**R23**: To get total estimates for selected year: `account.total_estimates_by_year[selectedYear] || 0`

**R24**: Components MUST use pre-calculated `total_estimates_by_year` from account object. No fallback to on-the-fly filtering. If account or `total_estimates_by_year` is missing, return 0.

### Storage

- **Field**: `total_estimates_by_year` (JSONB on accounts table)
- **Format**: `{ "2024": 15, "2025": 23, "2026": 18, ... }`
- **Type**: Integer counts per year
- **Calculation**: During import only (same pass as revenue calculation)

### Usage

- **EstimatesStats component**: 
  - Requires `account` prop with `total_estimates_by_year` field
  - Reads from `total_estimates_by_year[selectedYear]`
  - Returns 0 if account or field is missing (no fallback to on-the-fly filtering)
- **Account detail pages**: Display estimate counts per year using pre-calculated values
- **Reports**: Can use pre-calculated counts for performance (future enhancement)

### Implementation Details

- **Database Field**: `total_estimates_by_year` (JSONB on accounts table)
- **Migration**: `add_total_estimates_by_year_to_accounts.sql`
- **Calculation Location**: `src/utils/lmnMergeData.js` (during import, same pass as revenue calculation)
- **Component Usage**: `src/components/account/EstimatesStats.jsx` (uses pre-calculated value when account prop provided)
- **Helper Function**: `getTotalEstimatesForYear(account, selectedYear)` in `src/utils/revenueSegmentCalculator.js` (similar to `getRevenueForYear`)

## API Optimization

### Field Selection for Large Imports

- **Import Validation**: When fetching estimates for import validation, only fetch required fields to reduce response size
- **Fields Included**: `id`, `lmn_estimate_id`, `estimate_number`, `estimate_type`, `estimate_date`, `contract_start`, `contract_end`, `created_date`, `archived`, `total_price`, `total_price_with_tax`, `status`, `division`, `project_name`, `account_id`
- **Purpose**: Prevents hitting Vercel's 4.5MB response limit
- **Full Fetch**: When `account_id` query parameter provided, fetch all fields (`*`)

### Duplicate Removal

- **In `filterEstimatesByYear()`**: Removes duplicates by `lmn_estimate_id` (keeps first occurrence)
- **Purpose**: Prevents double-counting in reports when same estimate appears multiple times

## Open Questions for the Product Owner

None at this time.

## Change Control

This spec governs behavior for the Estimates section. Any change requires explicit product owner approval before editing this file.

