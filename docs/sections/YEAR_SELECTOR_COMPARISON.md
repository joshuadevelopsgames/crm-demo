# Year Selector Specs Comparison & Recommendations

## Current State

### year-selector.md (380 lines)
**Focus**: UI component and context implementation
- Detailed flow for YearSelectorContext initialization
- Year calculation from estimates
- Available years generation
- Persistence logic
- Global function exposure

### year-selection-system.md (362 lines)
**Focus**: System-wide behavior and integration
- How year selection affects all parts of the app
- Rules for using `getCurrentYear()` everywhere
- Integration points (revenue, reports, components)
- What IS and IS NOT affected by year selection

## Overlap Analysis

### Duplicate Content (Should be in ONE place)
1. **Year Determination Priority** - Identical in both (contract_end → contract_start → estimate_date → created_date)
2. **Available Years Calculation** - Same logic described in both
3. **Selected Year Initialization** - Same priority order (profile → localStorage → current year)
4. **Year Validation** - Same 2000-2100 range rules
5. **Examples** - Some overlap (year calculation examples)

### Unique to year-selector.md
- Detailed context initialization flow
- `yearRange` calculation details
- Global function implementation (`getCurrentYear()`, `getCurrentDate()`)
- Cache settings (10 minutes)
- UI-specific details (sorted descending, no gaps)

### Unique to year-selection-system.md
- System-wide integration rules (R6, R7, R8, R11, R12, R13)
- What IS affected by year selection (revenue, reports, stats)
- What IS NOT affected (account lists, at-risk, neglected)
- Multi-year contract allocation rules
- API requirements (R14)

## Recommended Changes

### Option A: Merge into Single Spec (RECOMMENDED)
**New file**: `year-selection.md` (combines both)

**Structure**:
1. Purpose - System-wide year selection
2. Data Contract - Sources, fields, types
3. Logic - End-to-end flow (from year-selector.md)
4. Rules - All rules from both specs (namespaced)
5. Integration - How it affects other systems (from year-selection-system.md)
6. Examples - Combined examples
7. Acceptance Criteria - Combined ACs

**Benefits**:
- Single source of truth
- No confusion about which spec to reference
- Easier maintenance
- Clearer for developers

### Option B: Split by Concern (Alternative)
**year-selector-context.md**: Implementation details
- Context initialization
- Year calculation logic
- Available years generation
- Persistence

**year-selection-integration.md**: System integration
- How year selection affects other systems
- Rules for using `getCurrentYear()`
- What is/isn't affected

**Drawbacks**:
- Still two files to maintain
- More complex dependency tracking
- Developers need to read both

## Recommendation: Option A (Merge)

**Rationale**:
1. The specs are tightly coupled - you can't understand one without the other
2. Most references point to both specs anyway
3. Single spec is easier to maintain and validate
4. Clearer for AI agents and developers

**Implementation Plan**:
1. Create new `year-selection.md` with merged content
2. Update all references in other specs
3. Delete `year-selector.md` and `year-selection-system.md`
4. Update `index.md`

