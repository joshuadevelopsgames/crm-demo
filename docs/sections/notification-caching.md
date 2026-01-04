# Notification Caching Specification

## Purpose

This document defines the unified caching system used by both **At-Risk Accounts** and **Neglected Accounts** sections. The cache provides fast, consistent access to calculated notification data while reducing database load.

## Data Contract

### Cache Table Structure

**Table**: `notification_cache`

| Column | Type | Description |
|--------|------|-------------|
| `cache_key` | text (PK) | Unique identifier: `'at-risk-accounts'` or `'neglected-accounts'` |
| `cache_data` | jsonb | Cached calculation results (see structure below) |
| `expires_at` | timestamptz | When cache expires and should be refreshed |
| `updated_at` | timestamptz | Last update timestamp |

### Cache Data Structure

```json
{
  "accounts": [
    // Array of account objects (structure varies by cache type)
  ],
  "updated_at": "2024-01-15T10:30:00Z",
  "count": 42
}
```

### Cache Keys

- **`'at-risk-accounts'`**: Cached at-risk account calculations
- **`'neglected-accounts'`**: Cached neglected account calculations

## Logic

### Cache Refresh Flow

1. **Background Job** (`api/cron/refresh-notifications.js`)
   - Runs every 5 minutes via Vercel Cron
   - Fetches all non-archived accounts (with pagination)
   - Fetches all non-archived estimates (with pagination, for at-risk only)
   - Fetches all notification snoozes
   - Calls calculation functions:
     - `calculateAtRiskAccounts(accounts, estimates, snoozes)`
     - `calculateNeglectedAccounts(accounts, snoozes)`
   - Updates both cache entries in parallel
   - Sets `expires_at` to 5 minutes from now
   - Broadcasts updates via Supabase Realtime

2. **Manual Refresh** (`api/admin/refresh-cache.js`)
   - Admin-only endpoint (requires admin/system_admin role)
   - Same calculation logic as background job
   - Useful for:
     - Initial setup
     - After bulk data imports
     - Debugging cache issues
     - Immediate refresh after data changes

3. **Cache Retrieval** (`api/notifications.js`)
   - Endpoint: `GET /api/notifications?type=<cache-key>`
   - Queries `notification_cache` table by `cache_key`
   - Returns cached data if:
     - Cache exists
     - `expires_at > now()`
   - Returns empty array with `stale: true` if:
     - Cache expired
     - Cache missing
     - Table doesn't exist

### Cache Update Rules

**R1**: Cache is updated every 5 minutes by background cron job.

**R2**: Cache expires 5 minutes after last update (`expires_at = updated_at + 5 minutes`).

**R3**: If cache is expired or missing, API returns empty array with `stale: true` flag.

**R4**: Cache updates use `UPSERT` with `onConflict: 'cache_key'` to ensure single record per key.

**R5**: Cache updates are atomic - both cache keys updated in parallel via `Promise.all()`.

**R6**: Background job fetches data with pagination (1000 rows per page) to handle large datasets.

**R7**: Manual refresh requires admin authentication (admin/system_admin role or system admin email).

**R8**: Cache data structure must include `accounts` array, `updated_at` timestamp, and `count` integer.

**R9**: Cache invalidation on data changes: When account data changes (e.g., `last_interaction_date`, `archived`, `icp_status`, `revenue_segment`), database triggers update notifications in real-time. However, the cache is eventually consistent - it refreshes every 5 minutes via background job. For immediate updates after data changes, use manual refresh endpoint (`/api/admin/refresh-cache.js`).

## Precedence and Conflict Resolution

### Cache vs Real-Time Calculation

- **UI Display**: Always uses cache (via `/api/notifications` endpoint)
- **Manual Refresh**: Bypasses cache, recalculates immediately
- **Background Job**: Updates cache, doesn't affect current UI until next fetch

### Stale Cache Handling

- **Expired Cache**: UI shows empty state with message "Cache expired. Background job will refresh shortly."
- **Missing Cache**: UI shows empty state with message "Cache not available. Background job will create it shortly."
- **No Fallback**: UI does NOT fall back to real-time calculation (prevents performance issues)

## Examples

### Example 1: Normal Cache Flow

**Input**: Background job runs at 10:00:00

**Process**:
1. Fetches 500 accounts, 200 estimates, 10 snoozes
2. Calculates: 25 at-risk accounts, 15 neglected accounts
3. Updates cache:
   - `cache_key: 'at-risk-accounts'`, `expires_at: 10:05:00`
   - `cache_key: 'neglected-accounts'`, `expires_at: 10:05:00`

**Output**: Both caches updated, expires in 5 minutes

### Example 2: Expired Cache Retrieval

**Input**: User requests `/api/notifications?type=at-risk-accounts` at 10:06:00 (cache expired)

**Process**:
1. Query cache: `expires_at = 10:05:00 < now() = 10:06:00`
2. Cache is expired

**Output**: 
```json
{
  "success": true,
  "data": [],
  "stale": true,
  "message": "Cache expired or missing. Background job will refresh shortly."
}
```

### Example 3: Manual Refresh

**Input**: Admin calls `POST /api/admin/refresh-cache` with valid admin token

**Process**:
1. Verify admin role
2. Fetch all accounts, estimates, snoozes
3. Recalculate both cache types
4. Update cache with new `expires_at`

**Output**: 
```json
{
  "success": true,
  "data": {
    "atRiskCount": 25,
    "neglectedCount": 15,
    "duplicateCount": 2
  },
  "message": "Cache refreshed successfully. 25 at-risk accounts, 15 neglected accounts."
}
```

## Acceptance Criteria

**AC1**: Background job runs every 5 minutes and updates both cache entries. (R1)

**AC2**: Cache expires exactly 5 minutes after update. (R2)

**AC3**: Expired or missing cache returns empty array with `stale: true`. (R3)

**AC4**: Each cache key has exactly one record (UPSERT prevents duplicates). (R4)

**AC5**: Both cache entries updated atomically (no partial updates). (R5)

**AC6**: Background job handles datasets > 1000 rows via pagination. (R6)

**AC7**: Manual refresh requires admin authentication. (R7)

**AC8**: Cache data structure includes required fields: `accounts`, `updated_at`, `count`. (R8)

**AC9**: Cache is eventually consistent - data changes trigger real-time notification updates via database triggers, but cache refreshes every 5 minutes. Manual refresh available for immediate updates. (R9)

## Special Considerations

### Performance

- Cache reduces database load by avoiding real-time calculations on every page load
- Pagination prevents memory issues with large datasets
- Parallel cache updates minimize refresh time

### Consistency

- Cache may be up to 5 minutes stale
- UI shows `stale: true` flag when cache is expired
- Background job ensures cache is refreshed regularly
- **Cache invalidation on data changes**: When account data changes (e.g., `last_interaction_date`, `archived`, `icp_status`, `revenue_segment`), database triggers update notifications in real-time. However, the cache is eventually consistent - it refreshes every 5 minutes via background job. For immediate updates, use manual refresh endpoint (`/api/admin/refresh-cache.js`).

### Error Handling

- If background job fails, cache remains until next successful run
- If manual refresh fails, returns error without updating cache
- Missing cache table returns empty array (graceful degradation)

### Supabase Realtime

- Cache updates automatically broadcast to connected clients
- UI components can subscribe to cache changes for real-time updates
- Reduces need for polling

## Telemetry and Observability

### Key Events to Log

- Cache refresh start/completion (background job)
- Cache expiration (API retrieval)
- Manual refresh requests (admin action)
- Cache update errors
- Pagination counts (accounts/estimates fetched)

### Metrics to Monitor

- Cache hit rate (valid cache vs expired/missing)
- Cache update duration
- Background job execution time
- Manual refresh frequency
- Cache size (number of accounts cached)

## Open Questions for the Product Owner

None - this caching system is well-established and follows the same pattern for both at-risk and neglected accounts.

## Change Control

This spec governs caching behavior for both At-Risk Accounts and Neglected Accounts sections.

Any change requires explicit product owner approval before editing this file.

## References

- At-Risk Accounts Spec: `docs/sections/at-risk-accounts.md`
- Neglected Accounts Spec: `docs/sections/neglected-accounts.md`
- Background Job: `api/cron/refresh-notifications.js`
- Manual Refresh: `api/admin/refresh-cache.js`
- Cache Retrieval: `api/notifications.js`

