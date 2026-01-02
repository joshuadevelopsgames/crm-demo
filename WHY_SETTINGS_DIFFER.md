# Why Settings Differ Between Devices (Same User)

## Root Causes

### 1. **Test Mode Eligibility - Based on Session Email**

Test mode visibility is determined by `user?.email` from the **Supabase auth session**, NOT from the profile.

**Code Location:** `src/contexts/TestModeContext.jsx:67-87`

```javascript
const isEligibleForTestMode = useMemo(() => {
  const eligibleEmails = ['jrsschroeder@gmail.com', 'jon@lecm.ca', 'blake@lecm.ca'];
  const userEmail = user?.email?.toLowerCase()?.trim();
  return eligibleEmails.some(email => email.toLowerCase() === userEmail);
}, [user?.email]);
```

**Why this matters:**
- If the session email doesn't match the eligible list, test mode won't show
- The session email comes from Supabase auth, not the profile
- If someone is logged in with a different email (even same user account), they won't see it

**Check:**
```javascript
// In browser console
const supabase = window.__supabase || (await import('./services/supabaseClient')).getSupabaseAuth();
const { data: { session } } = await supabase.auth.getSession();
console.log('Session email:', session?.user?.email);
```

### 2. **Admin Status - Based on Profile Role OR Email**

Admin features are determined by:
- `profile?.role === 'system_admin'` OR
- `profile?.role === 'admin'` OR  
- `profile?.email === 'jrsschroeder@gmail.com'`

**Code Location:** `src/contexts/UserContext.jsx:187-189`

**Why this matters:**
- If the profile isn't loading properly, `isAdmin` will be false
- If the profile role isn't set in the database, admin features won't show
- The profile must load from the database for this to work

**Check:**
```javascript
// In browser console - check profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();
console.log('Profile role:', profile?.role);
console.log('Profile email:', profile?.email);
```

### 3. **Profile Not Loading**

If the profile isn't loading from the database, the app falls back to in-memory profile which might have different values.

**Symptoms:**
- Profile role might be missing
- Settings might not sync
- Admin features might not show

**Check:**
- Look for `📋 Fetching profile for user` in console
- Look for `📋 Profile fetch result` in console
- Check for errors in profile fetch

### 4. **Email Mismatch Between Session and Profile**

The session email (from Supabase auth) might differ from the profile email (from database).

**Why this happens:**
- User changed email in Supabase auth but profile wasn't updated
- Profile was created with different email
- Multiple accounts with same user ID

**Check:**
```javascript
// Compare session email vs profile email
console.log('Session email:', session.user.email);
console.log('Profile email:', profile?.email);
```

### 5. **Stale localStorage**

Settings might be cached in localStorage and not syncing with database.

**Check:**
```javascript
console.log('localStorage darkMode:', localStorage.getItem('darkMode'));
console.log('localStorage testMode2025:', localStorage.getItem('testMode2025'));
```

## Diagnostic Steps

### Step 1: Run Diagnostic Tool

In browser console (F12), run:
```javascript
import('./utils/diagnoseSettingsVisibility').then(m => 
  m.diagnoseSettingsVisibility().then(r => {
    console.log('=== SETTINGS DIAGNOSTIC ===');
    console.log(JSON.stringify(r, null, 2));
  })
);
```

This will show:
- Session email
- Profile data
- Test mode eligibility
- Admin status
- Any issues found

### Step 2: Check Console Logs

Look for these logs:
- `🔍 UserContext Debug` - Shows session, profile, admin status
- `[TestModeContext] Eligibility check` - Shows test mode eligibility
- `📋 Fetching profile for user` - Shows profile fetch
- `📋 Profile fetch result` - Shows profile fetch result

### Step 3: Compare Both Devices

On both devices, check:
1. Session email (should be same)
2. Profile role (should be same)
3. Profile email (should match session email)
4. Console errors (should be none)

## Most Likely Issues

### Issue 1: Profile Not Loading on PC
**Symptom:** Settings don't show, admin features missing
**Fix:**
- Clear browser cache
- Sign out and sign back in
- Check Supabase connection
- Check console for profile fetch errors

### Issue 2: Different Email in Session
**Symptom:** Test mode doesn't show
**Fix:**
- Verify user is logged in with correct email
- Check `session.user.email` in console
- Ensure email matches eligible list exactly

### Issue 3: Profile Role Not Set
**Symptom:** Admin features don't show
**Fix:**
- Check profile in Supabase Dashboard
- Verify `role` column is set correctly
- Update profile role if needed

### Issue 4: Email Mismatch
**Symptom:** Some features work, others don't
**Fix:**
- Update profile email to match session email
- Or update session email to match profile
- Ensure both match

## Quick Fixes

### Fix 1: Force Profile Refresh
```javascript
// In browser console
localStorage.clear();
location.reload();
```

### Fix 2: Check Database Directly
1. Go to Supabase Dashboard
2. Open `profiles` table
3. Find user's row
4. Check:
   - `email` matches session email
   - `role` is set correctly
   - `dark_mode` and `test_mode_enabled` are set

### Fix 3: Sign Out/In
- Sign out completely
- Clear browser cache
- Sign back in
- Check console logs

## Summary

**The most common reasons settings differ:**

1. **Test Mode:** Session email doesn't match eligible list
2. **Admin Features:** Profile role isn't set or profile isn't loading
3. **Profile Sync:** Profile not loading from database on one device
4. **Email Mismatch:** Session email ≠ Profile email

**Solution:** Run the diagnostic tool on both devices and compare the results. The tool will show exactly what's different.

