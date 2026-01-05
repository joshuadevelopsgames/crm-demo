# Cache Invalidation Specification

## Purpose

This document defines when and how caches are invalidated across the application. The system uses two types of caching: React Query (client-side) and notification cache (server-side).

## Data Contract

### Cache Types

1. **React Query Cache** (client-side)
   - Caches: `['accounts']`, `['contacts']`, `['estimates']`, `['scorecards']`
   - Settings: `staleTime: 60 minutes`, `gcTime: 2 hours`
   - Invalidation: Manual via `queryClient.invalidateQueries()`

2. **Notification Cache** (server-side)
   - Table: `notification_cache`
   - Keys: `'at-risk-accounts'`, `'neglected-accounts'`
   - Refresh: Automatic via cron job (every 5 minutes)
   - Invalidation: Automatic expiration (5 minutes TTL)

## Logic

### React Query Cache Invalidation

**When Invalidated:**
1. **After Import** (per Import Process spec R7)
   - Invalidate: `['accounts']`, `['contacts']`, `['estimates']`, `['scorecards']`
   - Force refetch of active queries
   - Reason: Data only changes on import, so invalidation only needed after import

**When NOT Invalidated:**
- When estimates change via API (PUT/POST) - data only changes on import
- When accounts change via API - data only changes on import
- When data changes in another tab - data only changes on import
- When data changes externally - data only changes on import

**Rationale**: Data only changes on import, so cache invalidation only needed after import.

### Notification Cache Invalidation

**When Refreshed:**
1. **Automatic Cron Job** (every 5 minutes)
   - Runs: `api/cron/refresh-notifications.js`
   - Refreshes: `'at-risk-accounts'` and `'neglected-accounts'`
   - Sets: `expires_at = now + 5 minutes`

**When NOT Invalidated:**
- After import - cron will refresh automatically
- After estimate changes - cron will refresh automatically
- After account changes - cron will refresh automatically

**Rationale**: Cron job refreshes cache every 5 minutes, so manual invalidation not needed.

## Simplified Overview: Most Important Logic Rules

### React Query Cache

**R1**: Cache invalidated only after import
- Data only changes on import
- No invalidation needed for API changes (data doesn't change via API)
- No invalidation needed for external changes (data doesn't change externally)

**R2**: Cache settings optimized for static data
- `staleTime: 60 minutes` (data is fresh for 60 minutes)
- `gcTime: 2 hours` (keep in cache for 2 hours)
- `refetchOnWindowFocus: false` (don't refetch on window focus)

### Notification Cache

**R3**: Cache refreshed automatically via cron
- Runs every 5 minutes
- Refreshes both at-risk and neglected accounts
- No manual invalidation needed

**R4**: Cache expires after 5 minutes
- `expires_at` set to 5 minutes from refresh
- API checks `expires_at` before returning cached data
- If expired, returns stale data (cron will refresh soon)

## Rules

**R1**: React Query cache invalidated only after import (data only changes on import).

**R2**: React Query cache settings: `staleTime: 60 minutes`, `gcTime: 2 hours`, `refetchOnWindowFocus: false`.

**R3**: Notification cache refreshed automatically via cron job every 5 minutes.

**R4**: Notification cache expires after 5 minutes (TTL).

**R5**: No manual invalidation needed for notification cache (cron handles it).

**R6**: No invalidation needed for API changes (data only changes on import).

## Examples

### Example 1: After Import

**Input:**
- User imports new CSV files
- Import completes successfully

**Process:**
1. Invalidate React Query caches: `['accounts']`, `['contacts']`, `['estimates']`, `['scorecards']`
2. Force refetch of active queries
3. Notification cache will refresh automatically via cron (no manual invalidation)

**Output:**
- UI refreshes with new data
- Notification cache refreshed within 5 minutes

### Example 2: Cache Hit (Within TTL)

**Input:**
- User requests at-risk accounts
- Cache exists and `expires_at > now`

**Process:**
1. Check cache: `expires_at > now` → return cached data
2. No database query needed

**Output:**
- Fast response (cached data)
- No database load

### Example 3: Cache Miss (Expired)

**Input:**
- User requests at-risk accounts
- Cache exists but `expires_at < now`

**Process:**
1. Check cache: `expires_at < now` → return stale cached data
2. Cron job will refresh cache soon (within 5 minutes)

**Output:**
- Response with stale data (acceptable, will refresh soon)
- No blocking database query

## Acceptance Criteria

**AC1**: React Query cache invalidated only after import. (R1)

**AC2**: React Query cache settings: `staleTime: 60 minutes`, `gcTime: 2 hours`, `refetchOnWindowFocus: false`. (R2)

**AC3**: Notification cache refreshed automatically via cron every 5 minutes. (R3)

**AC4**: Notification cache expires after 5 minutes. (R4)

**AC5**: No manual invalidation needed for notification cache. (R5)

**AC6**: No invalidation needed for API changes. (R6)

## References

- **Import Process Spec**: `docs/sections/import-process.md` (R7)
- **Notification Caching Spec**: `docs/sections/notification-caching.md`
- **At-Risk Accounts Spec**: `docs/sections/at-risk-accounts.md`
- **Neglected Accounts Spec**: `docs/sections/neglected-accounts.md`
- **Cron Job**: `api/cron/refresh-notifications.js`
- **Import Component**: `src/components/ImportLeadsDialog.jsx`

## Change Control

This spec governs cache invalidation behavior. Any change requires explicit product owner approval before editing this file.

