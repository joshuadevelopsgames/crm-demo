# Announcements Feature - Setup Guide

## ✅ What Was Implemented

A complete announcement system that allows admins to create system-wide announcements displayed as a thin banner under the menu bar for all users with announcements enabled.

### Components Created:

1. **Database Table** (`create_announcements_table.sql`)
   - Stores announcements with title, content, priority, expiration date
   - Only admins can create/update/delete (enforced via RLS)

2. **API Endpoint** (`api/data/announcements.js`)
   - GET: All authenticated users can read active announcements
   - POST: Only admins can create announcements
   - PUT: Only admins can update announcements
   - DELETE: Only admins can delete (soft delete by setting is_active=false)
   - Automatically creates notifications for users with announcements enabled

3. **Admin UI** (`src/pages/Announcements.jsx`)
   - Full CRUD interface for managing announcements
   - Priority levels: Low, Normal, High, Urgent
   - Optional expiration dates
   - Accessible from navigation menu (admin only)

4. **Settings Integration** (`src/pages/Settings.jsx`)
   - Users can toggle "System Announcements" preference
   - Preferences saved to `profiles.notification_preferences` JSONB column

5. **Banner Display** (`src/components/AnnouncementBanner.jsx`)
   - Announcements appear as a thin banner under the menu bar
   - Color-coded by priority (low/normal/high/urgent)
   - Clickable to view full content in a dialog
   - Dismissible (stored in localStorage)
   - Only shows for users with announcements enabled

6. **Database Migration** (`add_notification_preferences_to_profiles.sql`)
   - Adds `notification_preferences` JSONB column to profiles table

---

## 📋 Setup Steps

### 1. Run SQL Migrations in Supabase

Go to **Supabase Dashboard → SQL Editor** and run these files **in order**:

1. **Add notification preferences to profiles:**
   ```sql
   -- Copy and paste contents of: add_notification_preferences_to_profiles.sql
   ```

2. **Create announcements table:**
   ```sql
   -- Copy and paste contents of: create_announcements_table.sql
   ```

### 2. Verify Environment Variables

Make sure these are set in **Vercel → Settings → Environment Variables**:
- ✅ `SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

### 3. Deploy Code Changes

The following files have been created/updated:
- ✅ `api/data/announcements.js` - New API endpoint
- ✅ `api/data/profile.js` - Updated to handle notification preferences
- ✅ `src/pages/Announcements.jsx` - New admin page
- ✅ `src/pages/Settings.jsx` - Updated to save notification preferences
- ✅ `src/components/AnnouncementBanner.jsx` - New banner component
- ✅ `src/components/Layout.jsx` - Added banner to layout
- ✅ `src/components/Layout.jsx` - Added Announcements to admin navigation
- ✅ `src/App.jsx` - Added Announcements route

---

## 🎯 How to Use

### For Admins: Creating Announcements

1. **Navigate to Announcements Page**
   - Click "Announcements" in the navigation menu (admin only)
   - Or go to `/announcements`

2. **Create New Announcement**
   - Click "New Announcement" button
   - Fill in:
     - **Title** (required)
     - **Content** (required)
     - **Priority** (Low, Normal, High, Urgent)
     - **Expires At** (optional - announcement will auto-hide after this date)
   - Click "Create Announcement"

3. **Manage Announcements**
   - Click edit icon to update an announcement
   - Click delete icon to remove an announcement (soft delete)
   - Only active, non-expired announcements are shown

### For Users: Receiving Announcements

1. **Enable Announcements** (Settings)
   - Go to Settings page
   - Under "Notification Preferences"
   - Toggle "System Announcements" ON
   - Click "Save Notification Preferences"

2. **View Announcements**
   - Announcements appear as a thin banner directly under the menu bar
   - Banner shows title, priority badge, and preview of content
   - Click the banner to view full announcement content in a dialog
   - Click the X button to dismiss (dismissal is saved in browser)
   - Banner is color-coded by priority level

---

## 🔒 Security

- **RLS Policies**: Only admins can create/update/delete announcements
- **API Authentication**: All endpoints require valid auth token
- **Admin Check**: API verifies user has admin/system_admin role before allowing writes
- **User Preferences**: Users can opt-out of announcements via Settings

---

## 📊 Database Schema

### announcements table
```sql
- id (uuid, primary key)
- title (text, required)
- content (text, required)
- priority (text: low/normal/high/urgent, default: normal)
- created_by (text, required)
- created_at (timestamptz)
- updated_at (timestamptz)
- expires_at (timestamptz, nullable)
- is_active (boolean, default: true)
```

### profiles.notification_preferences (JSONB)
```json
{
  "email_notifications": true,
  "task_reminders": true,
  "system_announcements": true
}
```

---

## 🎨 UI Features

- **Priority Badges**: Color-coded by priority level (low/normal/high/urgent)
- **Banner Display**: Thin banner under menu bar, non-intrusive
- **Clickable Banner**: Click to view full content in a dialog
- **Dismissible**: Users can dismiss announcements (stored in localStorage)
- **Expiration Handling**: Expired announcements automatically hidden
- **Responsive Design**: Works on desktop and mobile
- **Dark Mode Support**: Full dark mode compatibility
- **User Preferences**: Respects user's announcement preference setting

---

## 🚀 Next Steps

After running the SQL migrations:
1. Deploy the code changes
2. Test creating an announcement as an admin
3. Verify it appears in notification bell for users with announcements enabled
4. Test user preference toggle in Settings

---

## 📝 Notes

- Announcements appear as a banner, NOT as notifications in the notification bell
- Banner only shows for users with `system_announcements: true` in their preferences (default)
- Users can dismiss announcements - dismissal is stored in localStorage per browser
- Only the most recent active announcement is shown (if multiple exist)
- Expired announcements are automatically hidden
- Deleted announcements are soft-deleted (is_active=false) for audit trail
- Banner is clickable to view full content in a dialog

