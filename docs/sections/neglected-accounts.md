# Neglected Accounts Spec

## Purpose

The Neglected Accounts section identifies accounts that have not had any logged interactions beyond a threshold period (30 days for A/B revenue segments, 90 days for others). This enables sales teams to proactively reach out to accounts that may be losing engagement and prevent relationship deterioration.

## Data contract

### Sources
- **Accounts table** (`accounts`): `id` (text, PK), `name` (text), `archived` (boolean), `icp_status` (text), `revenue_segment` (text), `last_interaction_date` (date)
- **Notification snoozes** (`notification_snoozes`): `notification_type` (text), `related_account_id` (text), `snoozed_until` (timestamptz)
- **Notification cache** (`notification_cache`): `cache_key` (text, PK), `cache_data` (jsonb), `expires_at` (timestamptz), `updated_at` (timestamptz)

### Fields Used

#### Required
- `accounts.id` - Account identifier
- `accounts.archived` - Must be `false` for account to be considered
- `accounts.icp_status` - Must NOT be `'na'` for account to be considered

#### Optional
- `accounts.revenue_segment` - Used to determine threshold (A/B = 30 days, others = 90 days). Defaults to 'C' if missing/null/undefined
- `accounts.last_interaction_date` - Date of last interaction. If null/undefined, account is considered neglected
- `notification_snoozes.snoozed_until` - If future date, account is excluded from calculation

### Types and Units
- **Dates**: All dates normalized to start of day (00:00:00) using `normalizeToStartOfDay()` from `src/utils/timezoneConfig.js`
- **Time zone**: GMT-7 (application timezone, defined in `src/utils/timezoneConfig.js::TIMEZONE_OFFSET_HOURS = -7`)
- **Day boundary**: A day starts at 00:00:00 GMT-7 (07:00:00 UTC)
- **Database storage**: UTC (timestamptz), but day calculations use GMT-7
- **Days calculation**: Integer days using `differenceInDays()` from date-fns
- **Thresholds**: 
  - Revenue segments A or B: 30 days
  - All other segments (C, D, missing, null, undefined): 90 days

### Nullability Assumptions
- `last_interaction_date` can be null/undefined (treated as "never had interaction" = neglected)
- `revenue_segment` can be null/undefined (defaults to 'C' = 90 day threshold)
- `icp_status` must be explicitly `'na'` to exclude (null/undefined is treated as not excluded)

## Logic

### Ordered End-to-End Flow

1. **Background Cache Refresh** (every 5 minutes via cron)
   - Fetch all non-archived accounts (with pagination)
   - Fetch all notification snoozes
   - Call `calculateNeglectedAccounts(accounts, snoozes)`
   - Update `notification_cache` with `cache_key='neglected-accounts'`
   - Set `expires_at` to 5 minutes from now
   - See `docs/sections/notification-caching.md` for full caching specification

2. **Neglected Account Calculation** (`calculateNeglectedAccounts()`)
   - Create snooze lookup map (key: account_id, value: snoozed_until date)
   - Filter snoozes: only include `notification_type === 'neglected_account'` AND `snoozed_until > today`
   - For each account:
     a. Skip if `archived === true`
     b. Skip if `icp_status === 'na'` (permanently excluded)
     c. Skip if snoozed (`snoozed_until > today`)
     d. Determine threshold: `revenue_segment === 'A' || revenue_segment === 'B'` → 30 days, else 90 days
     e. If `last_interaction_date` is null/undefined → add to neglected list
     f. If `last_interaction_date` exists:
        - Normalize to start of day: `normalizeToStartOfDay(new Date(account.last_interaction_date))`
        - Calculate days: `differenceInDays(today, lastInteractionDate)`
        - If `daysSince > thresholdDays` → add to neglected list

3. **UI Display** (Dashboard, NeglectedAccounts page, Accounts page, NotificationBell)
   - Fetch from `/api/notifications?type=neglected-accounts`
   - API returns cached data from `notification_cache`
   - If cache expired/missing, return empty array with `stale: true`
   - Filter out accounts not found in accounts list (safety check)
   - Display with days since interaction, threshold, and revenue segment

### Transformations

1. **Date Normalization**: `normalizeToStartOfDay(date)` from `src/utils/timezoneConfig.js` - Sets time to 00:00:00 GMT-7 for consistent comparison
2. **Days Calculation**: `differenceInDays(today, lastInteractionDate)` - Integer days (can be negative for future dates)
3. **Segment Default**: `revenue_segment || 'C'` - Defaults to 'C' if missing/null/undefined
4. **Snooze Filter**: Only includes snoozes where `snoozed_until > today` (expired snoozes are ignored)

### Computations and Formulas

- **Threshold determination**: 
  - If `revenue_segment === 'A' || revenue_segment === 'B'` → `thresholdDays = 30`
  - Otherwise → `thresholdDays = 90`
- **Days since interaction**: `differenceInDays(normalizeToStartOfDay(today), normalizeToStartOfDay(last_interaction_date))`
- **Is neglected**: 
  - If `last_interaction_date` is null/undefined → `true`
  - If `daysSince > thresholdDays` → `true`
  - Otherwise → `false`

## Rules

Rules must be testable and numbered.

**R1**: If `account.archived === true`, then account is excluded from neglected calculation.

**R2**: If `account.icp_status === 'na'`, then account is permanently excluded from neglected calculation.

**R3**: If `account.revenue_segment === 'A' || account.revenue_segment === 'B'`, then threshold is 30 days.

**R4**: If `account.revenue_segment` is not 'A' or 'B' (including null, undefined, 'C', 'D', or any other value), then threshold is 90 days.

**R5**: If `account.revenue_segment` is null, undefined, or missing, then default to 'C' (90 day threshold).

**R6**: If `account.last_interaction_date` is null or undefined, then account is considered neglected.

**R7**: If `account.last_interaction_date` exists and `differenceInDays(today, lastInteractionDate) > thresholdDays`, then account is considered neglected.

**R8**: All dates must be normalized to start of day (00:00:00 GMT-7) before comparison using `normalizeToStartOfDay()` from `src/utils/timezoneConfig.js`.

**R9**: If `notification_snoozes.snoozed_until > today` AND `notification_type === 'neglected_account'` AND `related_account_id === account.id`, then account is excluded from neglected calculation.

**R10**: If `notification_snoozes.snoozed_until <= today`, then snooze is expired and account is NOT excluded (snooze expiration means account is considered neglected again if it meets other criteria).

**R15**: Multiple snoozes for the same account and notification type are NOT possible due to database UNIQUE constraint on `(notification_type, related_account_id)`. Snooze operations use UPSERT, so creating a new snooze replaces any existing snooze for that account+type combination.

**R11**: Cache is refreshed every 5 minutes by background cron job (`api/cron/refresh-notifications.js`).

**R12**: UI always fetches from cache via `/api/notifications?type=neglected-accounts` endpoint.

**R13**: If cache is expired or missing, API returns empty array with `stale: true` flag.

**R14**: Manual cache refresh available via `/api/admin/refresh-cache.js` (admin-only).

## Precedence and Conflict Resolution

### Exclusion Precedence (Highest to Lowest)

1. **Archived accounts** (R1) - Highest priority exclusion
2. **ICP status = 'na'** (R2) - Permanent exclusion
3. **Active snooze** (R9) - Temporary exclusion (until `snoozed_until` expires)
4. **Recent interaction** (R7) - Account not neglected if within threshold

### Conflict Examples

**Example 1**: Account with `icp_status = 'na'` and `last_interaction_date = null`
- **Resolution**: Excluded by R2 (ICP status takes precedence over missing interaction date)

**Example 2**: Account with `revenue_segment = 'A'` and `last_interaction_date = 35 days ago`
- **Resolution**: Neglected (R3: 30 day threshold, R7: 35 > 30)

**Example 3**: Account with `revenue_segment = null` and `last_interaction_date = 95 days ago`
- **Resolution**: Neglected (R5: defaults to 'C', R4: 90 day threshold, R7: 95 > 90)

**Example 4**: Account with active snooze (`snoozed_until = tomorrow`) and `last_interaction_date = null`
- **Resolution**: Excluded by R9 (active snooze takes precedence)

**Example 5**: Account with expired snooze (`snoozed_until = yesterday`) and `last_interaction_date = null`
- **Resolution**: Neglected (R10: snooze expired, R6: no interaction date)

## Examples

### Example 1: A Segment Account with No Interaction Date

**Input**:
```json
{
  "id": "acc-123",
  "name": "Acme Corp",
  "archived": false,
  "icp_status": "required",
  "revenue_segment": "A",
  "last_interaction_date": null
}
```

**Calculation**:
- R1: Not archived ✓
- R2: ICP status not 'na' ✓
- R9: No active snooze ✓
- R3: Segment A → threshold = 30 days
- R6: No interaction date → neglected

**Output**:
```json
{
  "account_id": "acc-123",
  "account_name": "Acme Corp",
  "days_since_interaction": null,
  "threshold_days": 30,
  "revenue_segment": "A"
}
```

**Rule IDs**: R1, R2, R3, R6, R9

### Example 2: C Segment Account with Old Interaction

**Input**:
```json
{
  "id": "acc-456",
  "name": "Beta Inc",
  "archived": false,
  "icp_status": "required",
  "revenue_segment": "C",
  "last_interaction_date": "2024-01-01"
}
```

**Calculation** (assuming today is 2024-04-15):
- R1: Not archived ✓
- R2: ICP status not 'na' ✓
- R9: No active snooze ✓
- R4: Segment C → threshold = 90 days
- R8: Normalize dates to start of day
- R7: `differenceInDays(2024-04-15, 2024-01-01) = 105` → 105 > 90 → neglected

**Output**:
```json
{
  "account_id": "acc-456",
  "account_name": "Beta Inc",
  "days_since_interaction": 105,
  "threshold_days": 90,
  "revenue_segment": "C"
}
```

**Rule IDs**: R1, R2, R4, R7, R8, R9

### Example 3: B Segment Account with Recent Interaction

**Input**:
```json
{
  "id": "acc-789",
  "name": "Gamma LLC",
  "archived": false,
  "icp_status": "required",
  "revenue_segment": "B",
  "last_interaction_date": "2024-04-10"
}
```

**Calculation** (assuming today is 2024-04-15):
- R1: Not archived ✓
- R2: ICP status not 'na' ✓
- R9: No active snooze ✓
- R3: Segment B → threshold = 30 days
- R8: Normalize dates to start of day
- R7: `differenceInDays(2024-04-15, 2024-04-10) = 5` → 5 <= 30 → NOT neglected

**Output**: Account not in neglected list

**Rule IDs**: R1, R2, R3, R7, R8, R9

### Example 4: Account with Missing Segment (Defaults to C)

**Input**:
```json
{
  "id": "acc-999",
  "name": "Delta Co",
  "archived": false,
  "icp_status": "required",
  "revenue_segment": null,
  "last_interaction_date": "2024-01-20"
}
```

**Calculation** (assuming today is 2024-04-15):
- R1: Not archived ✓
- R2: ICP status not 'na' ✓
- R9: No active snooze ✓
- R5: Segment null → defaults to 'C'
- R4: Segment C → threshold = 90 days
- R8: Normalize dates to start of day
- R7: `differenceInDays(2024-04-15, 2024-01-20) = 86` → 86 <= 90 → NOT neglected

**Output**: Account not in neglected list

**Rule IDs**: R1, R2, R4, R5, R7, R8, R9

### Example 5: Account with ICP Status = 'na' (Permanently Excluded)

**Input**:
```json
{
  "id": "acc-111",
  "name": "Epsilon Ltd",
  "archived": false,
  "icp_status": "na",
  "revenue_segment": "A",
  "last_interaction_date": null
}
```

**Calculation**:
- R1: Not archived ✓
- R2: ICP status = 'na' → EXCLUDED

**Output**: Account not in neglected list

**Rule IDs**: R1, R2

### Example 6: Account with Active Snooze

**Input**:
```json
{
  "id": "acc-222",
  "name": "Zeta Corp",
  "archived": false,
  "icp_status": "required",
  "revenue_segment": "A",
  "last_interaction_date": null
}
```

**Snooze**:
```json
{
  "notification_type": "neglected_account",
  "related_account_id": "acc-222",
  "snoozed_until": "2024-04-20T00:00:00Z"
}
```

**Calculation** (assuming today is 2024-04-15):
- R1: Not archived ✓
- R2: ICP status not 'na' ✓
- R9: Active snooze (`snoozed_until = 2024-04-20 > 2024-04-15`) → EXCLUDED

**Output**: Account not in neglected list

**Rule IDs**: R1, R2, R9

### Example 7: Account with Expired Snooze (Becomes Neglected Again)

**Input**:
```json
{
  "id": "acc-333",
  "name": "Eta Inc",
  "archived": false,
  "icp_status": "required",
  "revenue_segment": "A",
  "last_interaction_date": null
}
```

**Snooze**:
```json
{
  "notification_type": "neglected_account",
  "related_account_id": "acc-333",
  "snoozed_until": "2024-04-10T00:00:00Z"
}
```

**Calculation** (assuming today is 2024-04-15):
- R1: Not archived ✓
- R2: ICP status not 'na' ✓
- R10: Snooze expired (`snoozed_until = 2024-04-10 <= 2024-04-15`) → NOT excluded
- R3: Segment A → threshold = 30 days
- R6: No interaction date → neglected

**Output**:
```json
{
  "account_id": "acc-333",
  "account_name": "Eta Inc",
  "days_since_interaction": null,
  "threshold_days": 30,
  "revenue_segment": "A"
}
```

**Rule IDs**: R1, R2, R3, R6, R10

### Example 8: Archived Account (Always Excluded)

**Input**:
```json
{
  "id": "acc-444",
  "name": "Theta LLC",
  "archived": true,
  "icp_status": "required",
  "revenue_segment": "A",
  "last_interaction_date": null
}
```

**Calculation**:
- R1: Archived = true → EXCLUDED

**Output**: Account not in neglected list

**Rule IDs**: R1

## Acceptance Criteria

**AC1**: Archived accounts are excluded from neglected calculation. (R1)

**AC2**: Accounts with `icp_status === 'na'` are permanently excluded. (R2)

**AC3**: A/B revenue segment accounts use 30-day threshold. (R3)

**AC4**: C/D/other revenue segment accounts use 90-day threshold. (R4)

**AC5**: Missing/null/undefined revenue segment defaults to 'C' (90 days). (R5)

**AC6**: Accounts with no `last_interaction_date` are considered neglected. (R6)

**AC7**: Accounts with `daysSince > thresholdDays` are considered neglected. (R7)

**AC8**: All date comparisons use start-of-day normalization in GMT-7 timezone. (R8)

**AC15**: Multiple snoozes for same account+type are prevented by database constraint. (R15)

**AC9**: Accounts with active snoozes (`snoozed_until > today`) are excluded. (R9)

**AC10**: Accounts with expired snoozes (`snoozed_until <= today`) are NOT excluded and are considered neglected if they meet other criteria. (R10)

**AC11**: Cache is refreshed every 5 minutes by background job. (R11)

**AC12**: UI fetches from cache endpoint, not real-time calculation. (R12)

**AC13**: Expired/missing cache returns empty array with `stale: true`. (R13)

**AC14**: Manual cache refresh requires admin authentication. (R14)

## Special Considerations

### Edge Cases

- **Future interaction dates**: If `last_interaction_date` is in the future, `differenceInDays()` returns negative value, so account is NOT neglected (R7: negative <= threshold)
- **Exact threshold match**: If `daysSince === thresholdDays`, account is NOT neglected (R7: uses `>` not `>=`)
- **Multiple snoozes**: If multiple snoozes exist for same account, any active snooze excludes the account (R9)
- **Snooze expiration boundary**: At exact moment `snoozed_until === today`, snooze is expired (R10: uses `<=`)

### Exceptions

- **ICP status = 'na'**: Permanent exclusion regardless of interaction status
- **Archived accounts**: Always excluded regardless of other criteria
- **Cache staleness**: UI shows empty state if cache expired, does NOT fall back to real-time calculation

### Backward Compatibility

- Revenue segment values other than A/B/C/D are treated as 'C' (90 days)
- Missing `revenue_segment` field defaults to 'C' (90 days)
- Accounts without `icp_status` field are NOT excluded (only `'na'` excludes)

### Locale or Accessibility Considerations

- Date formatting uses `date-fns` for consistent timezone handling
- Days calculation uses integer days (not fractional)
- Cache refresh happens in background, doesn't block UI
- All day boundaries determined by GMT-7 timezone (configurable via `src/utils/timezoneConfig.js`)

## Telemetry and Observability

### Key Events to Log

- Cache refresh start/completion (background job)
- Cache expiration (API retrieval)
- Manual refresh requests (admin action)
- Calculation errors
- Snooze expiration (when account becomes neglected again)

### Metrics to Monitor

- Number of neglected accounts by revenue segment
- Average days since interaction for neglected accounts
- Cache hit rate (valid cache vs expired/missing)
- Snooze expiration rate (accounts becoming neglected after snooze expires)
- Accounts excluded by ICP status = 'na'

## Open Questions for the Product Owner

1. **Revenue segment values**: Should we explicitly handle segment values other than A/B/C/D, or continue defaulting to 'C'?
2. **Exact threshold boundary**: Should `daysSince === thresholdDays` be considered neglected (currently uses `>` not `>=`)?
3. **Future interaction dates**: Should accounts with future-dated interactions be flagged as data quality issues?

## Change Control

This spec governs behavior for the Neglected Accounts section.

Any change requires explicit product owner approval before editing this file.

## References

- Notification Caching Spec: `docs/sections/notification-caching.md`
- At-Risk Accounts Spec: `docs/sections/at-risk-accounts.md` (for comparison)
- Calculation Function: `src/utils/atRiskCalculator.js::calculateNeglectedAccounts()`
- Timezone Configuration: `src/utils/timezoneConfig.js` (GMT-7 timezone, configurable)
- Background Job: `api/cron/refresh-notifications.js`
- Manual Refresh: `api/admin/refresh-cache.js`
- Cache Retrieval: `api/notifications.js`

