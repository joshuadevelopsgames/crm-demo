# Notification System Optimization

## Overview

The notification system has been optimized to use a **per-user table** (`user_notification_states`) that can be fetched once on page load, avoiding expensive database queries. Notifications are automatically updated via database triggers when accounts or interactions change.

## Architecture

### 1. User Notification States Table
- **Table:** `user_notification_states`
- **Structure:** One row per user with a JSONB array of notifications
- **Purpose:** Fast, single-query access to all bulk notifications for a user
- **Types Stored:** `neglected_account`, `renewal_reminder`

### 2. Individual Notifications Table
- **Table:** `notifications`
- **Structure:** Individual rows for each notification
- **Purpose:** Task-related notifications that are created/updated individually
- **Types Stored:** `task_assigned`, `task_overdue`, `task_due_today`, `task_reminder`

## How It Works

### On Page Load
1. **First Load:** Calls `refresh_user_notifications()` SQL function to ensure notifications are up-to-date
2. **Subsequent Loads:** Fetches from `user_notification_states` table (fast, single query)
3. **Session Storage:** Tracks if notifications have been refreshed in this session to avoid unnecessary refreshes

### Automatic Updates (Triggers)
1. **Account Changes:** When an account's `last_interaction_date`, `status`, `archived`, `revenue_segment`, or `icp_status` changes, the trigger automatically updates all users' notification states
2. **Interaction Creation:** When a new interaction is created, it updates the account's `last_interaction_date`, which triggers notification updates
3. **Real-time:** No polling needed - notifications update instantly when data changes

## SQL Functions

### `refresh_user_notifications(user_id_param text)`
- **Purpose:** Refreshes notifications for a single user
- **When Called:** On page load (once per session)
- **Performance:** Fast - only processes active accounts (not archived, not excluded)
- **Returns:** Updated JSONB array of notifications

### `update_notification_state_for_account(account_id_param text)`
- **Purpose:** Updates notification states for all users when an account changes
- **When Called:** Automatically by triggers
- **Performance:** Efficient - only updates when relevant fields change

## API Endpoints

### GET `/api/data/userNotificationStates?user_id={userId}`
Fetches the current notification state for a user.

### POST `/api/data/userNotificationStates`
Actions:
- **`refresh`**: Refreshes notifications for a user (calls SQL function)
- **`upsert`**: Manually updates notification state
- **`update_read`**: Marks a notification as read/unread

## Setup Instructions

### 1. Create the Table
```sql
-- Run: create_user_notification_states_table.sql
```

### 2. Create the Refresh Function
```sql
-- Run: optimize_user_notifications_on_load.sql
```

### 3. Set Up Triggers
```sql
-- Run: add_notification_update_triggers.sql
```

### 4. Initial Population (One-Time)
```sql
-- For each user, call:
SELECT refresh_user_notifications('user-id-here');
```

Or use the API:
```javascript
POST /api/data/userNotificationStates
{
  "action": "refresh",
  "data": { "user_id": "user-id-here" }
}
```

## Benefits

1. **Fast Page Loads:** Single query to get all notifications for a user
2. **No Polling:** Triggers automatically update notifications when data changes
3. **Scalable:** Each user has their own row, no cross-user queries
4. **Efficient:** Only processes active accounts, skips archived/excluded
5. **Real-time:** Updates happen instantly via triggers

## Maintenance

### Manual Refresh
If you need to manually refresh notifications for all users:
```sql
-- Rebuild all notifications (expensive - only use when needed)
SELECT refresh_user_notifications(user_id::text) 
FROM auth.users;
```

### Monitoring
Check notification counts:
```sql
SELECT 
  user_id,
  jsonb_array_length(notifications) as notification_count,
  updated_at
FROM user_notification_states
ORDER BY updated_at DESC;
```

## Troubleshooting

### Notifications Not Appearing
1. Check if `user_notification_states` table exists
2. Verify user has a record in `user_notification_states`
3. Check if triggers are active: `SELECT * FROM pg_trigger WHERE tgname LIKE '%notification%';`
4. Manually refresh: `SELECT refresh_user_notifications('user-id');`

### Slow Page Loads
1. Check if refresh function is being called too often (should be once per session)
2. Verify indexes exist on `user_notification_states` table
3. Check if there are too many accounts (function only processes active accounts)

### Triggers Not Firing
1. Verify triggers exist: `SELECT * FROM pg_trigger WHERE tgname LIKE '%notification%';`
2. Check trigger functions: `SELECT * FROM pg_proc WHERE proname LIKE '%notification%';`
3. Test manually: `SELECT update_notification_state_for_account('account-id');`

