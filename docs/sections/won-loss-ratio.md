# Won Loss Ratio Logic Spec

## Purpose

The Won Loss Ratio Logic section calculates and displays win/loss statistics for estimates across the application. It provides overall statistics, per-account breakdowns, per-department breakdowns, and year-based filtering. The system determines won/lost/pending status using a two-tier priority system (pipeline_status first, then status field) and calculates win rates, revenue metrics, and ratios for reporting and analysis.

## Data contract

### Sources

- **Estimates table** (`estimates`): Primary source for all estimate data
  - `id` (text, PK) - Estimate identifier
  - `lmn_estimate_id` (text) - LMN estimate identifier (used for duplicate detection)
  - `account_id` (text, FK) - Links to accounts table
  - `status` (text) - Estimate status (e.g., 'won', 'lost', 'contract signed', 'work complete')
  - `pipeline_status` (text) - LMN pipeline status (e.g., 'sold', 'lost', 'pending')
  - `total_price` (numeric) - Base price (fallback if total_price_with_tax missing)
  - `total_price_with_tax` (numeric) - Tax-inclusive price (preferred)
  - `division` (text) - Department/division name
  - `estimate_date` (timestamptz) - Estimate creation date
  - `contract_end` (timestamptz) - Contract end date (Priority 1 for year filtering, per Estimates spec R2)
  - `estimate_close_date` (timestamptz) - Estimate close date (deprecated, no longer used for year determination priority)
  - `archived` (boolean) - Archive flag
  - `exclude_stats` (boolean) - Exclude from statistics flag

- **Accounts table** (`accounts`): Used for account name lookups
  - `id` (text, PK) - Account identifier
  - `name` (text) - Account name

### Fields Used

#### Required
- `estimates.id` - Estimate identifier (required)
- `estimates.status` or `estimates.pipeline_status` - At least one must be present for won/loss determination

#### Optional but Important
- `estimates.account_id` - Required for per-account statistics (estimates without account_id are excluded from account stats)
- `estimates.division` - Defaults to 'Uncategorized' if missing
- `estimates.total_price_with_tax` - Preferred for revenue calculations
- `estimates.total_price` - Fallback if total_price_with_tax missing
- `estimates.contract_end` - Priority 1 for year filtering (per Estimates spec R2)
- `estimates.contract_start` - Priority 2 for year filtering (per Estimates spec R2)
- `estimates.estimate_close_date` - Deprecated, no longer used for year determination priority
- `estimates.estimate_date` - Fallback for year filtering
- `estimates.lmn_estimate_id` - Used for duplicate detection
- `accounts.name` - Used for account name display (defaults to 'Unknown Account' if missing)

### Types and Units

- **Revenue**: Numeric - Currency values in dollars (no decimal precision requirement in calculations)
- **Percentages**: Calculated as decimals (0-1), displayed as percentages (0-100) with 1 decimal place
- **Dates**: All dates stored as timestamptz (UTC) in database
- **Time zone**: UTC for database storage, local time for display
- **Division**: Text string, case-sensitive for grouping

### Nullability Assumptions

- `estimates.status` can be null (treated as pending)
- `estimates.pipeline_status` can be null (not checked if missing)
- `estimates.total_price_with_tax` can be null (falls back to `total_price`)
- `estimates.total_price` can be null (treated as 0 if both price fields are null)
- `estimates.division` can be null (defaults to 'Uncategorized')
- `estimates.account_id` can be null (excluded from account statistics)
- `estimates.contract_end` can be null (falls back to `contract_start` → `estimate_date` → `created_date` per Estimates spec R2)
- `estimates.estimate_date` can be null (estimate excluded from year-based reports if both dates missing)
- `accounts.name` can be null (defaults to 'Unknown Account')

## Logic

### Ordered End-to-End Flow

1. **Data Fetching** (Reports page load)
   - Fetch all estimates from `/api/data/estimates`
   - Fetch all accounts for account name lookups
   - Apply year filter if specified
   - Apply account filter if specified
   - Apply department filter if specified

2. **Duplicate Removal** (if year filtering)
   - Remove duplicates by `lmn_estimate_id` (keeps first occurrence)
   - Estimates without `lmn_estimate_id` are included

3. **Year Filtering** (if year specified)
   - Exclude archived estimates
   - **For COUNT-based calculations** (win rate, estimate counts):
     - Determine date to use (per Estimates spec R2):
       - Priority 1: `contract_end` (if available)
       - Priority 2: `contract_start` (if available)
       - Priority 3: `estimate_date` (if available)
       - Priority 4: `created_date` (if available)
     - Extract year from date (first 4 characters of date string)
     - Multi-year contracts are treated as single-year contracts (appear only in determined year) (R40)
   - **For DOLLAR-based calculations** (revenue, won value, estimated value):
     - Use annualization logic (per Revenue Logic spec R8, R9)
     - Multi-year contracts are allocated to sequential calendar years with annualized amounts (R41)
   - Validate year is between 2000-2100
   - If `soldOnly=true`: Exclude estimates with status containing "lost"
   - Per Estimates spec R10: `exclude_stats` field is ignored (never used in any system logic)
   - Include estimates with zero/negative prices (LMN compatibility)

4. **Won Status Determination** (for each estimate)
   - Priority 1: Check `pipeline_status` field
     - If `pipeline_status` contains "sold" (case-insensitive) → WON
   - Priority 2: Check `status` field
     - If `status` matches won statuses (case-insensitive, trimmed) → WON
   - Won statuses: 'contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'sold', 'won'

5. **Status Classification** (for each estimate)
   - If `isWonStatus()` returns true → WON
   - Else if `status` equals 'lost' (case-insensitive) → LOST
   - Else → PENDING

6. **Revenue Calculation** (for each estimate)
   - Use `total_price_with_tax` if available and non-zero
   - Fallback to `total_price` if `total_price_with_tax` is missing or zero
   - If both are missing or zero, treat as 0

7. **Overall Statistics Calculation**
   - **Count-based calculations** (use simple date extraction, R40):
     - Count total estimates (multi-year contracts counted once in start year)
     - Count won estimates (where `isWonStatus()` returns true)
     - Count lost estimates (where `status === 'lost'`)
     - Count pending estimates (neither won nor lost)
     - Calculate decided count (won + lost)
     - Calculate win rate: `(won / decidedCount) * 100` (only decided estimates)
   - **Dollar-based calculations** (use annualization, R41):
     - Sum revenue for total, won, lost, and pending (multi-year contracts annualized)
     - Calculate ratios:
       - `estimatesVsWonRatio`: `(won / total) * 100` (count-based)
       - `revenueVsWonRatio`: `(wonValue / totalValue) * 100` (dollar-based)

8. **Account Statistics Calculation**
   - Group estimates by `account_id`
   - For each account:
     - Count total, won, lost, pending
     - Sum revenue for total, won, lost, pending
     - Calculate win rate: `(won / (won + lost)) * 100`
     - Calculate ratios (same as overall)
   - Sort by `totalValue` descending
   - Use account name from accounts lookup (defaults to 'Unknown Account' if missing)

9. **Department Statistics Calculation**
   - Group estimates by `division` field
   - Use 'Uncategorized' if `division` is missing
   - For each department:
     - Count total, won, lost (pending not tracked for departments)
     - Sum revenue for total, won, lost
     - Calculate win rate: `(won / (won + lost)) * 100`
     - Calculate ratios (same as overall)
   - Sort by `totalValue` descending

10. **Display Formatting**
    - Win rate: Format to 1 decimal place (e.g., "65.3%")
    - Ratios: Format to 1 decimal place (e.g., "45.2%")
    - Revenue: Format using `formatCurrency()` (K for thousands, M for millions)
    - Percentages: Display as numbers with "%" suffix

### Transformations in Sequence

1. **Input**: Raw estimates array from database
2. **Filter**: Remove duplicates, apply year/account/department filters
3. **Classify**: Determine won/lost/pending status for each estimate
4. **Group**: Group by account_id or division
5. **Aggregate**: Sum counts and revenue values
6. **Calculate**: Compute win rates and ratios
7. **Sort**: Sort results by total value (descending)
8. **Format**: Format numbers and percentages for display
9. **Output**: Statistics objects and arrays for UI components

### Computations and Formulas

- **Win Rate**: `(won / (won + lost)) * 100`
  - Only counts decided estimates (won + lost)
  - Pending estimates are excluded from win rate calculation
  - Returns 0 if decidedCount is 0 (avoids division by zero)

- **Estimates vs Won Ratio**: `(won / total) * 100`
  - Includes all estimates (won, lost, pending) in denominator
  - Shows percentage of all estimates that are won

- **Revenue vs Won Ratio**: `(wonValue / totalValue) * 100`
  - Shows percentage of total revenue that comes from won estimates

- **Revenue Value**: `parseFloat(total_price_with_tax || total_price) || 0`
  - Prefers `total_price_with_tax`, falls back to `total_price`
  - Treats missing/null values as 0

### Sorting and Grouping Rules

- **Account Statistics**: Sorted by `totalValue` (descending)
- **Department Statistics**: Sorted by `totalValue` (descending)
- **Grouping Key**: 
  - Account stats: `account_id`
  - Department stats: `division` (or 'Uncategorized' if missing)
- **Duplicate Handling**: First occurrence by `lmn_estimate_id` is kept

## Rules

Rules must be testable and numbered.

### Won Status Detection Rules

- **R1**: If `pipeline_status` contains "sold" (case-insensitive), then the estimate is WON.
- **R2**: If `pipeline_status` is checked first, then `status` field is checked only if `pipeline_status` does not indicate won.
- **R3**: If `status` field (case-insensitive, trimmed) matches any won status, then the estimate is WON.
- **R4**: Won statuses are: 'contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'sold', 'won'.
- **R5**: If an estimate is neither won nor explicitly lost, then it is PENDING.

### Status Classification Rules

- **R6**: If `isWonStatus()` returns true, then estimate status is WON.
- **R7**: If `isWonStatus()` returns false and `status` equals 'lost' (case-insensitive), then estimate status is LOST.
- **R8**: If `isWonStatus()` returns false and `status` does not equal 'lost', then estimate status is PENDING.

### Revenue Calculation Rules

- **R9**: Revenue calculation uses `total_price_with_tax` if available and non-zero.
- **R10**: If `total_price_with_tax` is missing, null, or zero, then use `total_price` as fallback.
- **R11**: If both `total_price_with_tax` and `total_price` are missing, null, or zero, then revenue value is 0.

### Win Rate Calculation Rules

- **R12**: Win rate is calculated as `(won / (won + lost)) * 100`.
- **R13**: Win rate only counts decided estimates (won + lost), excluding pending estimates.
- **R14**: If decidedCount is 0, then win rate is 0 (avoids division by zero).
- **R15**: Win rate is formatted to 1 decimal place.

### Ratio Calculation Rules

- **R16**: Estimates vs Won ratio is calculated as `(won / total) * 100`.
- **R17**: Revenue vs Won ratio is calculated as `(wonValue / totalValue) * 100`.
- **R18**: Ratios are formatted to 1 decimal place.
- **R19**: If total is 0, then Estimates vs Won ratio is 0.
- **R20**: If totalValue is 0, then Revenue vs Won ratio is 0.

### Year Filtering Rules

- **R21**: Archived estimates are excluded from year-based filtering.
- **R22**: Year determination uses priority order (per Estimates spec R2): `contract_end` → `contract_start` → `estimate_date` → `created_date`.
- **R23**: Year is extracted from date string (first 4 characters).
- **R24**: Year must be between 2000-2100 (inclusive) to be valid.
- **R25**: If `soldOnly=true`, exclude estimates with status containing "lost" (case-insensitive).
- **R26**: Per Estimates spec R10: `exclude_stats` field is ignored - never used in any system logic.
- **R27**: Estimates with zero/negative prices are included in year filtering (LMN compatibility).

### Multi-Year Contract Handling Rules

- **R40**: For COUNT-based won/loss ratio calculations (win rate percentage, "X won / Y total" display), multi-year contracts are treated as single-year contracts using the year determined by date priority (R22). A multi-year contract appears only in the year of its determined date field (typically `contract_start`).
- **R41**: For DOLLAR-based calculations (won value, estimated value, revenue totals), multi-year contracts use annualization logic (per Revenue Logic spec R8, R9). Revenue is allocated to sequential calendar years starting from `contract_start` year, with annualized amounts per year.
- **R42**: The distinction between count-based and dollar-based filtering ensures that:
  - Win rate counts (R12, R13) use simple date extraction (multi-year contracts counted once in start year)
  - Revenue values use annualization (multi-year contracts contribute annualized amounts to each year they span)

### Duplicate Handling Rules

- **R29**: Duplicates are detected by `lmn_estimate_id` field.
- **R30**: When duplicates are found, keep the first occurrence and discard subsequent ones.
- **R31**: Estimates without `lmn_estimate_id` are always included (cannot be deduplicated).

### Grouping Rules

- **R32**: Account statistics group estimates by `account_id`.
- **R33**: Estimates without `account_id` are excluded from account statistics.
- **R34**: Department statistics group estimates by `division` field.
- **R35**: If `division` is missing or null, use 'Uncategorized' as the department name.
- **R36**: Account statistics use account name from accounts lookup.
- **R37**: If account name is missing, use 'Unknown Account' as the account name.

### Sorting Rules

- **R38**: Account statistics are sorted by `totalValue` in descending order.
- **R39**: Department statistics are sorted by `totalValue` in descending order.

## Precedence and conflict resolution

### Explicit Precedence Order (Highest Wins)

1. **Won Status Detection**: `pipeline_status` checked before `status` field (R1, R2)
2. **Revenue Field**: `total_price_with_tax` preferred over `total_price` (R9, R10)
3. **Date for Year Filtering**: Per Estimates spec R2, priority order: `contract_end` → `contract_start` → `estimate_date` → `created_date` (R22)
4. **Duplicate Estimates**: First occurrence by `lmn_estimate_id` kept (R29, R30)
5. **Missing Division**: Defaults to 'Uncategorized' (R35)
6. **Missing Account Name**: Defaults to 'Unknown Account' (R37)

### Tie Breakers

- **Equal Total Values**: When sorting by `totalValue`, order is undefined (stable sort preserves insertion order)
- **Missing Dates**: Estimates without any valid date fields (`contract_end`, `contract_start`, `estimate_date`, or `created_date`) are excluded from year-based reports (per Estimates spec R2)
- **Zero Revenue**: Estimates with zero revenue are included in counts but contribute 0 to revenue sums

### Conflict Examples

1. **Pipeline Status vs Status Field Conflict**
   - Estimate: `{ pipeline_status: 'pending', status: 'contract signed' }`
   - Resolution: Pipeline status checked first (R1, R2). Since 'pending' does not contain 'sold', check status field. Status 'contract signed' matches won status (R3, R4). Result: WON.

2. **Revenue Field Conflict**
   - Estimate: `{ total_price: 10000, total_price_with_tax: 0 }`
   - Resolution: Use `total_price_with_tax` first (R9). Since it's 0, fall back to `total_price` (R10). Result: Revenue = 10000.

3. **Missing Division Conflict**
   - Estimate: `{ division: null, account_id: 'acc-123' }`
   - Resolution: Division is null, use 'Uncategorized' (R35). Result: Grouped under 'Uncategorized' department.

4. **Duplicate Estimate Conflict**
   - Estimates: `[{ lmn_estimate_id: 'EST123', ... }, { lmn_estimate_id: 'EST123', ... }]`
   - Resolution: Keep first occurrence, discard second (R29, R30). Result: Only first estimate included in calculations.

5. **Missing Account ID Conflict**
   - Estimate: `{ account_id: null, division: 'Sales' }`
   - Resolution: Account ID is null, exclude from account statistics (R33). Estimate still included in overall and department statistics. Result: Not shown in per-account breakdown.

## Examples

### Example 1: Overall Statistics Calculation

**Input Data:**
```javascript
estimates = [
  { id: '1', status: 'contract signed', pipeline_status: null, total_price_with_tax: 50000, total_price: 45000 },
  { id: '2', status: 'lost', pipeline_status: null, total_price_with_tax: 30000, total_price: 27000 },
  { id: '3', status: 'pending', pipeline_status: null, total_price_with_tax: 20000, total_price: 18000 },
  { id: '4', status: 'work complete', pipeline_status: 'sold', total_price_with_tax: 40000, total_price: 36000 }
]
```

**Expected Output:**
```javascript
{
  total: 4,
  won: 2,  // IDs 1 and 4 (R3, R1)
  lost: 1,  // ID 2 (R7)
  pending: 1,  // ID 3 (R8)
  decidedCount: 3,  // won + lost
  winRate: 66.7,  // (2 / 3) * 100, rounded to 1 decimal (R12, R15)
  totalValue: 140000,  // Sum of total_price_with_tax (R9)
  wonValue: 90000,  // Sum of won estimates' total_price_with_tax
  lostValue: 30000,
  pendingValue: 20000,
  estimatesVsWonRatio: '50.0',  // (2 / 4) * 100 (R16, R18)
  revenueVsWonRatio: '64.3'  // (90000 / 140000) * 100 (R17, R18)
}
```

**Rule IDs Involved:** R1, R3, R6, R7, R8, R9, R12, R15, R16, R17, R18

### Example 2: Account Statistics with Missing Account Name

**Input Data:**
```javascript
estimates = [
  { id: '1', account_id: 'acc-1', status: 'won', total_price_with_tax: 50000 },
  { id: '2', account_id: 'acc-1', status: 'lost', total_price_with_tax: 30000 },
  { id: '3', account_id: 'acc-2', status: 'won', total_price_with_tax: 40000 }
]
accounts = [
  { id: 'acc-1', name: 'Acme Corp' },
  { id: 'acc-2', name: null }  // Missing name
]
```

**Expected Output:**
```javascript
[
  {
    accountId: 'acc-2',
    accountName: 'Unknown Account',  // R37
    total: 1,
    won: 1,
    lost: 0,
    pending: 0,
    totalValue: 40000,
    wonValue: 40000,
    lostValue: 0,
    winRate: 0,  // R14 (decidedCount = 0)
    estimatesVsWonRatio: '100.0',
    revenueVsWonRatio: '100.0'
  },
  {
    accountId: 'acc-1',
    accountName: 'Acme Corp',
    total: 2,
    won: 1,
    lost: 1,
    pending: 0,
    totalValue: 80000,  // Sorted first by totalValue descending (R38)
    wonValue: 50000,
    lostValue: 30000,
    winRate: 50.0,  // (1 / 2) * 100 (R12)
    estimatesVsWonRatio: '50.0',
    revenueVsWonRatio: '62.5'
  }
]
```

**Rule IDs Involved:** R6, R7, R9, R12, R14, R16, R17, R18, R32, R37, R38

### Example 3: Department Statistics with Missing Division

**Input Data:**
```javascript
estimates = [
  { id: '1', division: 'Sales', status: 'won', total_price_with_tax: 50000 },
  { id: '2', division: 'Sales', status: 'lost', total_price_with_tax: 30000 },
  { id: '3', division: null, status: 'won', total_price_with_tax: 40000 },  // Missing division
  { id: '4', division: 'Marketing', status: 'won', total_price_with_tax: 20000 }
]
```

**Expected Output:**
```javascript
[
  {
    division: 'Sales',
    total: 2,
    won: 1,
    lost: 1,
    totalValue: 80000,  // Sorted first by totalValue descending (R39)
    wonValue: 50000,
    lostValue: 30000,
    winRate: 50.0,
    estimatesVsWonRatio: '50.0',
    revenueVsWonRatio: '62.5'
  },
  {
    division: 'Uncategorized',  // R35
    total: 1,
    won: 1,
    lost: 0,
    totalValue: 40000,
    wonValue: 40000,
    lostValue: 0,
    winRate: 0,  // R14
    estimatesVsWonRatio: '100.0',
    revenueVsWonRatio: '100.0'
  },
  {
    division: 'Marketing',
    total: 1,
    won: 1,
    lost: 0,
    totalValue: 20000,
    wonValue: 20000,
    lostValue: 0,
    winRate: 0,  // R14
    estimatesVsWonRatio: '100.0',
    revenueVsWonRatio: '100.0'
  }
]
```

**Rule IDs Involved:** R6, R9, R14, R16, R17, R18, R34, R35, R39

### Example 4: Year Filtering with Date Fallback

**Input Data:**
```javascript
estimates = [
  { id: '1', contract_end: '2025-03-15', contract_start: '2025-01-01', estimate_date: '2025-01-10', status: 'won', archived: false },
  { id: '2', contract_end: null, contract_start: '2025-02-01', estimate_date: '2025-02-20', status: 'won', archived: false },
  { id: '3', contract_end: '2024-12-31', contract_start: '2024-11-01', estimate_date: '2024-11-15', status: 'won', archived: false },
  { id: '4', contract_end: null, contract_start: null, estimate_date: null, created_date: null, status: 'won', archived: false },  // Missing all dates
  { id: '5', contract_end: '2025-06-01', contract_start: '2025-05-01', estimate_date: '2025-05-01', status: 'won', archived: true }  // Archived
]
year = 2025
salesPerformanceMode = true
```

**Expected Output:**
```javascript
[
  { id: '1' },  // Uses contract_end (2025) - R22 (Priority 1)
  { id: '2' }   // Uses contract_start (2025) - R22 (Priority 2 fallback)
  // ID 3 excluded (2024)
  // ID 4 excluded (no dates) - R23
  // ID 5 excluded (archived) - R21
]
```

**Rule IDs Involved:** R21, R22, R23

### Example 5: Revenue Calculation with Fallback

**Input Data:**
```javascript
estimates = [
  { id: '1', total_price_with_tax: 50000, total_price: 45000 },
  { id: '2', total_price_with_tax: null, total_price: 30000 },
  { id: '3', total_price_with_tax: 0, total_price: 20000 },
  { id: '4', total_price_with_tax: null, total_price: null }
]
```

**Expected Revenue Values:**
```javascript
[
  50000,  // Uses total_price_with_tax (R9)
  30000,  // Falls back to total_price (R10)
  20000,  // Falls back to total_price (R10, since total_price_with_tax is 0)
  0       // Both missing, treated as 0 (R11)
]
```

**Rule IDs Involved:** R9, R10, R11

### Example 6: Won Status Detection Priority

**Input Data:**
```javascript
estimates = [
  { id: '1', pipeline_status: 'sold', status: 'pending' },  // Pipeline status wins
  { id: '2', pipeline_status: null, status: 'contract signed' },  // Status field used
  { id: '3', pipeline_status: 'pending', status: 'work complete' },  // Status field used (pipeline doesn't contain 'sold')
  { id: '4', pipeline_status: null, status: 'lost' }
]
```

**Expected Won Status:**
```javascript
[
  true,   // R1 (pipeline_status contains 'sold')
  true,   // R3 (status matches won status)
  true,   // R3 (status matches won status, pipeline doesn't contain 'sold')
  false   // R7 (status is 'lost')
]
```

**Rule IDs Involved:** R1, R2, R3, R7

### Example 7: Duplicate Handling

**Input Data:**
```javascript
estimates = [
  { id: '1', lmn_estimate_id: 'EST123', status: 'won', total_price_with_tax: 50000 },
  { id: '2', lmn_estimate_id: 'EST123', status: 'lost', total_price_with_tax: 30000 },  // Duplicate
  { id: '3', lmn_estimate_id: null, status: 'won', total_price_with_tax: 40000 },  // No lmn_id
  { id: '4', lmn_estimate_id: null, status: 'won', total_price_with_tax: 20000 }  // No lmn_id
]
```

**Expected Output (after deduplication):**
```javascript
[
  { id: '1' },  // First occurrence kept (R30)
  { id: '3' },  // Included (no lmn_id, cannot deduplicate) (R31)
  { id: '4' }   // Included (no lmn_id, cannot deduplicate) (R31)
  // ID 2 excluded (duplicate)
]
```

**Rule IDs Involved:** R29, R30, R31

### Example 8: Win Rate with Zero Decided Count

**Input Data:**
```javascript
estimates = [
  { id: '1', status: 'pending', total_price_with_tax: 50000 },
  { id: '2', status: 'pending', total_price_with_tax: 30000 }
]
```

**Expected Win Rate:**
```javascript
{
  total: 2,
  won: 0,
  lost: 0,
  pending: 2,
  decidedCount: 0,
  winRate: 0  // R14 (avoids division by zero)
}
```

**Rule IDs Involved:** R8, R14

## Acceptance criteria

- **AC1**: Overall statistics correctly calculate won, lost, and pending counts using `isWonStatus()` function (R6, R7, R8).
- **AC2**: Win rate is calculated only from decided estimates (won + lost), excluding pending (R12, R13, R14).
- **AC3**: Revenue calculations use `total_price_with_tax` with fallback to `total_price` (R9, R10, R11).
- **AC4**: Account statistics group estimates by `account_id` and exclude estimates without `account_id` (R32, R33).
- **AC5**: Department statistics use 'Uncategorized' for missing divisions (R35).
- **AC6**: Account statistics use 'Unknown Account' for missing account names (R37).
- **AC7**: Won status detection checks `pipeline_status` before `status` field (R1, R2, R3).
- **AC8**: Year filtering excludes archived estimates and uses correct date field based on mode (R21, R22, R23).
- **AC9**: Duplicate estimates are removed by `lmn_estimate_id`, keeping first occurrence (R29, R30).
- **AC10**: All statistics are sorted by `totalValue` in descending order (R38, R39).
- **AC11**: Win rates and ratios are formatted to 1 decimal place (R15, R18).
- **AC12**: Estimates without any valid date fields (`contract_end`, `contract_start`, `estimate_date`, or `created_date`) are excluded from year-based reports (per Estimates spec R2).
- **AC13**: Multi-year contracts are treated as single-year contracts for count-based won/loss ratio calculations (appear only in determined year) (R40).
- **AC14**: Multi-year contracts use annualization for dollar-based revenue calculations (allocated to sequential years with annualized amounts) (R41).

## Special considerations

### Edge Cases

- **Zero Revenue Estimates**: Estimates with zero or negative revenue are included in counts but contribute 0 to revenue sums. This matches LMN compatibility requirements (R28).
- **Missing Account ID**: Estimates without `account_id` are excluded from per-account statistics but included in overall and department statistics.
- **All Pending Estimates**: If all estimates are pending (no won or lost), win rate is 0 (R14).
- **Missing Dates**: Estimates without both date fields are excluded from year-based filtering but may appear in other reports.
- **Invalid Years**: Years outside 2000-2100 range are excluded from year filtering (R25).

### Exceptions

- **LMN Compatibility**: The system includes `exclude_stats=true` estimates and zero-price estimates to match LMN's behavior (R27, R28). This is an exception to typical filtering logic.
- **Sold-Only Mode**: When `soldOnly=true`, the system excludes estimates with status containing "lost" but includes all other estimates (including pending) as "sold" (R26). This matches LMN's "Estimates Sold" definition.

### Backward Compatibility Notes

- **Revenue Field Change**: Previously used `total_price` with fallback to `total_price_with_tax`. Now uses `total_price_with_tax` with fallback to `total_price`. This may cause revenue values to change if estimates have different values in these fields.
- **Division Default Change**: Previously used 'Unknown' for missing divisions. Now uses 'Uncategorized'. This affects grouping and display of department statistics.

### Locale Considerations

- **Status Matching**: All status comparisons are case-insensitive and trimmed to handle variations in data entry.
- **Date Parsing**: Year extraction uses substring method (first 4 characters) to avoid timezone conversion issues with UTC dates.

### Accessibility Considerations

- **Percentage Display**: Percentages are displayed as numbers with "%" suffix for screen readers.
- **Currency Formatting**: Currency values use `formatCurrency()` function which provides readable formats (K, M suffixes) for large numbers.

## Telemetry and observability

### Key Events to Log

- **Estimate Classification**: Log when estimates are classified as won/lost/pending (for debugging status detection)
- **Revenue Calculation**: Log when revenue fallback occurs (total_price_with_tax missing, using total_price)
- **Duplicate Detection**: Log when duplicates are found and removed by `lmn_estimate_id`
- **Year Filtering**: Log when estimates are excluded due to missing dates or invalid years
- **Missing Data**: Log when estimates are excluded from account stats due to missing `account_id`

### Metrics That Indicate Drift or Failure

- **Win Rate Anomalies**: Sudden changes in win rate may indicate status detection issues
- **Revenue Discrepancies**: Large differences between `total_price_with_tax` and `total_price` usage may indicate data quality issues
- **Missing Division Count**: High number of 'Uncategorized' estimates may indicate data import issues
- **Duplicate Count**: High number of duplicates may indicate import process issues
- **Excluded Estimates**: High number of estimates excluded from year filtering may indicate date data quality issues

## Open questions for the product owner

1. **Sold-Only Mode Logic**: The current implementation includes all non-lost estimates as "sold" when `soldOnly=true`. Is this the intended behavior, or should it only include explicitly won estimates?

2. **Pending Estimates in Win Rate**: Currently, pending estimates are excluded from win rate calculation. Should pending estimates be treated differently (e.g., excluded from reports entirely, or included with a separate metric)?

3. **Zero Revenue Estimates**: Should estimates with zero revenue be excluded from revenue calculations but included in counts, or should they be treated differently?

4. **Duplicate Handling**: Should duplicates be handled differently (e.g., merge data, keep most recent, or flag for manual review)?

5. **Missing Account ID**: Should estimates without `account_id` be included in a separate "Unassigned" account group, or is excluding them from account stats the desired behavior?

## Change control

This spec governs behavior for the Won Loss Ratio Logic section. Any change to the behavior described in this spec requires explicit product owner approval before editing this file or modifying the related code.

The following changes were made and approved:
- **2024-XX-XX**: Changed revenue field preference from `total_price` (with fallback to `total_price_with_tax`) to `total_price_with_tax` (with fallback to `total_price`)
- **2024-XX-XX**: Changed missing division default from 'Unknown' to 'Uncategorized'
- **2025-01-09**: Added distinction between count-based and dollar-based multi-year contract handling. Count-based calculations (win rate, estimate counts) treat multi-year contracts as single-year using contract_start year. Dollar-based calculations (revenue, won value) continue using annualization (R40, R41).

