# Fix Missing notification_preferences Column

## 🐛 Error
```
Could not find the 'notification_preferences' column of 'profiles' in the schema cache
```

## ✅ Solution: Add the Column to Database

The `notification_preferences` column needs to be added to your `profiles` table in Supabase.

### Step 1: Go to Supabase SQL Editor

1. **Open:** https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. **Navigate to:** SQL Editor (left sidebar)
3. **Click:** "New query"

### Step 2: Run This SQL Script

Copy and paste this entire script into the SQL Editor:

```sql
-- Add notification_preferences JSONB column to profiles table
-- This stores user preferences for different notification types

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "email_notifications": true,
  "task_reminders": true,
  "system_announcements": true
}'::jsonb;

-- Create GIN index for faster queries on notification_preferences
CREATE INDEX IF NOT EXISTS idx_profiles_notification_preferences_gin 
  ON profiles USING GIN (notification_preferences);

-- Add comment
COMMENT ON COLUMN profiles.notification_preferences IS 'User preferences for notifications stored as JSONB: email_notifications, task_reminders, system_announcements';
```

### Step 3: Execute

1. **Click:** "Run" button (or press `Cmd+Enter` / `Ctrl+Enter`)
2. **Wait for:** Success message
3. **Verify:** You should see "Success. No rows returned"

### Step 4: Verify the Column Exists

Run this query to verify:

```sql
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'notification_preferences';
```

**Expected result:** You should see one row with:
- `column_name`: `notification_preferences`
- `data_type`: `jsonb`
- `column_default`: The default JSON object

### Step 5: Test in Your App

1. **Refresh** your app
2. **Go to Settings** page
3. **Toggle** notification preferences
4. **Click** "Save Notification Preferences"
5. **Should work** without errors! ✅

---

## 📋 What This Column Does

The `notification_preferences` column stores user preferences for:
- **Email Notifications** - Receive email notifications for important updates
- **Task Reminders** - Get reminders for upcoming and overdue tasks  
- **System Announcements** - Receive notifications for system-wide announcements

It's stored as a JSONB object like:
```json
{
  "email_notifications": true,
  "task_reminders": true,
  "system_announcements": true
}
```

---

## 🔍 Troubleshooting

### If you get "column already exists"
- The column is already there, you can skip this fix
- The error might be from a different issue

### If you get permission errors
- Make sure you're logged into Supabase as the project owner
- Check that you're in the correct project (nyyukbaodgzyvcccpojn)

### If the error persists after adding the column
1. **Wait 1-2 minutes** for Supabase to update its schema cache
2. **Refresh** your app
3. **Try again**

---

## ✅ After Fixing

Once the column is added:
- ✅ Settings page will work
- ✅ Notification preferences will save
- ✅ Users can toggle email notifications, task reminders, and system announcements

