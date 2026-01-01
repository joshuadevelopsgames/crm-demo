# Troubleshoot "Invalid login credentials" Error

## Quick Checklist

If you're getting "Invalid login credentials" after creating a user, check these:

### ✅ 1. Verify User Exists in Supabase

1. **Go to:** https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. **Navigate to:** Authentication → Users
3. **Look for:** `jrsschroeder@gmail.com`
4. **Check:**
   - User is in the list
   - Email is exactly `jrsschroeder@gmail.com` (no typos, no extra spaces)
   - Status shows as "Active" or "Confirmed"

### ✅ 2. Check Email Confirmation

**If email confirmation is required:**
- The user must have `email_confirmed_at` set
- When creating the user, make sure to check **"Auto Confirm Email"** ✅

**To check if user is confirmed:**
Run this in Supabase SQL Editor:

```sql
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmed - can login'
    ELSE '❌ Email NOT confirmed - cannot login'
  END as status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';
```

**If email is not confirmed:**
1. Go to Authentication → Users
2. Click on the user
3. Click "Send confirmation email" OR manually confirm by checking "Auto Confirm Email" when editing

### ✅ 3. Verify Password

**Common issues:**
- Password has extra spaces (copy/paste issues)
- Password is case-sensitive
- Password was changed after creation

**To reset password:**
1. Go to Authentication → Users
2. Click on `jrsschroeder@gmail.com`
3. Click "Reset Password" or manually set a new password
4. **Make sure you remember the exact password** (no extra spaces!)

### ✅ 4. Check Email Case Sensitivity

Supabase is usually case-insensitive, but double-check:
- Email in Supabase: `jrsschroeder@gmail.com`
- Email you're entering: `jrsschroeder@gmail.com` (exact match, no caps)

### ✅ 5. Verify Project

Make sure you created the user in the **correct project**:
- **Production:** `nyyukbaodgzyvcccpojn` ✅ (this is the one your app uses)
- **NOT dev:** `vtnaqheddlvnlcgwwssc` ❌

## Step-by-Step: Create User Correctly

1. **Go to:** https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. **Navigate to:** Authentication → Users
3. **Click:** "Add user" → "Create new user"
4. **Fill in:**
   - Email: `jrsschroeder@gmail.com` (exact, no spaces)
   - Password: `YourSecurePassword123!` (remember this exactly!)
   - **✅ Auto Confirm Email:** Check this box!
5. **Click:** "Create user"
6. **Verify:** User appears in list with "Confirmed" status

## Test Login

1. Go to your app
2. Enter:
   - Email: `jrsschroeder@gmail.com` (exact match)
   - Password: The exact password you set (no extra spaces)
3. Click "Sign in"

## Still Not Working?

### Option 1: Delete and Recreate User

1. Go to Authentication → Users
2. Find `jrsschroeder@gmail.com`
3. Click on user → Delete
4. Create new user following Step-by-Step above

### Option 2: Use Password Reset

1. Go to Authentication → Users
2. Click on `jrsschroeder@gmail.com`
3. Click "Send password reset email"
4. Check your email and reset password
5. Try logging in with new password

### Option 3: Check Supabase Auth Settings

1. Go to Authentication → Settings
2. Check "Enable email confirmations"
   - If enabled, users must confirm email before login
   - Solution: Either disable this OR ensure "Auto Confirm Email" is checked when creating users

## Debug: Check User Details

Run this in Supabase SQL Editor to see full user details:

```sql
SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ Cannot login - email not confirmed'
    WHEN encrypted_password IS NULL THEN '❌ Cannot login - no password set'
    ELSE '✅ Should be able to login'
  END as login_status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';
```

## Common Mistakes

1. ❌ Created user in dev project instead of production
2. ❌ Forgot to check "Auto Confirm Email"
3. ❌ Password has extra spaces (copy/paste)
4. ❌ Email has typo or different case
5. ❌ Email confirmation is required but not done

## Summary

Most common issue: **Email not confirmed** or **password mismatch**

Quick fix:
1. Go to Authentication → Users
2. Click on user
3. Check "Auto Confirm Email" if not confirmed
4. Reset password to a known value
5. Try logging in again

