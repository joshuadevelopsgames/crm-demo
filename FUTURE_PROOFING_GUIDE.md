# Future-Proofing Guide: User Profiles System

This guide explains how to prevent and detect user profile issues before they affect users.

## 🎯 Goal

Ensure that **all users** (current and future) have profiles with correct roles, preventing login and permission issues.

## 🔍 Regular Health Checks

### Weekly Health Check

Run `HEALTH_CHECK_USER_PROFILES.sql` weekly to catch issues early:

1. **Go to**: Supabase Dashboard → SQL Editor
2. **Run**: `HEALTH_CHECK_USER_PROFILES.sql`
3. **Check for**: Any ❌ FAIL or ⚠️ WARNING messages
4. **Action**: If issues found, run the appropriate fix script

### What to Look For

- ✅ **PASS**: Everything is working correctly
- ⚠️ **WARNING**: Minor issues that should be fixed soon
- ❌ **FAIL**: Critical issues that need immediate attention

## 🛡️ Protection Mechanisms

### 1. Automatic Profile Creation (Trigger)

**How it works:**
- When a new user is created in `auth.users`, a trigger automatically creates a profile
- The trigger uses `SECURITY DEFINER` to bypass RLS restrictions
- The trigger sets the correct role (`user` by default, `system_admin` for jrsschroeder@gmail.com)

**What could break it:**
- Trigger gets dropped or disabled
- Trigger function gets modified incorrectly
- Database migration fails

**How to detect:**
- Check 8 in health check: "Recent users have profiles"
- If recent users don't have profiles, the trigger isn't working

**How to fix:**
- Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`

### 2. RLS Policies

**How it works:**
- RLS policies allow authenticated users to read all profiles
- Users can insert their own profile (fallback if trigger fails)
- Users can update profiles

**What could break it:**
- Policies get dropped or modified
- New restrictive policies get added
- Database migration changes policies

**How to detect:**
- Check 3 in health check: "RLS policies are correct"

**How to fix:**
- Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`

### 3. UserContext Fallback

**How it works:**
- If profile doesn't exist, UserContext tries to create it
- If creation fails, it uses an in-memory profile (temporary)
- This is a safety net, but not a permanent solution

**What could break it:**
- RLS blocks the insert
- Database connection issues
- Profile creation fails silently

**How to detect:**
- Users report login issues
- Check 4 in health check: "Users without profiles"

**How to fix:**
- Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql` to backfill profiles
- Fix RLS policies if they're blocking inserts

## 📋 Maintenance Checklist

### Monthly

- [ ] Run `HEALTH_CHECK_USER_PROFILES.sql`
- [ ] Review any warnings or failures
- [ ] Check if any new users were created
- [ ] Verify all new users have profiles

### After Database Migrations

- [ ] Run `HEALTH_CHECK_USER_PROFILES.sql`
- [ ] Verify trigger still exists (Check 1)
- [ ] Verify RLS policies are correct (Check 3)
- [ ] Test creating a new user (if possible)

### When Users Report Login Issues

1. **Immediate**: Run `HEALTH_CHECK_USER_PROFILES.sql`
2. **Check**: Which check failed?
3. **Fix**: Run appropriate script:
   - General issues: `ENSURE_ALL_USERS_HAVE_PROFILES.sql`
   - System admin: `FIX_SYSTEM_ADMIN_PROFILE.sql`
   - Specific user: Check if profile exists, create if missing

## 🚨 Red Flags (Immediate Action Required)

These indicate critical issues that need immediate attention:

1. **Recent users missing profiles** (Check 8)
   - Means trigger is NOT working
   - New users will have login issues
   - **Action**: Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql` immediately

2. **Trigger is missing** (Check 1)
   - No automatic profile creation
   - **Action**: Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql` immediately

3. **RLS policies missing** (Check 3)
   - Users can't read/create profiles
   - **Action**: Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql` immediately

## 🔧 Fix Scripts Reference

### `ENSURE_ALL_USERS_HAVE_PROFILES.sql`
**When to use:**
- Regular maintenance
- After database migrations
- When health check shows issues
- To backfill profiles for existing users

**What it does:**
- Updates trigger function
- Ensures trigger exists
- Fixes RLS policies
- Backfills profiles for existing users
- Sets roles for all profiles

### `FIX_SYSTEM_ADMIN_PROFILE.sql`
**When to use:**
- System admin (jrsschroeder@gmail.com) has login issues
- System admin shows `isAdmin: false`

**What it does:**
- Fixes system admin profile specifically
- Sets role to `system_admin`
- Updates trigger for future users
- Fixes RLS policies

### `FIX_CALEB_LOGIN.sql`
**When to use:**
- Specific user (caleb@lecm.ca) can't login
- Template for fixing other user login issues

**What it does:**
- Checks if user exists
- Creates/updates profile
- Verifies email confirmation

## 🧪 Testing the System

### Test New User Creation

1. Create a test user in Supabase Dashboard
2. Wait 1-2 seconds
3. Run this query:
```sql
SELECT 
  au.email,
  p.id IS NOT NULL as has_profile,
  p.role
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'test@example.com';  -- Replace with test email
```

**Expected result:**
- `has_profile` should be `true`
- `role` should be `user`

**If it fails:**
- Trigger isn't working
- Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`

## 📊 Monitoring Dashboard Query

Run this monthly to get a quick overview:

```sql
SELECT 
  'Total Users' as metric,
  COUNT(*)::text as value
FROM auth.users
UNION ALL
SELECT 
  'Users with Profiles',
  COUNT(*)::text
FROM profiles
UNION ALL
SELECT 
  'Users Missing Profiles',
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles))::text
UNION ALL
SELECT 
  'Profiles Missing Roles',
  COUNT(*)::text
FROM profiles
WHERE role IS NULL
UNION ALL
SELECT 
  'Recent Users Missing Profiles (7 days)',
  (SELECT COUNT(*) FROM auth.users 
   WHERE created_at > NOW() - INTERVAL '7 days' 
   AND id NOT IN (SELECT id FROM profiles))::text;
```

## 🔄 Automated Monitoring (Future Enhancement)

Consider setting up:
1. **Scheduled SQL job** (Supabase Cron) to run health check weekly
2. **Alert system** to notify when issues are detected
3. **Dashboard** showing user profile statistics

## 📝 Best Practices

1. **Always run health check after migrations**
2. **Document any manual profile fixes**
3. **Test trigger after any database changes**
4. **Keep fix scripts up-to-date**
5. **Monitor recent user creation** (Check 8)

## 🆘 Emergency Response

If multiple users report login issues:

1. **Run health check** to identify scope
2. **Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`** to fix all users
3. **Verify** with health check again
4. **Notify users** to try logging in again

## 📚 Related Files

- `HEALTH_CHECK_USER_PROFILES.sql` - Health check script
- `ENSURE_ALL_USERS_HAVE_PROFILES.sql` - Comprehensive fix script
- `FIX_SYSTEM_ADMIN_PROFILE.sql` - System admin specific fix
- `FIX_CALEB_LOGIN.sql` - Template for fixing individual users

