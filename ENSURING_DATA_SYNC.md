# Ensuring Data Sync Across All Devices

## Current Status: What Syncs vs What Doesn't

### ✅ **Synced to Database** (Everyone sees the same)

1. **Dark Mode** (`profiles.dark_mode`)
   - Stored in: `profiles` table
   - Syncs: ✅ Yes - All devices
   - Source of truth: Database

2. **Test Mode** (`profiles.test_mode_enabled`)
   - Stored in: `profiles` table
   - Syncs: ✅ Yes - All devices
   - Source of truth: Database
   - Note: Only visible to eligible users (email-based)

3. **User Profile Data**
   - Full name, phone, email
   - Stored in: `profiles` table
   - Syncs: ✅ Yes - All devices

4. **Notification Preferences** (`profiles.notification_preferences`)
   - Email notifications, task reminders
   - Stored in: `profiles` table
   - Syncs: ✅ Yes - All devices

5. **User Permissions** (`user_permissions` table)
   - Custom permissions per user
   - Stored in: Database
   - Syncs: ✅ Yes - All devices

6. **User Role** (`profiles.role`)
   - Admin, system_admin, user
   - Stored in: `profiles` table
   - Syncs: ✅ Yes - All devices

### 🔴 **NOT Synced** (Device-specific)

1. **Announcement Dismissals** (`dismissedAnnouncements`)
   - Stored in: localStorage only
   - Reason: Per-device preference (you might want to see announcements on different devices)

2. **PWA Install Prompt** (`pwa-install-prompt-seen`)
   - Stored in: localStorage only
   - Reason: Device-specific (different browsers/devices)

## How to Ensure Everyone Sees the Same Thing

### 1. **Database is Source of Truth**

All user settings that should sync are stored in the `profiles` table:
- `dark_mode` - Dark mode preference
- `test_mode_enabled` - Test mode toggle
- `notification_preferences` - Notification settings
- `role` - User role/permissions
- `full_name`, `phone_number` - Profile info

### 2. **How Sync Works**

1. **On Load:**
   - App loads from localStorage first (for instant UI)
   - Then fetches profile from database
   - Database value overrides localStorage (database wins)

2. **On Change:**
   - User changes setting
   - Saves to database immediately
   - Also saves to localStorage (as fallback)

3. **On Other Devices:**
   - When user logs in on another device
   - Profile loads from database
   - Database value is used (overrides any local storage)

### 3. **Force Refresh Profile Data**

If settings aren't syncing, you can force a refresh:

**Option 1: Hard Refresh**
- `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- This clears cache and reloads everything

**Option 2: Clear localStorage and Refresh**
```javascript
// In browser console (F12)
localStorage.clear();
location.reload();
```

**Option 3: Sign Out and Sign Back In**
- This forces a fresh profile fetch from database

**Option 4: Check Profile Directly**
```javascript
// In browser console (F12)
const supabase = window.__supabase || (await import('./services/supabaseClient')).getSupabaseAuth();
const { data: { session } } = await supabase.auth.getSession();
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();
console.log('Profile from database:', profile);
```

### 4. **Verify Settings Are in Database**

Check Supabase directly:
1. Go to Supabase Dashboard
2. Open `profiles` table
3. Find the user's row
4. Check these columns:
   - `dark_mode` - Should be true/false
   - `test_mode_enabled` - Should be true/false (if eligible)
   - `notification_preferences` - Should be JSON object
   - `role` - Should be user/admin/system_admin

### 5. **Common Issues**

#### Issue: Settings not syncing
**Cause:** Profile not loading from database
**Fix:**
- Check browser console for errors
- Verify Supabase connection
- Sign out and sign back in
- Clear cache and refresh

#### Issue: Different settings on different devices
**Cause:** Stale localStorage or profile not refreshing
**Fix:**
- Clear localStorage: `localStorage.clear()` then refresh
- Sign out and sign back in
- Check database directly to verify values

#### Issue: Test mode not showing
**Cause:** Email not in eligible list OR profile not loading
**Fix:**
- Check console for `[TestModeContext] Eligibility check` log
- Verify email matches eligible list exactly
- Check `user?.email` in console

### 6. **Best Practices**

1. **Always check database first** - If settings differ, check Supabase directly
2. **Clear cache when troubleshooting** - Stale data can cause issues
3. **Sign out/in to force refresh** - Ensures fresh profile fetch
4. **Check console logs** - Look for profile fetch errors
5. **Verify Supabase connection** - Make sure app can connect to database

## Quick Diagnostic Checklist

When settings aren't syncing:

- [ ] Check browser console for errors
- [ ] Verify Supabase connection is working
- [ ] Check profile data in database (Supabase Dashboard)
- [ ] Clear localStorage and refresh
- [ ] Sign out and sign back in
- [ ] Check console logs for profile fetch
- [ ] Verify user email matches expected value
- [ ] Check network tab for failed API calls

## Summary

**Everything that should sync IS syncing to the database.** The database is the source of truth. If you see different settings on different devices:

1. The database value is correct
2. The device showing wrong values likely has:
   - Stale localStorage
   - Profile not loading properly
   - Cache issues

**Solution:** Clear cache, sign out/in, or check the database directly to verify the correct values.

