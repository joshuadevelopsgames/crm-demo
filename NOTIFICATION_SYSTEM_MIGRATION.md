# Notification System Migration Guide

## Overview

This migration moves from individual notification rows to a hybrid approach:
- **JSONB table** (`user_notification_states`) for bulk notifications (neglected_account, renewal_reminder)
- **Individual rows** (`notifications` table) for task notifications (task_assigned, task_overdue, etc.)

This eliminates duplicates and improves performance.

## Migration Steps

### Step 1: Create New Tables and Constraints

Run these SQL files in order in your Supabase SQL Editor:

1. **Create user_notification_states table:**
   ```sql
   -- Run: create_user_notification_states_table.sql
   ```

2. **Add unique constraint to notifications table:**
   ```sql
   -- Run: add_notification_unique_constraint.sql
   ```
   This prevents duplicate task notifications.

3. **Add triggers for instant updates:**
   ```sql
   -- Run: add_notification_update_triggers.sql
   ```
   This enables real-time notification updates when accounts/interactions change.

### Step 2: Migrate Existing Data

**IMPORTANT:** Backup your database before running this!

```sql
-- Run: migrate_notifications_to_jsonb.sql
```

This script:
- Moves existing `neglected_account` and `renewal_reminder` notifications to JSONB format
- Deletes them from the `notifications` table
- Keeps task notifications in the `notifications` table

### Step 3: Clean Up Duplicates (Optional but Recommended)

If you have duplicate notifications, run this cleanup:

```sql
-- Remove duplicate bulk notifications before migration
DELETE FROM notifications n1
WHERE n1.id IN (
  SELECT n2.id
  FROM notifications n2
  WHERE EXISTS (
    SELECT 1
    FROM notifications n3
    WHERE n3.user_id = n2.user_id
      AND n3.type = n2.type
      AND n3.related_account_id = n2.related_account_id
      AND n3.id != n2.id
      AND n3.created_at > n2.created_at
  )
  AND n2.type IN ('neglected_account', 'renewal_reminder')
);
```

### Step 4: Verify Migration

Check that notifications are working:

```sql
-- Check user notification states
SELECT user_id, jsonb_array_length(notifications) as notification_count 
FROM user_notification_states;

-- Check task notifications (should still be in notifications table)
SELECT type, COUNT(*) 
FROM notifications 
WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder')
GROUP BY type;

-- Verify no bulk notifications remain
SELECT COUNT(*) 
FROM notifications 
WHERE type IN ('neglected_account', 'renewal_reminder');
-- Should return 0
```

## Architecture

### Bulk Notifications (JSONB)
- **Types:** `neglected_account`, `renewal_reminder`
- **Storage:** `user_notification_states.notifications` (JSONB array)
- **Updates:** Triggered automatically when accounts/interactions change
- **Benefits:** No duplicates, fast reads, atomic updates

### Task Notifications (Individual Rows)
- **Types:** `task_assigned`, `task_overdue`, `task_due_today`, `task_reminder`
- **Storage:** `notifications` table (individual rows)
- **Updates:** Created when tasks are assigned/updated
- **Benefits:** Standard SQL queries, easy filtering

## API Endpoints

### Get User Notification State
```
GET /api/data/userNotificationStates?user_id={userId}
```

### Update User Notification State
```
POST /api/data/userNotificationStates
Body: {
  action: "upsert",
  data: {
    user_id: "user-id",
    notifications: [...]
  }
}
```

### Mark Notification as Read
```
POST /api/data/userNotificationStates
Body: {
  action: "update_read",
  data: {
    user_id: "user-id",
    notification_id: "notification-id",
    is_read: true
  }
}
```

## Troubleshooting

### Issue: Notifications not appearing
1. Check if `user_notification_states` table exists
2. Verify user has a record in `user_notification_states`
3. Check browser console for errors
4. Verify API endpoint is accessible

### Issue: Duplicates still appearing
1. Run the cleanup script above
2. Check that unique constraint is in place
3. Verify triggers are working (check Supabase logs)

### Issue: Notifications not updating in real-time
1. Verify triggers are created (`add_notification_update_triggers.sql`)
2. Check Supabase logs for trigger errors
3. Manually trigger update: `SELECT update_notification_state_for_account('account-id');`

## Rollback

If you need to rollback:

1. **Restore from backup** (if you backed up before migration)
2. **Or manually recreate notifications:**
   ```sql
   -- Extract notifications from JSONB and recreate as individual rows
   INSERT INTO notifications (user_id, type, title, message, related_account_id, is_read, created_at)
   SELECT 
     user_id,
     elem->>'type',
     elem->>'title',
     elem->>'message',
     elem->>'related_account_id',
     (elem->>'is_read')::boolean,
     (elem->>'created_at')::timestamptz
   FROM user_notification_states,
   LATERAL jsonb_array_elements(notifications) elem;
   ```

## Next Steps

After migration:
1. Monitor for duplicate warnings in console
2. Test notification creation/updates
3. Verify real-time updates work
4. Consider adding Supabase Realtime subscriptions for instant UI updates

