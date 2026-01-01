# Troubleshoot Profile Settings Not Saving

## 🔍 Check These Issues

### 1. Check Browser Console for Errors

Open your browser's Developer Console (F12) and look for:
- ❌ Red error messages when clicking "Save Changes"
- 🔍 Look for messages starting with "❌" or "Error updating profile"

### 2. Verify notification_preferences Column Exists

Run this in Supabase SQL Editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'notification_preferences';
```

**Expected:** Should return one row with `notification_preferences` and `jsonb`

**If missing:** Run `add_notification_preferences_to_profiles.sql`

### 3. Check RLS Policies

Run this to see current policies:

```sql
SELECT 
  policyname,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

**Should have:**
- `profiles_update_all_authenticated` (or similar) for UPDATE operations

**If missing:** Run `FIX_PROFILES_RLS_SEE_ALL_USERS.sql`

### 4. Test Direct Update

Try updating your profile directly in Supabase SQL Editor:

```sql
-- First, get your user ID
SELECT id, email FROM auth.users WHERE email = 'jrsschroeder@gmail.com';

-- Then test update (replace YOUR_USER_ID with the ID from above)
UPDATE profiles 
SET 
  full_name = 'Test Name',
  phone_number = '123-456-7890',
  notification_preferences = '{"email_notifications": true, "task_reminders": true, "system_announcements": true}'::jsonb
WHERE id = 'YOUR_USER_ID'
RETURNING *;
```

**If this fails:** The issue is with RLS or the column doesn't exist.

**If this works:** The issue is with the frontend code or API.

---

## 🔧 Common Fixes

### Fix 1: Add notification_preferences Column

If the column is missing, run:

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "email_notifications": true,
  "task_reminders": true,
  "system_announcements": true
}'::jsonb;
```

### Fix 2: Fix RLS Policies

If RLS is blocking updates, run:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;

-- Create policy to allow all authenticated users to update
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```

### Fix 3: Check API Endpoint

The Settings page should automatically fall back to the API endpoint if direct Supabase update fails. Check:

1. **Browser Console** - Look for "🔄 Trying API endpoint as fallback..."
2. **Network Tab** - Check if `/api/data/profile` request is being made
3. **Response** - Check if the API returns success or error

---

## 🐛 Debug Steps

1. **Open Browser Console** (F12)
2. **Go to Settings page**
3. **Change a setting** (e.g., full name)
4. **Click "Save Changes"**
5. **Watch console** for:
   - `Attempting to update profile directly via Supabase...`
   - Either: `✅ Profile updated successfully` OR `❌ Direct Supabase update failed`
   - If failed: `🔄 Trying API endpoint as fallback...`
   - Then: `📥 API response:` with status and result

6. **Check Network Tab:**
   - Look for request to `/api/data/profile`
   - Check status code (should be 200)
   - Check response body

---

## ✅ Expected Behavior

When saving works correctly, you should see:

1. **Console:**
   ```
   Attempting to update profile directly via Supabase...
   ✅ Profile updated successfully via direct Supabase update
   ```

   OR (if direct update fails):
   ```
   Attempting to update profile directly via Supabase...
   ❌ Direct Supabase update failed: [error details]
   🔄 Trying API endpoint as fallback...
   📡 Calling API endpoint with token...
   📥 API response: {status: 200, result: {success: true, ...}}
   ✅ Profile updated successfully via API endpoint
   ```

2. **Toast notification:** "✓ Profile updated successfully"

3. **Settings persist:** After refresh, your changes should still be there

---

## 🚨 If Still Not Working

1. **Check Vercel logs** for API errors
2. **Verify environment variables** are set in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
3. **Try logging out and back in** (refreshes session token)
4. **Clear browser cache** and try again

---

## 📝 What to Share for Help

If you need help, share:
1. **Console errors** (copy/paste from browser console)
2. **Network request details** (from Network tab, the `/api/data/profile` request)
3. **Result of SQL checks** (from steps 2 and 3 above)

