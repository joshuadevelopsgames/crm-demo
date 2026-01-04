# At-Risk Accounts Spec

## Purpose

The At-Risk Accounts section identifies accounts with won estimates expiring within 180 days (6 months) to proactively flag accounts requiring renewal attention. This enables sales teams to prioritize renewal efforts and prevent contract churn.

## Data contract

### Sources
- **Accounts table** (`accounts`): `id` (text, PK), `name` (text), `archived` (boolean), `status` (text)
- **Estimates table** (`estimates`): `id` (text, PK), `account_id` (text, FK), `status` (text), `contract_end` (date), `division` (text), `address` (text), `estimate_number` (text), `lmn_estimate_id` (text), `archived` (boolean)
- **Notification snoozes** (`notification_snoozes`): `notification_type` (text), `related_account_id` (text), `snoozed_until` (timestamptz)
- **Notification cache** (`notification_cache`): `cache_key` (text, PK), `cache_data` (jsonb), `expires_at` (timestamptz), `updated_at` (timestamptz)
- **Duplicate tracking** (`duplicate_at_risk_estimates`): `id` (uuid, PK), `account_id` (text, FK), `estimate_ids` (text[]), `detected_at` (timestamptz), `resolved_at` (timestamptz)

### Fields Used

#### Required
- `accounts.id` - Account identifier
- `accounts.archived` - Must be `false` for account to be considered
- `estimates.status` - Must be `'won'` (case-insensitive check via `isWonStatus()`)
- `estimates.contract_end` - Must be non-null date
- `estimates.account_id` - Must be non-null to link to account

#### Optional
- `estimates.division` - Used for renewal detection matching
- `estimates.address` - Used for renewal detection matching
- `estimates.estimate_number` - Displayed in UI, falls back to `lmn_estimate_id`
- `notification_snoozes.snoozed_until` - If future date, account is excluded

### Types and Units
- **Dates**: All dates normalized to start of day (00:00:00) using `startOfDay()` from date-fns
- **Time zone**: UTC (database stores timestamptz)
- **Days calculation**: Integer days using `differenceInDays()` from date-fns (can be negative for past due)
- **Threshold**: 180 days (constant `DAYS_THRESHOLD = 180`)

### Nullability Assumptions
- `contract_end` must be non-null for estimate to be considered
- `account_id` must be non-null for estimate to be considered
- `division` and `address` can be null (renewal detection may not work correctly if null)
- Missing `estimate_number` falls back to `lmn_estimate_id`

## Logic

### Ordered End-to-End Flow

1. **Background Cache Refresh** (every 5 minutes via cron)
   - Fetch all non-archived accounts
   - Fetch all non-archived estimates
   - Fetch all notification snoozes
   - Call `calculateAtRiskAccounts(accounts, estimates, snoozes)`
   - Update `notification_cache` with `cache_key='at-risk-accounts'`
   - Set `expires_at` to 5 minutes from now

2. **At-Risk Calculation** (`calculateAtRiskAccounts()`)
   - Group estimates by `account_id`
   - Create snooze lookup map (key: account_id, value: snoozed_until date)
   - For each account:
     a. Skip if `archived = true`
     b. Skip if snoozed (`snoozed_until > today`)
     c. Get all estimates for account
     d. Filter to won estimates with non-null `contract_end`
     e. Calculate `daysUntil = differenceInDays(contract_end, today)`
     f. Filter to estimates where `daysUntil <= 180` AND `daysUntil >= 0` (excludes past due)
     g. For each at-risk estimate, check for renewal (newer estimate, same dept+address, >180 days)
     h. Remove estimates that have renewals
     i. If no valid at-risk estimates remain, skip account
     j. Select soonest expiring estimate (minimum `contract_end` date)
     k. Detect duplicates (multiple estimates with same normalized dept+address)
     l. Add account to result array with renewal info

3. **Duplicate Detection**
   - For each account with at-risk estimates, group by normalized `(division, address)`
   - If multiple estimates share same normalized key, flag as duplicate
   - Store in `duplicate_at_risk_estimates` table if new
   - Create notifications for new duplicates

4. **UI Display** (Dashboard, Accounts page, Notification Bell)
   - Fetch from `/api/notifications?type=at-risk-accounts`
   - API returns cached data from `notification_cache`
   - If cache expired/missing, return empty array with `stale: true`
   - Map cached records to account objects
   - Filter out accounts not found in accounts list
   - Sort by `days_until_renewal` ascending (soonest first)
   - Display with duplicate indicators

### Transformations

1. **Date Normalization**: `startOfDay(date)` - Sets time to 00:00:00
2. **Department Normalization**: `division.trim().toLowerCase()` - Case-insensitive, trimmed
3. **Address Normalization**: `address.trim().toLowerCase().replace(/\s+/g, ' ')` - Case-insensitive, trimmed, normalized whitespace
4. **Days Calculation**: `differenceInDays(renewalDate, today)` - Integer days (negative = past due)
5. **Estimate Number Fallback**: `estimate_number || lmn_estimate_id` - Use estimate_number if available, else lmn_estimate_id

### Computations and Formulas

- **Days until renewal**: `differenceInDays(contract_end, startOfDay(today))`
- **Is at-risk**: `daysUntil <= 180` AND `daysUntil >= 0` (excludes past due renewals)
- **Has renewal**: Exists newer won estimate with:
  - Same normalized department
  - Same normalized address
  - Later `contract_end` date
  - `differenceInDays(newer_contract_end, today) > 180`

### Sorting and Grouping Rules

- **Primary sort**: `days_until_renewal` ascending (soonest first, 0-180 days only)
- **Grouping**: By account (one entry per account, using soonest expiring estimate)
- **Duplicate grouping**: By normalized `(division, address)` within account

## Rules

### Validation Rules

- **R1**: If `account.archived = true`, then account is excluded from at-risk calculation.
- **R2**: If `estimate.status` is not 'won' (case-insensitive), then estimate is excluded.
- **R3**: If `estimate.contract_end` is `null` or invalid date, then estimate is excluded.
- **R4**: If `estimate.account_id` is `null`, then estimate is excluded.
- **R5**: If `daysUntil = differenceInDays(contract_end, today) > 180`, then estimate is not at-risk.
- **R6**: If `daysUntil <= 180` AND `daysUntil >= 0`, then estimate is at-risk.
- **R6a**: If `daysUntil < 0` (past due renewal), then estimate is excluded from at-risk calculation.
- **R7**: If account has `notification_type='renewal_reminder'` snooze with `snoozed_until > today`, then account is excluded.

### Renewal Detection Rules

- **R8**: If a newer won estimate exists with same normalized `(division, address)` and `daysUntil > 180`, then the older at-risk estimate is excluded (account already renewed).
- **R9**: Renewal detection requires both `division` and `address` to be non-null and match (after normalization). If either is null, renewal detection is skipped (estimate treated as uncategorized).
- **R10**: Renewal estimate must have later `contract_end` date than at-risk estimate.

### Selection Rules

- **R11**: If account has multiple at-risk estimates, use the one with earliest `contract_end` date (soonest expiring).
- **R12**: If multiple estimates have same `contract_end` date, use first found (no secondary sort needed).

### Duplicate Detection Rules

- **R13**: If account has multiple at-risk estimates with same normalized `(division, address)`, flag as duplicate.
- **R14**: Duplicate flagging does not exclude account from being at-risk, only marks it for review.
- **R15**: Duplicates are stored in `duplicate_at_risk_estimates` table only if not already present (unresolved).

### Display Rules

- **R16**: At-risk accounts are sorted by `days_until_renewal` ascending (soonest first).
- **R17**: Accounts with duplicates show visual indicator (yellow border in Dashboard).
- **R18**: If account not found in accounts list, exclude from display (but may remain in cache).
- **R19**: Cache expires after 5 minutes; stale cache returns empty array with `stale: true`.

### Defaults and Fallbacks

- **R20**: If `estimate_number` is missing, use `lmn_estimate_id` as fallback.
- **R21**: If `division` or `address` is null, renewal detection is skipped (estimate treated as uncategorized, but still considered at-risk if threshold met).
- **R22**: If cache is missing/expired, return empty array (UI shows no at-risk accounts until cache refreshes).

### Error Handling

- **R23**: If `contract_end` date parsing fails, skip estimate with console.error (no exception thrown).
- **R24**: If cache query fails (table missing), return empty array with `stale: true` and message.
- **R25**: If account lookup fails during display mapping, skip account (filter out null entries).

### Permission and Visibility Rules

- **R26**: All authenticated users can view at-risk accounts (no per-account filtering).
- **R27**: At-risk accounts appear in Dashboard, Accounts page (with filter), and Notification Bell.

### Performance and Caching Assumptions

- **R28**: Cache is refreshed every 5 minutes by background cron job (`/api/cron/refresh-notifications`).
- **R29**: Cache expiry is 5 minutes from update time.
- **R30**: UI may show stale data for up to 5 minutes (acceptable trade-off for performance).
- **R31**: `account.status` field is not synced with calculated at-risk status. UI uses `notification_cache` as source of truth.
- **R32**: `notification_cache` is primary source for UI; `at_risk_accounts` table provides audit trail and trigger support.

## Precedence and Conflict Resolution

### Precedence Order (Highest Wins)

1. **Archived exclusion** (R1) - Highest priority, always excludes account
2. **Snooze exclusion** (R7) - Excludes even if account is at-risk
3. **Renewal detection** (R8) - Excludes estimate if renewal exists
4. **Past due exclusion** (R6a) - Excludes estimates with negative days_until_renewal
5. **Threshold check** (R5, R6) - Must be <= 180 days AND >= 0 days
6. **Soonest estimate selection** (R11) - If multiple, use earliest contract_end
7. **Duplicate flagging** (R13) - Does not exclude, only flags

### Tie Breakers

- **Same contract_end date**: Use first found (R12)
- **Missing division/address**: Renewal detection skipped, estimate treated as uncategorized but still considered at-risk if threshold met (R21)

### Conflict Examples

1. **Account archived but has at-risk estimate**: R1 wins → Account excluded
2. **Account snoozed but estimate expires tomorrow**: R7 wins → Account excluded
3. **Estimate expires in 90 days but newer estimate exists (same dept+address, expires in 200 days)**: R8 wins → Estimate excluded (account not at-risk)
4. **Multiple estimates expire same day**: R11 applies, uses first found (R12)
5. **Estimate expires in 181 days**: R5 wins → Not at-risk (threshold is <= 180, not < 180)
6. **Estimate expired 45 days ago**: R6a wins → Excluded (past due renewals not included)

## Examples

### Example 1: Basic At-Risk Account

**Input**:
- Account: `{ id: 'acc-1', name: 'Acme Corp', archived: false }`
- Estimate: `{ id: 'est-1', account_id: 'acc-1', status: 'won', contract_end: '2025-07-15' }`
- Today: `2025-01-15` (180 days until renewal)

**Output**:
- At-risk account: `{ account_id: 'acc-1', account_name: 'Acme Corp', renewal_date: '2025-07-15', days_until_renewal: 180, expiring_estimate_id: 'est-1' }`

**Rules**: R6 (within threshold), R1 (not archived), R11 (single estimate)

---

### Example 2: Past Due Renewal Excluded

**Input**:
- Account: `{ id: 'acc-2', name: 'Beta Inc', archived: false }`
- Estimate: `{ id: 'est-2', account_id: 'acc-2', status: 'won', contract_end: '2024-12-01' }`
- Today: `2025-01-15` (45 days past due)

**Output**:
- Account NOT at-risk (excluded by past due rule)

**Rules**: R6a (past due excluded), R1 (not archived)

---

### Example 3: Renewal Detection Excludes Account

**Input**:
- Account: `{ id: 'acc-3', name: 'Gamma LLC', archived: false }`
- Estimate 1: `{ id: 'est-3a', account_id: 'acc-3', status: 'won', contract_end: '2025-06-01', division: 'Landscaping', address: '123 Main St' }` (138 days)
- Estimate 2: `{ id: 'est-3b', account_id: 'acc-3', status: 'won', contract_end: '2026-06-01', division: 'Landscaping', address: '123 Main St' }` (503 days)

**Output**:
- Account NOT at-risk (excluded by renewal detection)

**Rules**: R8 (newer estimate with same dept+address, >180 days away), R9 (both division and address match)

---

### Example 4: Multiple At-Risk Estimates, Soonest Selected

**Input**:
- Account: `{ id: 'acc-4', name: 'Delta Co', archived: false }`
- Estimate 1: `{ id: 'est-4a', account_id: 'acc-4', status: 'won', contract_end: '2025-08-01', division: 'Snow', address: '456 Oak Ave' }` (199 days)
- Estimate 2: `{ id: 'est-4b', account_id: 'acc-4', status: 'won', contract_end: '2025-05-01', division: 'Tree Care', address: '789 Pine Rd' }` (106 days)

**Output**:
- At-risk account: `{ account_id: 'acc-4', account_name: 'Delta Co', renewal_date: '2025-05-01', days_until_renewal: 106, expiring_estimate_id: 'est-4b', division: 'Tree Care', address: '789 Pine Rd' }`

**Rules**: R11 (soonest expiring selected), R6 (both within threshold, but est-4a > 180, so only est-4b is at-risk)

---

### Example 5: Duplicate Detection

**Input**:
- Account: `{ id: 'acc-5', name: 'Epsilon Ltd', archived: false }`
- Estimate 1: `{ id: 'est-5a', account_id: 'acc-5', status: 'won', contract_end: '2025-07-01', division: 'Maintenance', address: '100 Elm St' }` (168 days)
- Estimate 2: `{ id: 'est-5b', account_id: 'acc-5', status: 'won', contract_end: '2025-07-15', division: 'Maintenance', address: '100 Elm St' }` (182 days - not at-risk)
- Estimate 3: `{ id: 'est-5c', account_id: 'acc-5', status: 'won', contract_end: '2025-08-01', division: 'Maintenance', address: '100 Elm St' }` (199 days - not at-risk)

**Output**:
- At-risk account: `{ account_id: 'acc-5', account_name: 'Epsilon Ltd', renewal_date: '2025-07-01', days_until_renewal: 168, expiring_estimate_id: 'est-5a', has_duplicates: false }`
- Note: Only est-5a is at-risk (others > 180 days), so no duplicates detected

**Rules**: R13 (duplicates only if multiple at-risk estimates share dept+address), R5 (est-5b and est-5c > 180 days, excluded)

---

### Example 6: Snoozed Account Excluded

**Input**:
- Account: `{ id: 'acc-6', name: 'Zeta Corp', archived: false }`
- Estimate: `{ id: 'est-6', account_id: 'acc-6', status: 'won', contract_end: '2025-07-01' }` (168 days)
- Snooze: `{ notification_type: 'renewal_reminder', related_account_id: 'acc-6', snoozed_until: '2025-02-01' }`
- Today: `2025-01-15`

**Output**:
- Account NOT at-risk (excluded by snooze)

**Rules**: R7 (snoozed_until > today, account excluded)

---

### Example 7: Exactly 180 Days

**Input**:
- Account: `{ id: 'acc-7', name: 'Eta Inc', archived: false }`
- Estimate: `{ id: 'est-7', account_id: 'acc-7', status: 'won', contract_end: '2025-07-15' }`
- Today: `2025-01-16` (exactly 180 days)

**Output**:
- At-risk account: `{ account_id: 'acc-7', account_name: 'Eta Inc', renewal_date: '2025-07-15', days_until_renewal: 180, expiring_estimate_id: 'est-7' }`

**Rules**: R6 (<= 180 includes exactly 180)

---

### Example 8: Cache Stale/Missing

**Input**:
- Cache query returns: `{ error: 'PGRST116' }` or `{ expires_at: '2025-01-10T00:00:00Z' }` (expired)
- Today: `2025-01-15T12:00:00Z`

**Output**:
- API response: `{ success: true, data: [], stale: true, message: 'Cache expired or missing. Background job will refresh shortly.' }`

**Rules**: R22 (missing/expired cache returns empty array), R28 (background job refreshes every 5 minutes)

## Acceptance Criteria

- **AC1**: Accounts with won estimates expiring within 180 days (0-180 days, excluding past due) are identified as at-risk. (R6, R6a, R5)
- **AC2**: Archived accounts are excluded from at-risk calculation. (R1)
- **AC3**: Snoozed accounts (renewal_reminder with future snoozed_until) are excluded. (R7)
- **AC4**: Accounts with renewal estimates (newer, same dept+address, >180 days) are excluded. (R8, R9, R10)
- **AC5**: If multiple at-risk estimates exist, the soonest expiring is selected. (R11)
- **AC6**: Duplicate estimates (same normalized dept+address) are flagged but do not exclude account. (R13, R14)
- **AC7**: At-risk accounts are sorted by days_until_renewal ascending in UI. (R16)
- **AC8**: Cache is refreshed every 5 minutes by background job. (R28)
- **AC9**: Stale/missing cache returns empty array with stale flag. (R22, R19)
- **AC10**: Invalid contract_end dates are skipped with error logging. (R23)

## Special Considerations

### Edge Cases

1. **Past due renewals**: Excluded (negative days_until_renewal) - only future renewals (0-180 days) are tracked
2. **Exactly 180 days**: Included (threshold is <= 180, not < 180)
3. **Missing division/address**: Treated as uncategorized - renewal detection skipped, but estimate still considered at-risk if threshold met
4. **Multiple estimates same date**: Uses first found (R12) - should be rare in practice
5. **Cache staleness**: UI may show stale data for up to 5 minutes (acceptable for performance)

### Exceptions

- **Database table vs cache**: Both systems are maintained. `notification_cache` is primary source for UI (faster, includes full account objects). `at_risk_accounts` table provides audit trail and trigger support. Both can coexist. (R32)
- **Account status field**: `account.status` is a general field (active, archived, at_risk, etc.) and is not synced with calculated at-risk status. UI uses `notification_cache` as source of truth. No syncing required. (R31)

### Backward Compatibility Notes

- `account.status = 'at_risk'` field exists but is not synced with calculated status (R31)
- `at_risk_accounts` table exists with triggers and is maintained alongside cache (R32)
- Both systems coexist: cache for UI performance, table for audit trail and triggers

### Locale Considerations

- Dates are stored and compared in UTC
- Display formatting uses user's locale (via date-fns)
- No timezone conversion for calculations (all dates normalized to start of day)

### Accessibility Considerations

- Duplicate indicators use visual border (yellow) - should also have aria-label
- Days until renewal should be announced by screen readers
- Past due renewals are excluded (R6a), so no visual indication needed

## Telemetry and Observability

### Key Events to Log

1. **Cache refresh**: Log count of at-risk accounts calculated, duplicates detected, cache update time
2. **Calculation errors**: Log estimate ID and error message when contract_end parsing fails (R23)
3. **Cache misses**: Log when cache is missing/expired and empty array returned
4. **Duplicate detection**: Log when new duplicates are detected and inserted into table
5. **Snooze exclusions**: Log count of accounts excluded due to snoozes (for monitoring)

### Metrics That Indicate Drift or Failure

1. **Cache staleness rate**: Percentage of requests where cache is stale/missing (should be < 1%)
2. **Calculation time**: Time to calculate at-risk accounts (should be < 1 second for typical dataset)
3. **Duplicate detection rate**: Number of accounts with duplicates (indicates data quality issues)
4. **Snooze exclusion rate**: Percentage of at-risk accounts excluded by snoozes (for business insights)
5. **Cache refresh failures**: Count of failed cache refresh jobs (should be 0)

## Resolved Decisions

All open questions have been resolved by the product owner. Decisions documented below:

1. **Past due renewals**: Accounts with renewals that have passed (negative days_until_renewal) are **excluded**. Only future renewals (0-180 days) are included. (R6a)

2. **Exactly 180 days**: Included (threshold is `<= 180`, not `< 180`). (R6)

3. **Account status field**: Keep as-is. `account.status` remains a general field; UI uses `notification_cache` as source of truth. No syncing required. (R31)

4. **Database table vs cache**: Both maintained. `notification_cache` is primary source for UI; `at_risk_accounts` table provides audit trail and trigger support. (R32)

5. **Duplicate handling**: Flag only (do not exclude accounts). (R13, R14)

6. **Missing division/address**: Treat as uncategorized. Skip renewal detection for estimates with null division/address, but estimate still considered at-risk if threshold met. (R21)

7. **Cache refresh frequency**: 5 minutes is acceptable. (R28)

8. **Multiple estimates same date**: Use first found (no secondary sort needed). (R12)

## Change Control

This spec governs behavior for the At-Risk Accounts section.

**Any change to this spec requires explicit product owner approval before editing this file.**

Code changes that modify behavior must:
1. Reference this spec file
2. Cite specific rule IDs (R#, AC#)
3. Get spec approval if behavior changes
4. Update this spec if approved

Spec changes are tracked in Git and are reviewable and auditable.

