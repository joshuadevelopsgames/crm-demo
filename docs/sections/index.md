# Application Sections - Master Index

This document serves as the master index of all major application sections and their specifications.

## Sections

### At-Risk Accounts
- **Name**: At-Risk Accounts
- **Slug**: `at-risk-accounts`
- **Spec Path**: `docs/sections/at-risk-accounts.md`
- **Primary Code Locations**:
  - `src/utils/atRiskCalculator.js` - Core calculation logic
  - `src/pages/Dashboard.jsx` - Display and stats
  - `src/pages/Accounts.jsx` - Filtering by at-risk status
  - `api/cron/refresh-notifications.js` - Background cache refresh
  - `api/notifications.js` - API endpoint for fetching at-risk accounts
  - `create_at_risk_accounts_table.sql` - Database table schema
  - `manage_at_risk_accounts_functions.sql` - Database functions
  - `at_risk_accounts_triggers.sql` - Database triggers
- **Owner**: Product Owner
- **Test Coverage Status**: Partial (diagnostic scripts exist, unit tests needed)

### Accounts
- **Name**: Accounts
- **Slug**: `accounts`
- **Spec Path**: `docs/sections/accounts.md`
- **Primary Code Locations**:
  - `src/pages/Accounts.jsx` - Main accounts listing page with filtering and sorting
  - `src/pages/AccountDetail.jsx` - Individual account detail page
  - `api/data/accounts.js` - API endpoint for CRUD operations
  - `src/api/base44Client.js` - Client wrapper for account operations
  - `src/utils/revenueSegmentCalculator.js` - Revenue calculation and segment assignment
  - `src/components/account/TotalWork.jsx` - Contract duration and revenue display
  - `src/components/ImportLeadsDialog.jsx` - Import with auto segment recalculation
- **Owner**: Product Owner
- **Test Coverage Status**: Partial (test mode exists, unit tests needed)

### Won Loss Ratio Logic
- **Name**: Won Loss Ratio Logic
- **Slug**: `won-loss-ratio`
- **Spec Path**: `docs/sections/won-loss-ratio.md`
- **Primary Code Locations**:
  - `src/utils/reportCalculations.js` - Core calculation functions (isWonStatus, calculateOverallStats, calculateAccountStats, calculateDepartmentStats, filterEstimatesByYear)
  - `src/components/reports/WinLossReport.jsx` - Win/Loss report UI component
  - `src/pages/Reports.jsx` - Reports page with year filtering and statistics display
  - `src/components/reports/AccountPerformanceReport.jsx` - Account performance report component
  - `src/components/reports/DepartmentReport.jsx` - Department report component
  - `api/data/estimates.js` - API endpoint for fetching estimates
- **Owner**: Product Owner
- **Test Coverage Status**: Partial (test scripts exist, unit tests needed)

### Neglected Accounts
- **Name**: Neglected Accounts
- **Slug**: `neglected-accounts`
- **Spec Path**: `docs/sections/neglected-accounts.md`
- **Primary Code Locations**:
  - `src/utils/atRiskCalculator.js` - Core calculation logic (`calculateNeglectedAccounts`)
  - `src/pages/Dashboard.jsx` - Display and stats
  - `src/pages/NeglectedAccounts.jsx` - Dedicated neglected accounts page
  - `src/pages/Accounts.jsx` - Neglect status badges and filtering
  - `src/components/NotificationBell.jsx` - Notification count display
  - `api/cron/refresh-notifications.js` - Background cache refresh
  - `api/admin/refresh-cache.js` - Manual cache refresh (admin)
  - `api/notifications.js` - API endpoint for fetching neglected accounts
- **Owner**: Product Owner
- **Test Coverage Status**: Partial (diagnostic logging exists, unit tests needed)

### Notification Caching
- **Name**: Notification Caching
- **Slug**: `notification-caching`
- **Spec Path**: `docs/sections/notification-caching.md`
- **Primary Code Locations**:
  - `api/cron/refresh-notifications.js` - Background cache refresh job
  - `api/admin/refresh-cache.js` - Manual cache refresh endpoint
  - `api/notifications.js` - Cache retrieval endpoint
  - `create_notification_cache_table.sql` - Database table schema
- **Owner**: Product Owner
- **Test Coverage Status**: None (shared infrastructure, tested via at-risk and neglected accounts)

---

## Adding New Sections

When documenting a new section:

1. Add an entry to this index
2. Create `docs/sections/<section-slug>.md`
3. Update this index with:
   - Section name
   - Slug (kebab-case)
   - Spec path
   - Primary code locations (files, routes, components)
   - Owner
   - Test coverage status

## Status Legend

- **Spec Status**: `authoritative` | `draft` | `missing`
- **Test Coverage**: `none` | `partial` | `good` | `excellent`

