# At-Risk Accounts Table Migration

## Overview

This migration creates a dedicated `at_risk_accounts` table that tracks which accounts are currently at-risk and should show renewal notifications. The table is automatically managed by database triggers and functions.

## Key Features

1. **Dedicated Table**: `at_risk_accounts` table stores accounts that are currently at-risk
2. **Automatic Management**: Database triggers automatically add/remove accounts based on:
   - Estimate renewal dates (within 6 months)
   - Snooze status (removed when snoozed, re-added when snooze expires)
3. **Notification Integration**: Notifications pull from this table instead of calculating dynamically
4. **Performance**: Dashboard and notifications can query a simple table instead of calculating from estimates

## Migration Steps

Run these SQL files in order in your Supabase SQL Editor:

1. **Create the table:**
   ```sql
   -- Run: create_at_risk_accounts_table.sql
   ```

2. **Create management functions:**
   ```sql
   -- Run: manage_at_risk_accounts_functions.sql
   ```

3. **Create triggers:**
   ```sql
   -- Run: at_risk_accounts_triggers.sql
   ```

4. **Update notification system:**
   ```sql
   -- Run: update_notifications_from_at_risk_table.sql
   ```

5. **Initial sync (populate the table):**
   ```sql
   SELECT * FROM sync_all_at_risk_accounts();
   ```

## How It Works

### When Account Becomes At-Risk

1. Trigger fires when estimate is created/updated with `contract_end` within 6 months
2. `sync_account_at_risk_status()` function checks:
   - If account has won estimates with `contract_end` within 180 days
   - If account is snoozed (if yes, don't add to table)
3. If at-risk and not snoozed, account is added to `at_risk_accounts` table
4. Notification trigger automatically creates renewal notifications

### When Account is Snoozed

1. Snooze is added to `notification_snoozes` table
2. Trigger fires on `notification_snoozes` table
3. `sync_account_at_risk_status()` is called
4. Account is removed from `at_risk_accounts` table (even if still at-risk)
5. Notifications are automatically removed

### When Snooze Expires

1. `check_expired_snoozes_and_restore_at_risk()` function can be called periodically
2. For each expired snooze, `sync_account_at_risk_status()` is called
3. If account is still at-risk, it's re-added to `at_risk_accounts` table
4. Notifications are automatically recreated

### When Account No Longer At-Risk

1. Trigger fires when estimate is updated/deleted
2. `sync_account_at_risk_status()` checks if account still has expiring estimates
3. If no longer at-risk, account is removed from `at_risk_accounts` table
4. Notifications are automatically removed

## API Endpoints

### Get At-Risk Accounts
```
GET /api/data/atRiskAccounts
```

### Sync All Accounts
```
POST /api/data/atRiskAccounts
Body: { action: 'sync_all' }
```

### Sync Single Account
```
POST /api/data/atRiskAccounts
Body: { action: 'sync_account', account_id: 'account-id' }
```

### Check Expired Snoozes
```
POST /api/data/atRiskAccounts
Body: { action: 'check_expired_snoozes' }
```

## Code Changes

### Dashboard (`src/pages/Dashboard.jsx`)
- Now fetches from `/api/data/atRiskAccounts` instead of calculating from estimates
- Removed complex calculation logic
- Uses `at_risk_accounts` table data directly

### Notification Service (`src/services/notificationService.js`)
- `createRenewalNotifications()` now calls `sync_all_at_risk_accounts()` function
- No longer updates `account.status` field
- Table is managed entirely by database triggers

### Notification System (`update_notifications_from_at_risk_table.sql`)
- `update_notification_state_for_account()` now checks `at_risk_accounts` table
- No longer checks `account.status = 'at_risk'`
- Notifications are created for accounts in the table

## Benefits

1. **Performance**: Simple table query instead of complex calculations
2. **Consistency**: Single source of truth for at-risk accounts
3. **Snooze Handling**: Automatic removal/re-addition based on snooze status
4. **Real-time**: Triggers ensure table is always up-to-date
5. **Maintainability**: Logic centralized in database functions

## Verification

After migration, verify:

```sql
-- Check at-risk accounts in table
SELECT COUNT(*) FROM at_risk_accounts;

-- Check accounts with expiring estimates
SELECT COUNT(*) FROM at_risk_accounts WHERE days_until_renewal <= 180;

-- Check snoozed accounts (should NOT be in table)
SELECT 
  COUNT(*) as snoozed_count,
  COUNT(CASE WHEN a.account_id IS NOT NULL THEN 1 END) as incorrectly_in_table
FROM notification_snoozes s
LEFT JOIN at_risk_accounts a ON a.account_id = s.related_account_id
WHERE s.notification_type = 'renewal_reminder'
  AND s.snoozed_until > now();
-- incorrectly_in_table should be 0
```

## Troubleshooting

### Issue: Accounts not appearing in table
1. Check if estimates have `contract_end` dates
2. Verify estimates have `status = 'won'`
3. Run `sync_all_at_risk_accounts()` manually
4. Check trigger logs in Supabase

### Issue: Snoozed accounts still in table
1. Verify `notification_snoozes` table has the snooze record
2. Check trigger `trg_snoozes_sync_at_risk` exists
3. Manually call `sync_account_at_risk_status('account-id')`

### Issue: Notifications not appearing
1. Verify account is in `at_risk_accounts` table
2. Check `user_notification_states` table has notifications
3. Verify notification trigger `trg_at_risk_accounts_update_notifications` exists

