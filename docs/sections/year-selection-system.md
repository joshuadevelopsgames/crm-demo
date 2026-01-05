# Year Selection System Specification

## Purpose

The Year Selection System is a site-wide mechanism that allows users to select a year for filtering and viewing data across the entire application. It provides a consistent, centralized way to filter revenue calculations, reports, statistics, and displays by year. The system ensures that when a user selects a year, all relevant data throughout the application automatically filters to that year.

## Data Contract

### Sources

- **YearSelectorContext** (`src/contexts/YearSelectorContext.jsx`): Central context provider
  - Fetches estimates from `/api/data/estimates` API endpoint
  - Calculates `availableYears` from actual estimate data in database
  - Stores `selectedYear` in user profile (`profiles.selected_year`) and localStorage
  - Exposes `getCurrentYear()` and `getCurrentDate()` globally

- **Estimates Table** (`estimates`): Primary data source for year filtering
  - `contract_end` (timestamptz): Priority 1 for year determination (per Estimates spec R2)
  - `contract_start` (timestamptz): Priority 2 for year determination (per Estimates spec R2)
  - `estimate_date` (timestamptz): Priority 3 for year determination (per Estimates spec R2)
  - `created_date` (timestamptz): Priority 4 for year determination (per Estimates spec R2)
  - `archived` (boolean): Archived estimates excluded from year calculations (per Estimates spec R12)

- **Profiles Table** (`profiles`): Stores user's selected year preference
  - `selected_year` (integer): User's selected year (persists across sessions and devices)

### Fields Used

**Required:**
- At least one date field from estimates (`contract_end`, `contract_start`, `estimate_date`, or `created_date`)
- `selectedYear` from YearSelectorContext (or fallback to current year)

**Optional:**
- `profiles.selected_year`: If null, defaults to current year
- `localStorage.selectedYear`: Fallback if profile not available

### Types and Units

- **Year**: Integer (e.g., 2024, 2025)
- **Selected Year**: Integer (2000-2100 range, validated)
- **Available Years**: Array of integers (actual years with estimates, sorted descending)
- **Year Range**: Object with `min` and `max` properties (integers)

## Logic

### Ordered End-to-End Flow

1. **Context Initialization** (on app load)
   - YearSelectorProvider wraps entire application
   - Fetches estimates from `/api/data/estimates` (cached 10 minutes)
   - Calculates `availableYears` from database estimates
   - Loads `selectedYear` from profile → localStorage → current year

2. **Year Determination** (for each estimate)
   - Uses standardized priority order (per Estimates spec R2):
     - Priority 1: `contract_end`
     - Priority 2: `contract_start`
     - Priority 3: `estimate_date`
     - Priority 4: `created_date`
   - Validates year is 2000-2100 range
   - Excludes archived estimates (per Estimates spec R12)

3. **Data Filtering** (throughout application)
   - All revenue calculations use `getCurrentYear()` from context
   - All reports use `filterEstimatesByYear()` or `getEstimateYearData()`
   - All components filter estimates by selected year
   - Multi-year contracts are annualized and allocated to selected year

4. **Persistence** (when year changes)
   - Saves to `profiles.selected_year` (server)
   - Saves to `localStorage.selectedYear` (fallback)
   - Updates global functions immediately

5. **Global Access** (for non-React code)
   - `getCurrentYear()` - Returns selected year
   - `getCurrentDate()` - Returns date with selected year
   - `window.__getCurrentYear()` - Available in any JavaScript
   - `window.__getCurrentDate()` - Available in any JavaScript
   - Custom event: `yearSelectionChanged` - Fires on year change

### Transformations

1. **Year Extraction**: Date field → Extract year → Validate 2000-2100 → Add to Set
2. **Available Years Calculation**: Set of years → Sort descending → Array
3. **Data Filtering**: Estimates → Filter by year (using date priority) → Filtered estimates
4. **Revenue Calculation**: Filtered estimates → Annualize multi-year contracts → Sum revenue

### Computations and Formulas

- **Year Extraction**: `parseInt(dateString.substring(0, 4))` or `date.getFullYear()`
- **Year Validation**: `year >= 2000 && year <= 2100`
- **Available Years**: `Array.from(years).sort((a, b) => b - a)` (descending)
- **Revenue Filtering**: `estimates.filter(est => getEstimateYearData(est, currentYear).appliesToCurrentYear)`

## Rules

**R1**: Year determination uses priority order: `contract_end` → `contract_start` → `estimate_date` → `created_date` (per Estimates spec R2). This priority MUST be used consistently across all year filtering logic.

**R2**: Archived estimates are excluded from all year-based calculations (per Estimates spec R12).

**R3**: Year validation: All years must be between 2000-2100 (inclusive). Years outside this range are invalid and excluded.

**R4**: Only years that actually have estimates are included in `availableYears` (no gaps filled between min and max).

**R5**: Selected year persists across sessions (stored in `profiles.selected_year` and `localStorage.selectedYear`).

**R6**: All revenue calculations MUST use `getCurrentYear()` from YearSelectorContext (not hardcoded year or `new Date().getFullYear()`).

**R7**: All year filtering MUST use the standardized date priority (R1) - no custom priority orders allowed.

**R8**: All components that display year-filtered data MUST use `getCurrentYear()` or `selectedYear` from context.

**R9**: Multi-year contracts are annualized and allocated to the selected year (not all years).

**R10**: The `getCurrentYear()` function MUST return the selected year, not the actual current year.

**R11**: Year selection affects: revenue calculations, reports, statistics, estimate counts, account scoring, and all year-based displays.

**R12**: Year selection does NOT affect: account lists (structure), contact lists, at-risk account detection (uses renewal dates), neglected account detection.

**R13**: All utilities that filter by year MUST accept the year as a parameter (not hardcode current year).

**R14**: The API endpoint `/api/data/estimates` MUST include `created_date` and `archived` fields for year calculation to work correctly.

## Precedence and Conflict Resolution

### Year Determination Priority (Highest Wins)

1. **Priority 1**: `contract_end` - If present and valid (2000-2100) → use this year
2. **Priority 2**: `contract_start` - If Priority 1 missing/invalid → use this year
3. **Priority 3**: `estimate_date` - If Priorities 1-2 missing/invalid → use this year
4. **Priority 4**: `created_date` - If Priorities 1-3 missing/invalid → use this year
5. **Exclude**: If all priorities missing/invalid → estimate excluded from year-based calculations

### Selected Year Initialization Priority

1. **Priority 1**: `profile.selected_year` (server) - If available and valid (2000-2100) → use this
2. **Priority 2**: `localStorage.selectedYear` (client) - If Priority 1 missing/invalid → use this
3. **Priority 3**: Current year - Default fallback: `new Date().getFullYear()`

### Conflict Examples

1. **Estimate has multiple date fields**
   - Estimate: `{ contract_end: '2025-06-30', estimate_date: '2024-12-01' }`
   - Resolution: Use `contract_end = 2025` (Priority 1, per R1)

2. **Selected year outside available range**
   - Selected: 2020, Available: [2022, 2023, 2024]
   - Resolution: Auto-adjust to 2022 (`yearRange.min`, per Year Selector spec R6)

3. **Component uses hardcoded year instead of context**
   - Code: `const year = new Date().getFullYear();`
   - Resolution: Must use `getCurrentYear()` from context (per R6, R8)

## Examples

### Example 1: Revenue Calculation Filtering

**Input:**
```javascript
selectedYear: 2024
estimates: [
  { contract_end: '2024-12-31', status: 'won', total_price_with_tax: 50000 },
  { contract_end: '2025-06-30', status: 'won', total_price_with_tax: 30000 },
  { contract_start: '2024-01-01', status: 'won', total_price_with_tax: 20000 }
]
```

**Process:**
1. Get selected year: `getCurrentYear()` → 2024
2. Filter estimates by year (using date priority):
   - Estimate 1: `contract_end = 2024` → Included
   - Estimate 2: `contract_end = 2025` → Excluded
   - Estimate 3: `contract_start = 2024` → Included (Priority 2)
3. Calculate revenue: $50,000 + $20,000 = $70,000

**Output:**
- Account revenue: $70,000 (for 2024)

**Rule IDs**: R1, R6, R8, R11

### Example 2: Multi-Year Contract Allocation

**Input:**
```javascript
selectedYear: 2025
estimate: {
  contract_start: '2024-01-01',
  contract_end: '2026-12-31',
  total_price_with_tax: 300000,
  status: 'won'
}
```

**Process:**
1. Get selected year: `getCurrentYear()` → 2025
2. Determine year: `contract_end = 2026` (Priority 1)
3. Calculate duration: 36 months → 3 years
4. Annualize: $300,000 / 3 = $100,000 per year
5. Allocate to years: [2024, 2025, 2026]
6. Check if 2025 is in allocation: Yes
7. Return value for 2025: $100,000

**Output:**
- Revenue for 2025: $100,000 (annualized portion)

**Rule IDs**: R1, R6, R9, R11

### Example 3: Report Filtering

**Input:**
```javascript
selectedYear: 2023
estimates: [
  { contract_end: '2023-06-15', status: 'won', division: 'Sales' },
  { contract_end: '2024-12-31', status: 'lost', division: 'Sales' },
  { estimate_date: '2023-01-10', status: 'won', division: 'Marketing' }
]
```

**Process:**
1. Use `filterEstimatesByYear(estimates, 2023)`
2. Filter by year (using date priority):
   - Estimate 1: `contract_end = 2023` → Included
   - Estimate 2: `contract_end = 2024` → Excluded
   - Estimate 3: `estimate_date = 2023` → Included (Priority 3)
3. Calculate statistics from filtered estimates

**Output:**
- Won estimates: 2
- Lost estimates: 0
- Departments: Sales (1), Marketing (1)

**Rule IDs**: R1, R7, R11

### Example 4: Component Year Filtering

**Input:**
```javascript
selectedYear: 2024
estimates: [
  { contract_end: '2024-12-31', status: 'won' },
  { contract_end: '2025-06-30', status: 'won' }
]
```

**Process:**
1. Component calls: `const currentYear = getCurrentYearForCalculation()` → 2024
2. Filter estimates:
   ```javascript
   const thisYearEstimates = estimates.filter(e => {
     const year = getYearFromDate(e.contract_end || e.contract_start || ...);
     return year === currentYear;
   });
   ```
3. Display count: `thisYearEstimates.length` → 1

**Output:**
- "This Year" count: 1
- "All Time" count: 2

**Rule IDs**: R1, R6, R8, R11

## Acceptance Criteria

**AC1**: All revenue calculations use `getCurrentYear()` from YearSelectorContext (not hardcoded year). (R6)

**AC2**: All year filtering uses standardized date priority: `contract_end` → `contract_start` → `estimate_date` → `created_date`. (R1, R7)

**AC3**: Archived estimates are excluded from all year-based calculations. (R2)

**AC4**: Selected year persists across sessions (stored in profile and localStorage). (R5)

**AC5**: Multi-year contracts are annualized and allocated to selected year only. (R9)

**AC6**: All components that display year-filtered data use `getCurrentYear()` or `selectedYear` from context. (R8)

**AC7**: The `getCurrentYear()` function returns selected year, not actual current year. (R10)

**AC8**: Year validation excludes years outside 2000-2100 range. (R3)

**AC9**: Available years only include years with actual estimates (no gaps filled). (R4)

**AC10**: API endpoint includes `created_date` and `archived` fields for year calculation. (R14)

## Special Considerations

### Edge Cases

- **No Estimates**: Defaults to current year for both range and available years
- **All Estimates Archived**: Same as no estimates (defaults to current year)
- **Selected Year Outside Range**: Automatically adjusted to closest valid year
- **Invalid Years in Data**: Excluded from calculation (2000-2100 validation)
- **Missing Date Fields**: Estimate excluded from year-based calculations
- **Multi-Year Contracts**: Annualized and allocated to selected year only

### Exceptions

- **Account Lists**: Show all accounts, but revenue is year-filtered
- **Contact Lists**: Not filtered by year
- **At-Risk Accounts**: Uses renewal dates, not year selector
- **Neglected Accounts**: Uses interaction dates, not year selector

### Performance Considerations

- Estimates query cached for 10 minutes to reduce API calls
- Year calculation uses `useMemo` to avoid recalculation on every render
- Global functions updated immediately when year changes

### Integration Points

- **Revenue Calculations**: All use `getCurrentYear()` from context
- **Reports**: All filter by selected year using `filterEstimatesByYear()`
- **Accounts**: Revenue calculated for selected year
- **Components**: Estimate counts and displays filtered by selected year
- **Utilities**: `getEstimateYearData()`, `calculateRevenueFromEstimates()` use selected year

## Telemetry and Observability

### Key Events to Log

- Year selection changes (user action)
- Year range calculation (on estimates load)
- Selected year adjustment (when outside range)
- Year validation failures (invalid years excluded)
- Profile sync failures (fallback to localStorage)
- Revenue calculation year filtering (for debugging)

### Metrics to Monitor

- Year range size (min to max span)
- Number of available years
- Selected year distribution (which years users select)
- Year adjustment frequency (how often selected year is adjusted)
- Profile sync success rate
- Revenue calculation accuracy (year filtering correctness)

### Drift Indicators

- Components using hardcoded year instead of `getCurrentYear()`
- Year filtering using custom priority order (not standardized)
- Revenue calculations not filtering by selected year
- Archived estimates included in year calculations
- Multi-year contracts not annualized correctly

## Open Questions for the Product Owner

None at this time.

## Change Control

This spec governs behavior for the Year Selection System across the entire application. Any change requires explicit product owner approval before editing this file.

## References

- Year Selector Spec: `docs/sections/year-selector.md`
- Estimates Spec: `docs/sections/estimates.md` (R2, R12)
- Revenue Logic Spec: `docs/sections/revenue-logic.md` (R21, R23)
- Won Loss Ratio Spec: `docs/sections/won-loss-ratio.md` (R22, R24)
- YearSelectorContext: `src/contexts/YearSelectorContext.jsx`

