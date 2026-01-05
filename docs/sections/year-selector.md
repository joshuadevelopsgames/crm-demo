# Year Selector Specification

## Purpose

The Year Selector is a site-wide context that allows users to select a year for filtering and viewing data across the application. It determines which years are available based on actual estimate data, persists the user's selection across sessions (stored in user profile), and provides a consistent year context for all revenue calculations, reports, and filtering throughout the application.

## Data Contract

### Sources

- **Estimates Table** (`estimates`): Primary source for determining available years
  - `contract_end` (timestamptz): Priority 1 for year determination (per Estimates spec R2)
  - `contract_start` (timestamptz): Priority 2 for year determination (per Estimates spec R2)
  - `estimate_date` (timestamptz): Priority 3 for year determination (per Estimates spec R2)
  - `created_date` (timestamptz): Priority 4 for year determination (per Estimates spec R2)
  - `archived` (boolean): Archived estimates are excluded from year calculation

- **Profiles Table** (`profiles`): Stores user's selected year preference
  - `selected_year` (integer): User's selected year (persists across sessions)
  - `id` (uuid): User profile identifier

- **localStorage**: Fallback storage for selected year (used when profile not available)

### Fields Used

**Required:**
- At least one date field from estimates (`contract_end`, `contract_start`, `estimate_date`, or `created_date`)

**Optional:**
- `profiles.selected_year`: If null, defaults to current year
- `localStorage.selectedYear`: Fallback if profile not available

### Types and Units

- **Year**: Integer (e.g., 2024, 2025)
- **Year Range**: Object with `min` and `max` properties (integers)
- **Year Options**: Array of integers (actual years with estimates, sorted descending)
- **Selected Year**: Integer (2000-2100 range)

### Nullability Assumptions

- `profiles.selected_year` can be null (defaults to current year)
- Estimates may have null date fields (excluded from year calculation if all dates are null)
- `localStorage` may not be available (falls back to current year)

## Logic

### Ordered End-to-End Flow

1. **Fetch Estimates** (on app load)
   - Query `/api/data/estimates` to get all estimates
   - Cache for 10 minutes to reduce API calls

2. **Calculate Available Years** (from estimates)
   - Exclude archived estimates (per Estimates spec R12)
   - For each estimate, determine year using priority order (per Estimates spec R2):
     - Priority 1: `contract_end`
     - Priority 2: `contract_start`
     - Priority 3: `estimate_date`
     - Priority 4: `created_date`
   - Extract year from date (validate 2000-2100 range)
   - Collect unique years into Set
   - Calculate `yearRange`: `{ min: earliestYear, max: latestYear }`
   - Store `availableYears`: Array of actual years (no gaps filled)

3. **Load Selected Year** (initialization)
   - Priority 1: Load from `profile.selected_year` (if available)
   - Priority 2: Load from `localStorage.selectedYear` (if available)
   - Priority 3: Default to current year (`new Date().getFullYear()`)
   - Validate selected year is within 2000-2100 range

4. **Validate Selected Year** (after year range calculated)
   - If selected year < `yearRange.min`: Adjust to `yearRange.min`
   - If selected year > `yearRange.max`: Adjust to `yearRange.max`
   - If selected year not in `availableYears`: Adjust to closest valid year

5. **Generate Year Options** (for UI dropdown)
   - Use `availableYears` array (actual years with estimates)
   - Sort descending (most recent first) for better UX
   - Do NOT fill gaps between min and max (only show years with actual data)

6. **Persist Selection** (when user changes year)
   - Save to `profiles.selected_year` (server)
   - Save to `localStorage.selectedYear` (fallback)
   - Update global functions immediately for non-React code access

7. **Provide Context** (to all components)
   - `selectedYear`: Current selected year
   - `setYear(year)`: Function to change selected year
   - `getCurrentYear()`: Function to get current year (respects selection)
   - `getCurrentDate()`: Function to get current date (respects selection)
   - `yearRange`: `{ min, max }` object
   - `yearOptions`: Array of available years (sorted descending)

### Transformations

1. **Year Extraction**: Date field → Extract year → Validate 2000-2100 → Add to Set
2. **Year Range Calculation**: Set of years → Sort ascending → `{ min: first, max: last }`
3. **Year Options Generation**: Set of years → Array → Sort descending
4. **Selected Year Validation**: Selected year → Check against range → Adjust if needed

### Computations and Formulas

- **Year Range**: `{ min: Math.min(...years), max: Math.max(...years) }`
- **Year Options**: `Array.from(years).sort((a, b) => b - a)` (descending)
- **Year Validation**: `year >= 2000 && year <= 2100`

### Sorting and Grouping Rules

- **Year Options**: Sorted descending (most recent first)
- **Year Range**: Sorted ascending (min to max)
- **No Gap Filling**: Only actual years with estimates are included

## Rules

**R1**: Year determination uses priority order: `contract_end` → `contract_start` → `estimate_date` → `created_date` (per Estimates spec R2).

**R2**: Archived estimates are excluded from year calculation (per Estimates spec R12).

**R3**: Year validation: All years must be between 2000-2100 (inclusive). Years outside this range are invalid and excluded.

**R4**: Only years that actually have estimates are included in `yearOptions` (no gaps filled between min and max).

**R5**: Selected year persists across sessions (stored in `profiles.selected_year`).

**R6**: If selected year is outside available range, automatically adjust to closest valid year (`yearRange.min` or `yearRange.max`).

**R7**: Year options are sorted descending (most recent first) for better user experience.

**R8**: If no estimates exist, default to current year for both `yearRange` and `yearOptions`.

**R9**: Selected year initialization priority: `profile.selected_year` → `localStorage.selectedYear` → current year.

**R10**: Year selection is saved to both server (`profiles.selected_year`) and `localStorage` for redundancy.

**R11**: Global functions (`getCurrentYear()`, `getCurrentDate()`) are updated immediately when year selection changes.

**R12**: Year selector affects all revenue calculations, reports, and filtering throughout the application.

## Precedence and Conflict Resolution

### Year Determination Priority

**Priority 1**: `contract_end`
- If present and valid (2000-2100) → use this year
- If missing/invalid → fall to next priority

**Priority 2**: `contract_start`
- If present and valid (2000-2100) → use this year
- If missing/invalid → fall to next priority

**Priority 3**: `estimate_date`
- If present and valid (2000-2100) → use this year
- If missing/invalid → fall to next priority

**Priority 4**: `created_date`
- If present and valid (2000-2100) → use this year
- If missing/invalid → estimate excluded from year calculation

### Selected Year Initialization Priority

**Priority 1**: `profile.selected_year` (server)
- If available and valid (2000-2100) → use this
- If missing/invalid → fall to next priority

**Priority 2**: `localStorage.selectedYear` (client)
- If available and valid (2000-2100) → use this
- If missing/invalid → fall to next priority

**Priority 3**: Current year
- Default fallback: `new Date().getFullYear()`

### Conflict Examples

1. **Selected year outside available range**
   - Selected: 2020, Available: [2022, 2023, 2024]
   - Resolution: Adjust to 2022 (`yearRange.min`)

2. **Profile year conflicts with localStorage**
   - Profile: 2023, localStorage: 2024
   - Resolution: Use profile (Priority 1)

3. **Estimate has multiple date fields**
   - `contract_end = 2025`, `estimate_date = 2024`
   - Resolution: Use `contract_end = 2025` (Priority 1)

## Examples

### Example 1: Basic Year Calculation

**Input:**
```javascript
estimates = [
  { contract_end: '2024-12-31', archived: false },
  { contract_end: '2025-06-30', archived: false },
  { contract_start: '2023-01-01', archived: false },
  { archived: true } // Excluded
]
```

**Output:**
```javascript
{
  yearRange: { min: 2023, max: 2025 },
  availableYears: [2023, 2024, 2025],
  yearOptions: [2025, 2024, 2023] // Sorted descending
}
```

**Rule IDs**: R1, R2, R4, R7

### Example 2: No Gaps Filled

**Input:**
```javascript
estimates = [
  { contract_end: '2020-12-31' },
  { contract_end: '2025-06-30' }
]
```

**Output:**
```javascript
{
  yearRange: { min: 2020, max: 2025 },
  availableYears: [2020, 2025], // NOT [2020, 2021, 2022, 2023, 2024, 2025]
  yearOptions: [2025, 2020]
}
```

**Rule IDs**: R4, R7

### Example 3: Selected Year Adjustment

**Input:**
```javascript
selectedYear: 2020
availableYears: [2022, 2023, 2024]
yearRange: { min: 2022, max: 2024 }
```

**Output:**
```javascript
selectedYear: 2022 // Adjusted to yearRange.min
```

**Rule IDs**: R6

### Example 4: Year Validation

**Input:**
```javascript
estimates = [
  { contract_end: '1999-12-31' }, // Invalid (< 2000)
  { contract_end: '2101-01-01' },  // Invalid (> 2100)
  { contract_end: '2024-06-30' }   // Valid
]
```

**Output:**
```javascript
{
  availableYears: [2024], // Only valid year included
  yearRange: { min: 2024, max: 2024 }
}
```

**Rule IDs**: R3

### Example 5: Initialization Priority

**Input:**
```javascript
profile: { selected_year: 2023 }
localStorage: { selectedYear: '2024' }
```

**Output:**
```javascript
selectedYear: 2023 // Profile takes priority
```

**Rule IDs**: R9

## Acceptance Criteria

**AC1**: Year selector calculates available years from non-archived estimates using correct date priority (R1, R2).

**AC2**: Only years that actually have estimates are shown in year options (no gaps filled) (R4).

**AC3**: Year options are sorted descending (most recent first) (R7).

**AC4**: Selected year persists across sessions (stored in user profile) (R5).

**AC5**: Selected year is automatically adjusted if outside available range (R6).

**AC6**: Year validation excludes years outside 2000-2100 range (R3).

**AC7**: Selected year initialization uses correct priority order (profile → localStorage → current year) (R9).

**AC8**: Year selection is saved to both server and localStorage (R10).

**AC9**: Global functions are updated immediately when year selection changes (R11).

**AC10**: Year selector affects all revenue calculations and reports throughout the application (R12).

## Special Considerations

### Edge Cases

- **No Estimates**: Defaults to current year for both range and options
- **All Estimates Archived**: Same as no estimates (defaults to current year)
- **Selected Year Outside Range**: Automatically adjusted to closest valid year
- **Invalid Years in Data**: Excluded from calculation (2000-2100 validation)
- **localStorage Unavailable**: Falls back to current year

### Exceptions

- **Year Range Calculation**: Uses all non-archived estimates (not filtered by status)
- **Year Options**: Only includes years with actual estimates (no gap filling)

### Backward Compatibility

- **Test Mode**: Previously used `TestModeContext`, now replaced with Year Selector
- **Year Persistence**: New feature (previously no persistence)

### Performance Considerations

- Estimates query cached for 10 minutes to reduce API calls
- Year calculation uses `useMemo` to avoid recalculation on every render
- Year options sorted once and memoized

### Integration Points

- **Revenue Calculations**: All revenue calculations use `getCurrentYear()` from context
- **Reports**: All reports filter by selected year
- **Accounts**: Account revenue calculated for selected year
- **Estimates**: Estimates filtered by selected year in reports

## Telemetry and Observability

### Key Events to Log

- Year selection changes (user action)
- Year range calculation (on estimates load)
- Selected year adjustment (when outside range)
- Year validation failures (invalid years excluded)
- Profile sync failures (fallback to localStorage)

### Metrics to Monitor

- Year range size (min to max span)
- Number of available years
- Selected year distribution (which years users select)
- Year adjustment frequency (how often selected year is adjusted)
- Profile sync success rate

### Drift Indicators

- Year range not matching actual estimate data
- Selected year outside available range (should auto-adjust)
- Year options including years with no estimates (violates R4)
- Year validation not working (invalid years included)

## Open Questions for the Product Owner

None at this time.

## Change Control

This spec governs behavior for the Year Selector context. Any change requires explicit product owner approval before editing this file.

## References

- Estimates Spec: `docs/sections/estimates.md` (R2, R12)
- Revenue Logic Spec: `docs/sections/revenue-logic.md` (R21, R23)
- Won Loss Ratio Spec: `docs/sections/won-loss-ratio.md` (R22, R24)
- YearSelectorContext: `src/contexts/YearSelectorContext.jsx`

