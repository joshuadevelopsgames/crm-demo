# Troubleshooting Test Mode Visibility Issues

## Problem
User can see test mode settings on one computer but not on another, even though they're logged in as the same user.

## Root Cause
Test mode visibility is determined by the user's **email address** from the Supabase auth session. The eligible emails are:
- `jrsschroeder@gmail.com`
- `jon@lecm.ca`
- `blake@lecm.ca`

## Common Issues & Solutions

### 1. Email Case Sensitivity
**Problem:** Email might have different casing (e.g., `Jon@lecm.ca` vs `jon@lecm.ca`)

**Solution:** The code now handles this with case-insensitive comparison, but check:
- Open browser console (F12)
- Look for `[TestModeContext] Eligibility check` log
- Verify the email matches exactly (case-insensitive)

### 2. Session Not Loading
**Problem:** The user session might not be loading properly on the PC

**Check:**
1. Open browser console (F12)
2. Look for `🔍 UserContext Debug` log
3. Verify:
   - `hasSession: true`
   - `userEmail` matches expected email
   - `hasProfile: true`

**Solution:**
- Clear browser cache and cookies
- Sign out and sign back in
- Check if Supabase connection is working (look for errors in console)

### 3. Different Email Address
**Problem:** User might be logged in with a different email on the PC

**Check:**
1. Open browser console (F12)
2. Look for `[TestModeContext] Eligibility check` log
3. Compare the `userEmail` value with the expected email

**Solution:**
- Verify the user is logged in with the correct email
- Check if multiple accounts exist for the same user
- Sign out and sign in with the correct email

### 4. Profile Not Syncing
**Problem:** Profile data might not be syncing between devices

**Check:**
1. Open browser console (F12)
2. Look for `📋 Fetching profile for user` log
3. Check for any errors in profile fetch

**Solution:**
- Refresh the page
- Clear browser cache
- Check Supabase connection

### 5. Browser Cache/LocalStorage Issues
**Problem:** Stale data in browser cache or localStorage

**Solution:**
1. Clear browser cache and cookies
2. Clear localStorage:
   ```javascript
   // In browser console (F12)
   localStorage.clear();
   ```
3. Refresh the page and sign in again

### 6. Different Supabase Environment
**Problem:** PC might be connecting to a different Supabase project

**Check:**
1. Open browser console (F12)
2. Look for Supabase connection errors
3. Check network tab for API calls to Supabase
4. Verify the Supabase URL matches production

**Solution:**
- Verify environment variables are set correctly
- Check Vercel deployment settings
- Ensure both computers are using the same environment

## Diagnostic Steps

### Step 1: Check Console Logs
Open browser console (F12) and look for:
- `[TestModeContext] Eligibility check` - Shows email and eligibility status
- `🔍 UserContext Debug` - Shows session and profile info
- `📋 Fetching profile for user` - Shows profile fetch status

### Step 2: Verify User Email
In browser console, run:
```javascript
// Check current user email
const supabase = window.__supabase || (await import('./services/supabaseClient')).getSupabaseAuth();
const { data: { session } } = await supabase.auth.getSession();
console.log('User email:', session?.user?.email);
```

### Step 3: Check Eligibility
In browser console, run:
```javascript
const eligibleEmails = ['jrsschroeder@gmail.com', 'jon@lecm.ca', 'blake@lecm.ca'];
const userEmail = session?.user?.email?.toLowerCase()?.trim();
const isEligible = eligibleEmails.some(email => email.toLowerCase() === userEmail);
console.log('Is eligible:', isEligible, 'User email:', userEmail);
```

### Step 4: Check Profile Data
In browser console, run:
```javascript
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();
console.log('Profile:', profile);
```

## Quick Fixes

### Fix 1: Force Refresh
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear cache and reload

### Fix 2: Re-authenticate
1. Sign out completely
2. Clear browser cache
3. Sign in again
4. Check console logs

### Fix 3: Check Network
1. Open Network tab in DevTools
2. Check for failed Supabase API calls
3. Verify no CORS errors
4. Check if requests are going to correct Supabase URL

## Still Not Working?

If none of the above fixes work:

1. **Compare both computers:**
   - Check console logs on both
   - Compare user email values
   - Compare profile data

2. **Check Supabase directly:**
   - Go to Supabase Dashboard
   - Check `profiles` table
   - Verify user exists and has correct email

3. **Check environment:**
   - Verify both computers are using same Vercel deployment
   - Check environment variables match
   - Verify Supabase project is the same

4. **Contact support:**
   - Share console logs from both computers
   - Share network tab screenshots
   - Share Supabase profile data

