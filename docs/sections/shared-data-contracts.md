# Shared Data Contracts

## Purpose

This document defines common data structures and contracts used across multiple specification files. It serves as a single source of truth for data formats, reducing duplication and ensuring consistency.

## Core Entities

### Account

**Table**: `accounts`

```typescript
{
  id: string;                    // Primary key
  lmn_crm_id?: string;           // LMN CRM identifier (unique)
  name: string;                  // Required
  account_type: string;          // 'prospect', 'customer', 'renewal', 'churned', 'client', 'lead'
  status: string;                // 'active', 'archived', 'at_risk', 'negotiating', 'onboarding', 'churned'
  revenue_segment: string;       // 'A', 'B', 'C', 'D' (backward compatibility, stores selected year's segment)
  segment_by_year: jsonb;        // { "2024": "A", "2025": "B", ... } (historical segments)
  annual_revenue?: number;       // Stored revenue for selected year (backward compatibility)
  revenue_by_year: jsonb;        // { "2024": 50000, "2025": 75000, ... } (historical revenue)
  organization_score?: number;   // ICP scorecard score (0-100)
  tags: string[];                // Array of tags
  archived: boolean;            // Archive flag (preferred over status='archived')
  last_interaction_date?: Date;  // Last contact/interaction date
  renewal_date?: Date;           // Contract renewal date
  snoozed_until?: Date;          // Snooze expiration date
  icp_status?: string;           // ICP status (used for neglected accounts filtering)
  // Address fields
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  // Timestamps
  created_date?: Date;
  created_at?: Date;
  updated_at?: Date;
}
```

**Key Fields for Revenue**:
- `revenue_by_year`: Primary source for historical revenue (calculated during import)
- `annual_revenue`: Backward compatibility field (stores selected year's revenue)
- `segment_by_year`: Primary source for historical segments (calculated during import)
- `revenue_segment`: Backward compatibility field (stores selected year's segment)

**Key Fields for Filtering**:
- `archived`: Must be `false` for active accounts
- `status`: Used for status filtering
- `account_type`: Used for type filtering
- `revenue_segment`: Used for segment filtering (displays selected year's segment)

### Estimate

**Table**: `estimates`

```typescript
{
  id: string;                    // Primary key (UUID)
  lmn_estimate_id: string;      // LMN's estimate identifier (unique, required, immutable)
  estimate_number?: string;     // Human-readable estimate number
  estimate_type: string;        // "Standard" (project/one-time) or "Service" (ongoing/recurring)
  estimate_date?: Date;         // Date estimate was created (Priority 3 for year determination)
  contract_start?: Date;        // Contract start date (Priority 2 for year determination)
  contract_end?: Date;          // Contract end date (Priority 1 for year determination)
  project_name?: string;        // Project description
  version?: string;             // Estimate version/revision
  account_id?: string;          // Links to accounts table (FK)
  contact_id?: string;          // Links to contacts table (FK)
  lmn_contact_id?: string;      // LMN's contact identifier
  status: string;               // Estimate status (e.g., 'won', 'lost', 'contract signed')
  pipeline_status?: string;     // LMN pipeline status (e.g., 'sold', 'lost', 'pending')
  total_price?: number;         // Base price (preferred, always has a value even if 0)
  total_price_with_tax?: number; // Tax-inclusive price (fallback only if total_price is null/undefined, not if it's 0)
  division?: string;            // Department/division name
  address?: string;             // Project address
  archived: boolean;            // Archive flag
  exclude_stats?: boolean;      // Exclude from statistics flag
  created_date?: Date;          // Database creation date (Priority 4 for year determination)
  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}
```

**Year Determination Priority** (per Estimates spec R2):
1. `contract_end` (Priority 1)
2. `contract_start` (Priority 2)
3. `estimate_date` (Priority 3)
4. `created_date` (Priority 4)

**Price Field Priority** (per Revenue Logic spec R3):
1. `total_price` (preferred, always has a value even if 0)
2. `total_price_with_tax` (fallback only if `total_price` is null or undefined, not if it's 0, shows toast notification)

**Status Determination** (per Estimates spec R1, R11):
- Uses `isWonStatus()` which checks `pipeline_status` first, then `status`
- Case-insensitive comparison

### Revenue by Year (JSONB Structure)

**Field**: `accounts.revenue_by_year`

```json
{
  "2024": 50000,
  "2025": 75000,
  "2026": 60000
}
```

- **Keys**: Year as string (e.g., "2024", "2025")
- **Values**: Revenue amount as number (USD)
- **Calculation**: Done during import only (not updated by triggers)
- **Usage**: Primary source for revenue display and calculations
- **Null Handling**: Missing year = 0 revenue for that year

### Segment by Year (JSONB Structure)

**Field**: `accounts.segment_by_year`

```json
{
  "2024": "A",
  "2025": "B",
  "2026": "C"
}
```

- **Keys**: Year as string (e.g., "2024", "2025")
- **Values**: Segment as string ('A', 'B', 'C', or 'D')
- **Calculation**: Done during import only (not updated by triggers)
- **Usage**: Primary source for segment display
- **Null Handling**: Missing year = 'C' (default segment)

**Why Segments Change by Year:**

Segments are calculated **per year** based on **revenue percentage relative to total revenue for that specific year only** (not total revenue across all years). 

**Calculation Process (per year):**
1. For each year (2024, 2025, 2026, etc.), calculate the total revenue for THAT year only:
   - `totalRevenue[year] = sum of all accounts.revenue_by_year[year]`
2. For each account, calculate their percentage of that year's total:
   - `revenuePercentage = (account.revenue_by_year[year] / totalRevenue[year]) * 100`
3. Assign segment based on percentage thresholds for that year

**Important**: Total revenue is calculated separately for each year. The total revenue for 2024 is independent of the total revenue for 2025.

An account's segment can change year-to-year because:

1. **Account's revenue changes**: Account may have more/fewer won estimates in different years
2. **Total revenue per year changes**: The sum of all accounts' revenue for a specific year can differ from other years
3. **Percentage thresholds**: Segments are assigned based on percentage:
   - Segment A: `(accountRevenue[year] / totalRevenue[year]) * 100 >= 15%`
   - Segment B: `5% <= (accountRevenue[year] / totalRevenue[year]) * 100 < 15%`
   - Segment C: `(accountRevenue[year] / totalRevenue[year]) * 100 < 5%`
   - Segment D: No Service estimates (Standard only) for that year

**Example:**
- **2024**: Account has $100k revenue, total revenue for 2024 is $500k → 20% → **Segment A**
- **2025**: Account has $100k revenue, but total revenue for 2025 is $2M → 5% → **Segment B**
- **2026**: Account has $50k revenue, total revenue for 2026 is $2M → 2.5% → **Segment C**

The same account can be Segment A in one year and Segment C in another, depending on their revenue relative to the total revenue **for that specific year**.

### Notification Cache

**Table**: `notification_cache`

```typescript
{
  cache_key: string;            // Primary key: 'at-risk-accounts' or 'neglected-accounts'
  cache_data: jsonb;            // Cached calculation results
  expires_at: Date;             // When cache expires
  updated_at: Date;             // Last update timestamp
}
```

**Cache Data Structure**:
```json
{
  "accounts": [
    // Array of account objects (structure varies by cache type)
  ],
  "updated_at": "2024-01-15T10:30:00Z",
  "count": 42
}
```

### Profile

**Table**: `profiles`

```typescript
{
  id: string;                    // Primary key (UUID)
  selected_year?: number;        // User's selected year (2000-2100, persists across sessions)
  // ... other profile fields
}
```

## Common Patterns

### Year Selection
- **Source**: `YearSelectorContext` (site-wide, user-selectable)
- **Storage**: `profiles.selected_year` (server) + `localStorage.selectedYear` (client)
- **Fallback**: None (selected year must be set)
- **Usage**: All revenue calculations, reports, and filtering use selected year

### Revenue Calculation
- **Source**: `accounts.revenue_by_year[selectedYear]` (stored, not calculated)
- **Calculation**: Done during import only
- **Display**: Read from stored field (instant year switching)

### Segment Calculation
- **Source**: `accounts.segment_by_year[selectedYear]` (stored, not calculated)
- **Calculation**: Done during import only
- **Display**: Read from stored field (instant year switching)

### Date Priority (Year Determination)
1. `contract_end` (highest priority)
2. `contract_start`
3. `estimate_date`
4. `created_date` (lowest priority)

### Archive Status
- **Primary**: `archived` boolean field
- **Fallback**: `status === 'archived'`
- **Rule**: If `archived === true`, account is archived regardless of status

## References

- **Accounts Spec**: `docs/sections/accounts.md`
- **Estimates Spec**: `docs/sections/estimates.md`
- **Revenue Logic Spec**: `docs/sections/revenue-logic.md`
- **Segmentation Spec**: `docs/sections/segmentation.md`
- **Year Selection Spec**: `docs/sections/year-selection-system.md`

## Change Control

This document defines shared data contracts used across multiple specs. Any changes to these structures require:
1. Approval from product owner
2. Update all affected spec files
3. Update code implementations
4. Update this document

