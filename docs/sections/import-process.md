# Import Process Specification

## Purpose

This document defines how the CSV import process coordinates multiple systems and specifications. The import process is the primary mechanism for updating account, contact, estimate, revenue, and segment data in the system.

## Data Contract

### Sources

- **CSV Files**: Imported from LMN CRM export
  - `Leads List.xlsx` → Accounts and Contacts
  - `Estimates List.xlsx` → Estimates
  - Both files imported together in single import operation

### Outputs

- **Accounts Table**: Updated with imported account data
- **Contacts Table**: Updated with imported contact data
- **Estimates Table**: Updated with imported estimate data
- **Revenue Calculations**: `revenue_by_year` calculated and stored for all years
- **Segment Calculations**: `segment_by_year` calculated and stored for all years

## Logic

### Ordered End-to-End Flow

1. **Parse CSV Files**
   - Parse `Leads List.xlsx` → Accounts and Contacts
   - Parse `Estimates List.xlsx` → Estimates
   - Link estimates to accounts/contacts via `lmn_crm_id` matching

2. **Update Database**
   - Upsert accounts (create or update by `lmn_crm_id`)
   - Upsert contacts (create or update by `lmn_crm_id`)
   - Upsert estimates (create or update by `lmn_estimate_id`)

3. **Calculate Revenue for All Years** (per Revenue Logic spec)
   - For each account:
     - Filter won estimates
     - Determine year for each estimate (using date priority)
     - Calculate annualized revenue for multi-year contracts
     - Allocate revenue to appropriate years
     - Store in `revenue_by_year` JSONB: `{ "2024": 50000, "2025": 75000, ... }`
   - Also set `annual_revenue` to selected year's value (backward compatibility)

4. **Calculate Segments for All Years** (per Segmentation spec)
   - For each year (2024, 2025, 2026, etc.):
     - Calculate total revenue for THAT year only: `totalRevenue[year] = sum of all accounts.revenue_by_year[year]`
     - For each account:
       - Check Segment D (Standard only, no Service) for that year
       - Calculate revenue percentage: `(account.revenue_by_year[year] / totalRevenue[year]) * 100`
       - Assign A/B/C based on percentage thresholds
     - Store in `segment_by_year` JSONB: `{ "2024": "A", "2025": "B", ... }`
   - Also set `revenue_segment` to selected year's segment (backward compatibility)
   
   **Important**: Total revenue is calculated separately for each year. The total revenue for 2024 is independent of the total revenue for 2025. When calculating segments for 2024, we only use the total revenue for 2024, not the sum across all years.

5. **Invalidate Caches** (per Notification Caching spec)
   - Invalidate React Query caches for: accounts, contacts, estimates, scorecards
   - Force refetch of active queries
   - Notification cache will refresh automatically via cron (no manual invalidation needed)

6. **User Notification**
   - Show success/error message
   - Display import statistics (accounts created/updated, estimates imported)

## Simplified Overview: Most Important Logic Rules

### Revenue Calculation (During Import)

**R1**: Revenue is calculated for ALL years (not just selected year)
- Process all won estimates
- Determine year for each estimate using date priority: `contract_end` → `contract_start` → `estimate_date` → `created_date`
- Annualize multi-year contracts: `annualAmount = totalPrice / contractYears`
- Allocate to years: `[startYear, startYear+1, ..., startYear+(years-1)]`
- Store in `revenue_by_year`: `{ "2024": 50000, "2025": 75000, ... }`

**R2**: `annual_revenue` stores selected year's value (backward compatibility)
- Set `annual_revenue = revenue_by_year[selectedYear]`
- Used for legacy code that hasn't migrated to `revenue_by_year`

### Segment Calculation (During Import)

**R3**: Segments are calculated for ALL years (not just selected year)
- For each year (2024, 2025, 2026, etc.):
  - Calculate total revenue for THAT year only: `totalRevenue[year] = sum(all accounts' revenue_by_year[year])`
  - For each account:
    - Check Segment D: Has Standard won estimates AND no Service won estimates for that year
    - If not D: Calculate percentage: `(account.revenue_by_year[year] / totalRevenue[year]) * 100`
    - Assign A/B/C: `>=15%` → A, `5-15%` → B, `<5%` → C
- Store in `segment_by_year`: `{ "2024": "A", "2025": "B", ... }`
  
  **Important**: Total revenue is calculated separately for each year. The total revenue for 2024 is independent of the total revenue for 2025.

**R4**: `revenue_segment` stores selected year's segment (backward compatibility)
- Set `revenue_segment = segment_by_year[selectedYear]`
- Used for legacy code that hasn't migrated to `segment_by_year`

### Data Linking

**R5**: Estimates linked to accounts via `lmn_crm_id` matching
- Match `estimate.account_id` (from CSV) to `account.lmn_crm_id`
- If no match, estimate is created without account link

**R6**: Estimates linked to contacts via `lmn_contact_id` matching
- Match `estimate.lmn_contact_id` to `contact.lmn_contact_id`
- If no match, estimate is created without contact link

### Cache Invalidation

**R7**: React Query caches invalidated after import
- Invalidate: `['accounts']`, `['contacts']`, `['estimates']`, `['scorecards']`
- Force refetch of active queries
- Notification cache refreshes automatically (no manual invalidation)

## Rules

**R1**: Revenue calculated for all years during import, stored in `revenue_by_year` JSONB field.

**R2**: `annual_revenue` field stores selected year's value (backward compatibility).

**R3**: Segments calculated for all years during import, stored in `segment_by_year` JSONB field.

**R4**: `revenue_segment` field stores selected year's segment (backward compatibility).

**R5**: Estimates linked to accounts via `lmn_crm_id` matching during import.

**R6**: Estimates linked to contacts via `lmn_contact_id` matching during import.

**R7**: React Query caches invalidated after successful import.

**R8**: Import continues even if segment recalculation fails (non-blocking, errors logged).

## Examples

### Example 1: Basic Import

**Input:**
- `Leads List.xlsx`: 100 accounts, 200 contacts
- `Estimates List.xlsx`: 500 estimates (300 won, 200 lost)

**Process:**
1. Parse and upsert: 100 accounts, 200 contacts, 500 estimates
2. Calculate revenue for all years from 300 won estimates
3. Calculate segments for all years based on revenue percentages
4. Invalidate caches

**Output:**
- Database updated with all data
- `revenue_by_year` populated for all accounts
- `segment_by_year` populated for all accounts
- Caches invalidated, UI refreshes

### Example 2: Multi-Year Revenue

**Input:**
- Account with 1 won estimate: $300k, 3-year contract (2024-2026)

**Process:**
1. Annualize: $300k / 3 = $100k per year
2. Allocate: `{ "2024": 100000, "2025": 100000, "2026": 100000 }`
3. Store in `revenue_by_year`

**Output:**
- `account.revenue_by_year = { "2024": 100000, "2025": 100000, "2026": 100000 }`
- If selected year = 2025, `annual_revenue = 100000`

## Acceptance Criteria

**AC1**: Revenue calculated for all years during import and stored in `revenue_by_year`. (R1)

**AC2**: `annual_revenue` stores selected year's value. (R2)

**AC3**: Segments calculated for all years during import and stored in `segment_by_year`. (R3)

**AC4**: `revenue_segment` stores selected year's segment. (R4)

**AC5**: Estimates linked to accounts via `lmn_crm_id` matching. (R5)

**AC6**: Estimates linked to contacts via `lmn_contact_id` matching. (R6)

**AC7**: React Query caches invalidated after successful import. (R7)

**AC8**: Import continues even if segment recalculation fails. (R8)

## References

- **Revenue Logic Spec**: `docs/sections/revenue-logic.md` (R11, R12, R25)
- **Segmentation Spec**: `docs/sections/segmentation.md` (R1-R10)
- **Accounts Spec**: `docs/sections/accounts.md` (R5, R6, R18, R19)
- **Estimates Spec**: `docs/sections/estimates.md` (R1, R2)
- **Notification Caching Spec**: `docs/sections/notification-caching.md`
- **Import Component**: `src/components/ImportLeadsDialog.jsx`

## Change Control

This spec governs the import process coordination. Any change requires explicit product owner approval before editing this file.

