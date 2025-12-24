# Testing Renewal Notifications

## Quick Test Methods (All Read-Only - No Data Changes)

### Method 1: Browser Console - Preview Mode (Safest)

1. **Open your app** in the browser (e.g., `lecrm-dev.vercel.app`)
2. **Open browser console** (F12 or Cmd+Option+I)
3. **Run this code:**

```javascript
// Preview what notifications would be created (READ-ONLY, no changes)
import { previewRenewalNotifications } from '@/utils/testRenewalNotifications';
previewRenewalNotifications();

// Or see what renewals exist
import { testRenewalNotifications } from '@/utils/testRenewalNotifications';
testRenewalNotifications();
```

**This is completely safe** - it only reads data and shows you what would happen, without creating any notifications or changing any data.

### Method 2: Check Existing Data (Read-Only)

Check if you already have accounts with renewals coming up:

1. **Use the preview function** in browser console (see Method 1)
2. **Or check the SQL queries below** to see what renewals exist
3. **No data changes needed** - just see what's already there

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

## Safe Testing (No Data Changes)

### Step 1: Preview What Would Happen

Run in browser console:
```javascript
import { previewRenewalNotifications } from '@/utils/testRenewalNotifications';
previewRenewalNotifications();
```

This shows you:
- Which accounts have renewals coming up
- What notifications would be created
- If any are already created or snoozed
- **No data is changed** - completely read-only

### Step 2: Check Existing Notifications

1. **Go to Dashboard** - notifications are created automatically
2. **Check notification bell** - see if any renewal reminders appear
3. **Test snooze** - click snooze button on a notification (this is safe, it only creates a snooze record)

### Step 3: Verify System is Working

If you see notifications in the preview but not in the app:
- Check browser console for errors
- Verify the SQL migration was run (`create_notification_snoozes_table.sql`)
- Check that `createRenewalNotifications()` is being called (it runs automatically on Dashboard load)

