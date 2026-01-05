# Estimates Specification

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
   - Validate: Dates must be between 1900-2100
   - Invalid dates: Log error, notify user, skip date parsing

4. **Account Linking** (Priority Order):
   - Method 1: Direct `account_id` match
   - Method 2: `lmn_contact_id` treated as CRM ID (Account ID) first
   - Method 3: `lmn_contact_id` treated as contact ID → maps to account
   - Method 4: Email → contact → account
   - Method 5: Phone → contact → account
   - Method 6: Contact name → fuzzy match to account name
   - Method 7: CRM tags → account match
   - Method 8: Address → fuzzy match to account address
   - Method 9: Orphaned (no link) → `account_id = null` (warn user)

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
- **Department Total**: Sum of `total_price_with_tax` (or `total_price`) for all estimates in department
- **Year Extraction**: Extract year from date string (first 4 characters of YYYY-MM-DD)

### Sorting and Grouping Rules

- **Default Sort**: Newest first by `estimate_date`
- **Grouping**: By division/department (with "Uncategorized" for missing/empty)
- **Department Sort**: Uncategorized first, then known divisions, then alphabetically

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

**R10**: Invalid dates (outside 1900-2100 range or unparseable) are logged as errors, user is notified, and date parsing is skipped (estimate still imported if other validations pass).

**R11**: Status determination priority: `pipeline_status` field is checked first (if "sold" → won), then `status` field is used as fallback.

**R12**: Archived estimates (`archived = true`) are excluded from reports and calculations.

**R13**: Duplicate detection: Within-batch duplicates are skipped; across-imports use `lmn_estimate_id` matching (updates existing record).

**R14**: Account linking uses confidence scoring - store `_link_method` and `_link_confidence` for tracking (no manual review required for fuzzy matches).

**R15**: Date validation: All dates must be between 1900-2100. Dates outside this range are invalid and trigger error notification.

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
- Log: "Invalid date '1899-01-01' for estimate '12345' - outside valid range (1900-2100)"
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

## Open Questions for the Product Owner

None at this time.

## Change Control

This spec governs behavior for the Estimates section. Any change requires explicit product owner approval before editing this file.

