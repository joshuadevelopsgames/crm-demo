# Notification System Setup - Complete Guide

## ✅ What Was Implemented

A hybrid notification system that eliminates duplicates and improves performance:

1. **JSONB Table** (`user_notification_states`) - Stores bulk notifications (neglected_account, renewal_reminder)
2. **Individual Rows** (`notifications` table) - Stores task notifications (task_assigned, task_overdue, etc.)
3. **Database Triggers** - Instant updates when accounts/interactions change
4. **Unique Constraints** - Prevents duplicate task notifications
5. **Updated Services** - Notification service now uses JSONB for bulk notifications
6. **Updated UI** - NotificationBell reads from both sources seamlessly

## 📋 Setup Steps

### 1. Run SQL Migrations in Supabase

Go to **Supabase Dashboard → SQL Editor** and run these files **in order**:

1. **Create the new table:**
   ```sql
   -- Copy and paste contents of: create_user_notification_states_table.sql
   ```

2. **Add unique constraint (prevents duplicates):**
   ```sql
   -- Copy and paste contents of: add_notification_unique_constraint.sql
   ```

3. **Add triggers (for instant updates):**
   ```sql
   -- Copy and paste contents of: add_notification_update_triggers.sql
   ```

4. **Clean up existing duplicates (optional but recommended):**
   ```sql
   -- Copy and paste contents of: cleanup-duplicate-notifications.sql
   ```

5. **Migrate existing data:**
   ```sql
   -- Copy and paste contents of: migrate_notifications_to_jsonb.sql
   ```

### 2. Verify Supabase Environment Variables

Make sure these are set in **Vercel → Settings → Environment Variables**:

- ✅ `SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

### 3. Deploy Code Changes

The following files have been updated:
- ✅ `src/services/notificationService.js` - Uses JSONB for bulk notifications
- ✅ `src/components/NotificationBell.jsx` - Reads from both sources
- ✅ `api/data/userNotificationStates.js` - New API endpoint

**Deploy to Vercel:**
```bash
git add .
git commit -m "Implement hybrid notification system with JSONB"
git push
```

### 4. Test the System

1. **Check for duplicates:**
   - Open browser console
   - Look for the warning: "⚠️ WARNING: X unread notifications but only Y unique accounts"
   - This should be gone after migration

2. **Test notification creation:**
   - Create an interaction for an account
   - Check that neglected account notification appears/updates
   - Verify no duplicates are created

3. **Test task notifications:**
   - Assign a task to a user
   - Verify task_assigned notification appears
   - Check that duplicates are prevented

## 🔍 Verification Queries

Run these in Supabase SQL Editor to verify:

```sql
-- Check user notification states
SELECT 
  user_id, 
  jsonb_array_length(notifications) as notification_count,
  updated_at
FROM user_notification_states
ORDER BY updated_at DESC;

-- Check task notifications (should still be individual rows)
SELECT 
  type, 
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users
FROM notifications 
WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder')
GROUP BY type;

-- Verify no bulk notifications remain in notifications table
SELECT COUNT(*) as remaining_bulk_notifications
FROM notifications 
WHERE type IN ('neglected_account', 'renewal_reminder');
-- Should return 0

-- Check for duplicates (should return 0)
SELECT 
  user_id, 
  type, 
  related_account_id, 
  COUNT(*) as duplicate_count
FROM notifications
WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder')
GROUP BY user_id, type, related_task_id
HAVING COUNT(*) > 1;
```

## 🚀 How It Works

### Bulk Notifications (JSONB)
- **Stored in:** `user_notification_states.notifications` (JSONB array)
- **Types:** `neglected_account`, `renewal_reminder`
- **Updates:** Automatic via database triggers
- **Benefits:** No duplicates, fast reads, atomic updates

### Task Notifications (Individual Rows)
- **Stored in:** `notifications` table
- **Types:** `task_assigned`, `task_overdue`, `task_due_today`, `task_reminder`
- **Updates:** Created when tasks are assigned/updated
- **Benefits:** Standard SQL, easy filtering, unique constraint prevents duplicates

## 🐛 Troubleshooting

### Issue: "Table user_notification_states does not exist"
**Solution:** Run `create_user_notification_states_table.sql` in Supabase SQL Editor

### Issue: Duplicates still appearing
**Solution:** 
1. Run `cleanup-duplicate-notifications.sql`
2. Verify unique constraint exists: `SELECT * FROM pg_constraint WHERE conname = 'unique_user_task_notification';`

### Issue: Notifications not updating in real-time
**Solution:**
1. Check triggers exist: `SELECT * FROM pg_trigger WHERE tgname LIKE '%notification%';`
2. Test trigger manually: `SELECT update_notification_state_for_account('account-id');`

### Issue: API errors
**Solution:**
1. Verify environment variables in Vercel
2. Check Supabase RLS policies
3. Check browser console for errors

## 📊 Performance Improvements

- **Before:** 41,299 notifications for 324 accounts (127 per account!)
- **After:** 1 notification state per user (no duplicates possible)
- **Read Speed:** 1 query instead of thousands
- **Update Speed:** Instant via triggers

## 🔄 Rollback Plan

If you need to rollback:

1. **Restore from database backup** (if available)
2. **Or manually recreate notifications:**
   ```sql
   -- Extract from JSONB and recreate as rows
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
   LATERAL jsonb_array_elements(notifications) elem
   WHERE elem->>'type' IN ('neglected_account', 'renewal_reminder');
   ```

## ✅ Success Criteria

After setup, you should see:
- ✅ No duplicate warnings in console
- ✅ Notifications appear instantly when accounts/interactions change
- ✅ Task notifications work normally
- ✅ No performance issues
- ✅ Clean database (no duplicate rows)

## 📝 Next Steps (Optional)

1. **Add Supabase Realtime** for instant UI updates:
   ```javascript
   // In NotificationBell.jsx
   const channel = supabase
     .channel(`user_notifications:${userId}`)
     .on('postgres_changes', {
       event: 'UPDATE',
       schema: 'public',
       table: 'user_notification_states',
       filter: `user_id=eq.${userId}`
     }, () => {
       queryClient.invalidateQueries(['notifications', userId]);
     })
     .subscribe();
   ```

2. **Monitor notification counts:**
   - Set up alerts for unusual notification counts
   - Track notification creation rates

3. **Optimize further:**
   - Add indexes if needed
   - Consider caching for frequently accessed data

---

**Questions?** Check `NOTIFICATION_SYSTEM_MIGRATION.md` for detailed migration steps.

