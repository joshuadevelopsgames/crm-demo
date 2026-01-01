# Fix "Invalid login credentials" Error

## ✅ Good News!
The error changed from "Invalid API key" to "Invalid login credentials", which means:
- ✅ Your Supabase URL and anon key are now correctly matched
- ✅ Supabase connection is working
- ❌ The user `jrsschroeder@gmail.com` doesn't exist in production, or the password is wrong

## Solution: Create User in Production Supabase

### Step 1: Go to Production Supabase Dashboard

1. **Open:** https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. **Navigate to:** Authentication → Users

### Step 2: Check if User Exists

Look for `jrsschroeder@gmail.com` in the users list.

**If the user exists:**
- Click on the user
- Click "Reset Password" or "Send Password Reset Email"
- Or manually set a new password

**If the user doesn't exist:**
- Continue to Step 3

### Step 3: Create the User

1. **Click:** "Add user" → "Create new user"
2. **Email:** `jrsschroeder@gmail.com`
3. **Password:** Set a secure password (remember this!)
4. **Auto Confirm Email:** ✅ Check this box (so email verification isn't required)
5. **Click:** "Create user"

### Step 4: Set Admin Role (Optional but Recommended)

After creating the user, run this SQL in the Supabase SQL Editor:

```sql
-- Ensure role column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Update profile to admin role
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jrsschroeder@gmail.com';

-- If profile doesn't exist yet, create it
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
  'admin'
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = 'jrsschroeder@gmail.com';
```

### Step 5: Test Login

1. Go back to your app
2. Try logging in with:
   - **Email:** `jrsschroeder@gmail.com`
   - **Password:** (the password you just set)

## Alternative: Reset Password if User Exists

If the user already exists but you don't know the password:

1. **Go to:** Supabase Dashboard → Authentication → Users
2. **Find:** `jrsschroeder@gmail.com`
3. **Click on the user**
4. **Click:** "Reset Password" or manually set a new password
5. **Try logging in again**

## Quick Check: Verify User Exists

Run this in Supabase SQL Editor to check:

```sql
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmed'
    ELSE '⚠️  Email not confirmed'
  END as status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';
```

If no rows are returned, the user doesn't exist and you need to create it (Step 3).

## Summary

The connection is working! You just need to:
1. Create the user in production Supabase (or reset password if exists)
2. Set admin role (optional)
3. Log in with the correct password

