# Testing Renewal Notifications

## Quick Test Methods

### Method 1: Browser Console (Easiest)

1. **Open your app** in the browser (e.g., `lecrm-dev.vercel.app`)
2. **Open browser console** (F12 or Cmd+Option+I)
3. **Run this code:**

```javascript
// Test what renewals would be found
import { testRenewalNotifications } from '@/utils/testRenewalNotifications';
testRenewalNotifications();

// Or manually trigger notifications
import { manuallyTriggerRenewalNotifications } from '@/utils/testRenewalNotifications';
manuallyTriggerRenewalNotifications();
```

### Method 2: Create Test Data

To test with real data, update an estimate to have a renewal soon:

1. **Find an account** with won estimates
2. **Update an estimate's `contract_end`** to be 30-180 days in the future
3. **Make sure the estimate status is "won"**
4. **Go to Dashboard** - notifications should be created automatically
5. **Check the notification bell** - you should see a renewal reminder

### Method 3: Use Test Script (Node.js)

If you have Node.js set up with environment variables:

```bash
node test_renewal_notifications.js
```

This will show:
- Accounts with renewals coming up
- Days until renewal
- Existing notifications
- Active snoozes

## What to Look For

✅ **Working correctly if:**
- Notifications appear 6 months (180 days) before renewal
- Notifications show account name and days until renewal
- Snooze button appears on renewal notifications
- Snoozing hides the notification for all users

❌ **Not working if:**
- No notifications appear
- Notifications appear at wrong times
- Snooze doesn't work

## Troubleshooting

### No Notifications Appearing?

1. **Check if accounts have won estimates:**
   ```sql
   SELECT a.name, COUNT(e.id) as won_estimates
   FROM accounts a
   LEFT JOIN estimates e ON e.account_id = a.id AND e.status = 'won'
   WHERE a.archived = false
   GROUP BY a.id, a.name
   HAVING COUNT(e.id) > 0;
   ```

2. **Check if estimates have contract_end dates:**
   ```sql
   SELECT account_id, contract_end, status
   FROM estimates
   WHERE status = 'won' AND contract_end IS NOT NULL
   ORDER BY contract_end DESC
   LIMIT 10;
   ```

3. **Check if renewals are within 6 months:**
   ```sql
   SELECT 
     a.name,
     MAX(e.contract_end) as latest_renewal,
     (MAX(e.contract_end)::date - CURRENT_DATE) as days_until
   FROM accounts a
   JOIN estimates e ON e.account_id = a.id
   WHERE e.status = 'won' 
     AND e.contract_end IS NOT NULL
     AND (e.contract_end::date - CURRENT_DATE) BETWEEN 0 AND 180
   GROUP BY a.id, a.name
   ORDER BY days_until;
   ```

### Notifications Created But Not Showing?

1. **Check if notifications exist:**
   ```sql
   SELECT * FROM notifications 
   WHERE type = 'renewal_reminder' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

2. **Check if notifications are snoozed:**
   ```sql
   SELECT * FROM notification_snoozes 
   WHERE notification_type = 'renewal_reminder'
     AND snoozed_until > NOW();
   ```

3. **Check browser console** for errors in `NotificationBell` component

## Quick Test Scenario

1. **Pick an account** (e.g., "Test Account")
2. **Update an estimate:**
   ```sql
   UPDATE estimates
   SET contract_end = (CURRENT_DATE + INTERVAL '90 days')::text,
       status = 'won'
   WHERE account_id = 'your-account-id'
   LIMIT 1;
   ```
3. **Go to Dashboard** - should trigger notification creation
4. **Check notification bell** - should see renewal reminder
5. **Test snooze** - click snooze button, notification should disappear

