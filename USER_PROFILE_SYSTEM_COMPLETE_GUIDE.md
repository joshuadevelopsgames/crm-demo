# User Profile System - Complete Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Purpose:** Complete reference guide for the user profile system, including all scripts, troubleshooting, and maintenance procedures.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Scripts Reference](#scripts-reference)
4. [Quick Start Guide](#quick-start-guide)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Complete Scripts](#complete-scripts)
8. [Health Check Procedures](#health-check-procedures)

---

## 🎯 System Overview

The user profile system ensures that every user in the application has a corresponding profile record with the correct role and permissions. This system prevents login issues and ensures proper access control.

### Key Components

1. **Profiles Table** - Stores user profile information (id, email, full_name, role)
2. **Trigger Function** - Automatically creates profiles when users are created
3. **RLS Policies** - Control access to profiles
4. **UserContext** - Frontend component that fetches and manages user profiles
5. **Health Check System** - Monitors system health and detects issues

### Roles

- **`system_admin`** - Full access, cannot be deleted (jrsschroeder@gmail.com)
- **`admin`** - Full access, can manage users
- **`user`** - Standard access, limited permissions

---

## 🏗️ Architecture

### Profile Creation Flow

```
New User Created (auth.users)
    ↓
Trigger Fires (on_auth_user_created)
    ↓
handle_new_user() Function Executes
    ↓
Profile Created in profiles table
    ↓
Role Assigned (user by default, system_admin for jrsschroeder@gmail.com)
```

### Fallback Mechanism

If trigger fails:
1. UserContext detects missing profile
2. Attempts to create profile via API
3. If that fails, uses in-memory profile (temporary)
4. Health check detects issue for admin resolution

### RLS Policy Structure

- **SELECT**: All authenticated users can read all profiles
- **UPDATE**: All authenticated users can update profiles
- **INSERT**: Users can insert their own profile (fallback)

---

## 📜 Scripts Reference

### Primary Scripts

| Script | Purpose | When to Use |
|--------|---------|------------|
| `ENSURE_ALL_USERS_HAVE_PROFILES.sql` | Comprehensive fix for all users | Initial setup, after migrations, when issues detected |
| `HEALTH_CHECK_USER_PROFILES.sql` | System health monitoring | Weekly checks, after changes, troubleshooting |
| `FIX_SYSTEM_ADMIN_PROFILE.sql` | Fix system admin specifically | System admin login issues |
| `FIX_CALEB_LOGIN.sql` | Template for fixing individual users | Specific user login issues |
| `TEST_USER_PROFILE_SYSTEM.sql` | Test system functionality | After setup, after changes |

### Supporting Scripts

| Script | Purpose |
|--------|---------|
| `FIX_PROFILES_RLS_SEE_ALL_USERS.sql` | Fix RLS policies only |
| `FIX_PROFILE_TRIGGER.sql` | Update trigger function only |

---

## 🚀 Quick Start Guide

### Initial Setup

1. **Run the comprehensive setup script:**
   ```sql
   -- Run in Supabase SQL Editor
   -- File: ENSURE_ALL_USERS_HAVE_PROFILES.sql
   ```

2. **Verify setup:**
   ```sql
   -- Run in Supabase SQL Editor
   -- File: HEALTH_CHECK_USER_PROFILES.sql
   ```

3. **Test the system:**
   ```sql
   -- Run in Supabase SQL Editor
   -- File: TEST_USER_PROFILE_SYSTEM.sql
   ```

### Weekly Maintenance

1. Run `HEALTH_CHECK_USER_PROFILES.sql`
2. Review results for any ❌ or ⚠️ warnings
3. If issues found, run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`

### When Users Report Login Issues

1. Run `HEALTH_CHECK_USER_PROFILES.sql` to identify the problem
2. If system admin: Run `FIX_SYSTEM_ADMIN_PROFILE.sql`
3. If specific user: Use `FIX_CALEB_LOGIN.sql` as template
4. If multiple users: Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`
5. Verify fix with health check

---

## 🔧 Troubleshooting

### Common Issues

#### Issue: User can't login, shows `isAdmin: false, hasProfile: false`

**Symptoms:**
- User is logged in but has no profile
- Admin features not accessible
- Console shows profile fetch errors

**Solution:**
1. Run `HEALTH_CHECK_USER_PROFILES.sql`
2. Check if user has profile: `SELECT * FROM profiles WHERE email = 'user@example.com';`
3. If no profile: Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`
4. If profile exists but wrong role: Update role manually or run fix script

#### Issue: New users don't get profiles automatically

**Symptoms:**
- Recent users missing profiles
- Health check shows "Recent users missing profiles"

**Solution:**
1. Check trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`
2. If missing: Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`
3. Verify trigger function: Check `handle_new_user()` exists

#### Issue: RLS blocking profile access

**Symptoms:**
- Profile exists but can't be read
- UserContext fallback to in-memory profile
- Console shows RLS policy errors

**Solution:**
1. Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql` (includes RLS fix)
2. Or run `FIX_PROFILES_RLS_SEE_ALL_USERS.sql` specifically

#### Issue: Profile exists but role is NULL

**Symptoms:**
- User has profile but `role` is NULL
- Permissions not working correctly

**Solution:**
```sql
UPDATE profiles 
SET role = CASE 
  WHEN email = 'jrsschroeder@gmail.com' THEN 'system_admin'
  ELSE 'user'
END
WHERE role IS NULL;
```

---

## 🔄 Maintenance Procedures

### Monthly Checklist

- [ ] Run `HEALTH_CHECK_USER_PROFILES.sql`
- [ ] Review any warnings or failures
- [ ] Check recent user creation (last 30 days)
- [ ] Verify all new users have profiles
- [ ] Review system admin profile status

### After Database Migrations

- [ ] Run `HEALTH_CHECK_USER_PROFILES.sql`
- [ ] Verify trigger still exists (Check 1)
- [ ] Verify RLS policies are correct (Check 3)
- [ ] Test creating a new user (if possible)
- [ ] Run `TEST_USER_PROFILE_SYSTEM.sql`

### Emergency Response

If multiple users report login issues:

1. **Immediate**: Run `HEALTH_CHECK_USER_PROFILES.sql`
2. **Identify**: Which check failed?
3. **Fix**: Run `ENSURE_ALL_USERS_HAVE_PROFILES.sql`
4. **Verify**: Run health check again
5. **Notify**: Ask users to try logging in again

---

## 📊 Health Check Procedures

### Running Health Checks

1. **Go to**: Supabase Dashboard → SQL Editor
2. **Run**: `HEALTH_CHECK_USER_PROFILES.sql`
3. **Review**: Check for ❌ FAIL or ⚠️ WARNING messages
4. **Action**: If issues found, run appropriate fix script

### Understanding Results

- ✅ **PASS**: Everything working correctly
- ⚠️ **WARNING**: Minor issues that should be fixed soon
- ❌ **FAIL**: Critical issues requiring immediate attention

### Key Checks

1. **Trigger Status** - Ensures automatic profile creation works
2. **Trigger Function** - Verifies function exists and is correct
3. **RLS Policies** - Confirms access policies are set up
4. **Users Without Profiles** - Detects missing profiles
5. **Profiles Without Roles** - Finds profiles with NULL roles
6. **System Admin Role** - Verifies system admin is configured
7. **Role Constraint** - Checks database constraints
8. **Recent Users** - **CRITICAL**: Detects if trigger stopped working

---

## 📝 Complete Scripts

The following sections contain the complete scripts. Copy and paste into Supabase SQL Editor to use.

---

## Script 1: ENSURE_ALL_USERS_HAVE_PROFILES.sql

**Purpose:** Comprehensive fix for all users - ensures trigger is set up, RLS policies are correct, and all existing users have profiles.

**When to Use:**
- Initial setup
- After database migrations
- When health check shows issues
- To backfill profiles for existing users

```sql
-- Ensure All Users Have Profiles (Current and Future)
-- This script ensures the trigger is properly configured and all existing users have profiles
-- Run this in Supabase SQL Editor to prevent future login issues

-- ============================================
-- PART 1: Ensure role column exists and allows all roles
-- ============================================
SELECT 
  'PART 1: Ensuring role column exists' as section,
  '' as detail;

-- Add role column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Drop old constraint if it doesn't include all roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' 
    AND constraint_name LIKE '%role%check%'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  END IF;
END $$;

-- Add constraint that includes all three roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'user', 'system_admin'));

-- ============================================
-- PART 2: Fix RLS policies to allow proper access
-- ============================================
SELECT 
  'PART 2: Fixing RLS policies' as section,
  '' as detail;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_select_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_insert_all_authenticated ON profiles;

-- Allow all authenticated users to READ all profiles
CREATE POLICY profiles_select_all_authenticated ON profiles
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to UPDATE all profiles
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow users to INSERT their own profile
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================
-- PART 3: Update trigger function to include role and system_admin logic
-- ============================================
SELECT 
  'PART 3: Updating trigger function' as section,
  '' as detail;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE 
      WHEN NEW.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE COALESCE(profiles.role, 'user')
    END,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 4: Ensure trigger exists and is active
-- ============================================
SELECT 
  'PART 4: Ensuring trigger exists' as section,
  '' as detail;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 5: Backfill profiles for existing users without profiles
-- ============================================
SELECT 
  'PART 5: Backfilling profiles for existing users' as section,
  '' as detail;

INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN 'system_admin'
    ELSE 'user'
  END
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = CASE 
    WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
    ELSE COALESCE(profiles.role, 'user')
  END,
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);

-- ============================================
-- PART 6: Ensure all existing profiles have a role
-- ============================================
SELECT 
  'PART 6: Ensuring all profiles have roles' as section,
  '' as detail;

UPDATE profiles 
SET role = CASE 
  WHEN email = 'jrsschroeder@gmail.com' THEN 'system_admin'
  ELSE 'user'
END
WHERE role IS NULL;

-- ============================================
-- PART 7: Verify the setup
-- ============================================
SELECT 
  'PART 7: Verification' as section,
  '' as detail;

-- Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  CASE 
    WHEN trigger_name = 'on_auth_user_created' THEN '✅ Trigger is active'
    ELSE '⚠️ Trigger not found'
  END as status
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check RLS policies
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' AND qual = 'true' THEN '✅ Allows reading all profiles'
    WHEN cmd = 'UPDATE' AND qual = 'true' THEN '✅ Allows updating all profiles'
    WHEN cmd = 'INSERT' THEN '✅ Allows inserting own profile'
    ELSE '⚠️ Check policy details'
  END as status
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check for users without profiles
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All users have profiles'
    ELSE '⚠️ ' || COUNT(*) || ' user(s) without profiles'
  END as users_without_profiles
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- Check for profiles without roles
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All profiles have roles'
    ELSE '⚠️ ' || COUNT(*) || ' profile(s) without roles'
  END as profiles_without_roles
FROM profiles
WHERE role IS NULL;

-- Summary of all users and their profiles
SELECT 
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  p.id IS NOT NULL as has_profile,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN '❌ No profile'
    WHEN p.role IS NULL THEN '⚠️ No role'
    WHEN au.email_confirmed_at IS NULL THEN '⚠️ Email not confirmed'
    ELSE '✅ OK'
  END as status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY 
  CASE 
    WHEN au.email = 'jrsschroeder@gmail.com' THEN 1
    WHEN p.role = 'admin' THEN 2
    WHEN p.role = 'system_admin' THEN 2
    ELSE 3
  END,
  au.email;

-- Final summary
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
     AND EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ All systems operational - Future users will get profiles automatically'
    ELSE '⚠️ Some issues detected - Review parts above'
  END as overall_status;
```

---

## Script 2: HEALTH_CHECK_USER_PROFILES.sql

**Purpose:** Comprehensive health check to detect issues before users are affected.

**When to Use:**
- Weekly maintenance
- After database migrations
- When troubleshooting
- Before major deployments

```sql
-- Health Check: User Profiles System
-- Run this periodically (weekly/monthly) to ensure the system is working correctly

-- ============================================
-- CHECK 1: Trigger exists and is active
-- ============================================
SELECT 
  'CHECK 1: Trigger Status' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ PASS: Trigger exists and is active'
    ELSE '❌ FAIL: Trigger is missing - New users will NOT get profiles!'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 2: Trigger function is up-to-date
-- ============================================
SELECT 
  'CHECK 2: Trigger Function' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user')
    THEN '✅ PASS: Trigger function exists'
    ELSE '❌ FAIL: Trigger function is missing!'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user')
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 3: RLS policies are correct
-- ============================================
SELECT 
  'CHECK 3: RLS Policies' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT')
    THEN '✅ PASS: RLS policies are configured correctly'
    ELSE '❌ FAIL: RLS policies are missing or incorrect'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE' AND qual = 'true')
     AND EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT')
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 4: All users have profiles
-- ============================================
SELECT 
  'CHECK 4: Users Without Profiles' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
    THEN '✅ PASS: All users have profiles'
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) <= 2
    THEN '⚠️ WARNING: ' || (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) || ' user(s) without profiles'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) || ' users without profiles'
  END as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
    THEN 'No action needed'
    ELSE 'Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql to backfill profiles'
  END as action_required;

-- Show which users are missing profiles
SELECT 
  'CHECK 4 Details: Users Missing Profiles' as check_name,
  au.email,
  au.created_at as user_created_at,
  '❌ Missing profile' as status
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM profiles)
ORDER BY au.created_at DESC;

-- ============================================
-- CHECK 5: All profiles have roles
-- ============================================
SELECT 
  'CHECK 5: Profiles Without Roles' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
    THEN '✅ PASS: All profiles have roles'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM profiles WHERE role IS NULL) || ' profile(s) without roles'
  END as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
    THEN 'No action needed'
    ELSE 'Run: UPDATE profiles SET role = ''user'' WHERE role IS NULL;'
  END as action_required;

-- ============================================
-- CHECK 6: System Admin has correct role
-- ============================================
SELECT 
  'CHECK 6: System Admin Role' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
    THEN '✅ PASS: System admin has correct role'
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    THEN '⚠️ WARNING: System admin exists but role is: ' || (SELECT role FROM profiles WHERE email = 'jrsschroeder@gmail.com')
    ELSE '❌ FAIL: System admin profile not found'
  END as status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
    THEN 'No action needed'
    ELSE 'Run: FIX_SYSTEM_ADMIN_PROFILE.sql to fix'
  END as action_required;

-- ============================================
-- CHECK 7: Role constraint includes all valid roles
-- ============================================
SELECT 
  'CHECK 7: Role Constraint' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.check_constraints 
      WHERE constraint_name LIKE '%role%check%' AND constraint_schema = 'public')
    THEN '✅ PASS: Role constraint exists'
    ELSE '⚠️ WARNING: Role constraint may be missing'
  END as status;

-- ============================================
-- CHECK 8: Recent users have profiles (last 7 days) - CRITICAL
-- ============================================
SELECT 
  'CHECK 8: Recent User Profiles' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) = 0
    THEN '✅ PASS: All recent users have profiles'
    ELSE '❌ FAIL: ' || (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) || ' recent user(s) missing profiles - Trigger may not be working!'
  END as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) = 0
    THEN 'No action needed'
    ELSE '⚠️ CRITICAL: Trigger is not working! Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql immediately'
  END as action_required;

-- Show recent users without profiles
SELECT 
  'CHECK 8 Details: Recent Users Missing Profiles' as check_name,
  au.email,
  au.created_at,
  EXTRACT(EPOCH FROM (NOW() - au.created_at))/86400 as days_ago,
  '❌ Missing profile - Trigger failed!' as status
FROM auth.users au
WHERE au.created_at > NOW() - INTERVAL '7 days'
  AND au.id NOT IN (SELECT id FROM profiles)
ORDER BY au.created_at DESC;

-- ============================================
-- SUMMARY: Overall Health Status
-- ============================================
SELECT 
  'SUMMARY: Overall System Health' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
     AND (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) = 0
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
     AND EXISTS(SELECT 1 FROM profiles WHERE email = 'jrsschroeder@gmail.com' AND role = 'system_admin')
     AND (SELECT COUNT(*) FROM auth.users 
          WHERE created_at > NOW() - INTERVAL '7 days' 
          AND id NOT IN (SELECT id FROM profiles)) = 0
    THEN '✅ HEALTHY: All systems operational'
    WHEN EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
     AND (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) <= 2
     AND (SELECT COUNT(*) FROM profiles WHERE role IS NULL) = 0
    THEN '⚠️ WARNING: Minor issues detected - Review checks above'
    ELSE '❌ CRITICAL: Major issues detected - Immediate action required!'
  END as status;

-- Statistics
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) as users_without_profiles,
  (SELECT COUNT(*) FROM profiles WHERE role = 'system_admin') as system_admins,
  (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as admins,
  (SELECT COUNT(*) FROM profiles WHERE role = 'user') as regular_users,
  (SELECT COUNT(*) FROM profiles WHERE role IS NULL) as profiles_without_roles;
```

---

## Script 3: FIX_SYSTEM_ADMIN_PROFILE.sql

**Purpose:** Fix system admin profile specifically and ensure trigger is updated for future users.

**When to Use:**
- System admin (jrsschroeder@gmail.com) has login issues
- System admin shows `isAdmin: false, hasProfile: false`

```sql
-- Fix System Admin Profile Issue
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Check current state
-- ============================================
SELECT 
  'PART 1: Current State Check' as section,
  '' as detail;

SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email = 'jrsschroeder@gmail.com' THEN '✅ System Admin user found'
    ELSE '⚠️ User found but email mismatch'
  END as status
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com';

-- ============================================
-- PART 2: Ensure role column exists and allows system_admin
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' 
    AND constraint_name LIKE '%role%check%'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'user', 'system_admin'));

-- ============================================
-- PART 3: Update trigger function for future users
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE 
      WHEN NEW.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE COALESCE(profiles.role, 'user')
    END,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 4: Fix RLS policies
-- ============================================
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_select_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_insert_all_authenticated ON profiles;

CREATE POLICY profiles_select_all_authenticated ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================
-- PART 5: Create or update System Admin profile
-- ============================================
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'System Admin'),
  'system_admin'
FROM auth.users
WHERE email = 'jrsschroeder@gmail.com'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = 'system_admin',
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name, 'System Admin');

-- ============================================
-- PART 6: Verify the fix
-- ============================================
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  au.email_confirmed_at,
  CASE 
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'system_admin' AND au.email_confirmed_at IS NOT NULL 
    THEN '✅ System Admin profile is correctly configured'
    WHEN p.email = 'jrsschroeder@gmail.com' AND p.role = 'system_admin' 
    THEN '✅ Profile exists with system_admin role'
    ELSE '⚠️ Check results above'
  END as status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.email = 'jrsschroeder@gmail.com';
```

---

## Script 4: FIX_CALEB_LOGIN.sql

**Purpose:** Template for fixing individual user login issues. Replace email as needed.

**When to Use:**
- Specific user can't login
- User profile is missing or incorrect

```sql
-- Fix login issue for caleb@lecm.ca
-- Template: Replace email as needed for other users

-- ============================================
-- PART 1: Check if user exists
-- ============================================
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email = 'caleb@lecm.ca' THEN 
      CASE 
        WHEN email_confirmed_at IS NOT NULL THEN '✅ User exists and email is confirmed'
        ELSE '⚠️ User exists but email is NOT confirmed'
      END
    ELSE '⚠️ User found but email mismatch'
  END as status
FROM auth.users
WHERE email = 'caleb@lecm.ca';

-- ============================================
-- PART 2: Ensure role column exists
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user', 'system_admin'));

-- ============================================
-- PART 3: Create or update profile
-- ============================================
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Caleb'),
  'user'
FROM auth.users
WHERE email = 'caleb@lecm.ca'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email, 
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name, 'Caleb'),
  role = COALESCE(profiles.role, 'user');

-- ============================================
-- PART 4: Verify
-- ============================================
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  au.email_confirmed_at,
  CASE 
    WHEN p.email = 'caleb@lecm.ca' AND au.email_confirmed_at IS NOT NULL THEN '✅ Account ready - User can login'
    WHEN p.email = 'caleb@lecm.ca' AND au.email_confirmed_at IS NULL THEN '⚠️ Email not confirmed'
    ELSE '❌ Profile not found'
  END as status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.email = 'caleb@lecm.ca';
```

---

## 📚 Additional Resources

### Related Files

- `FUTURE_PROOFING_GUIDE.md` - Detailed maintenance guide
- `TEST_USER_PROFILE_SYSTEM.sql` - System testing script
- `FIX_PROFILES_RLS_SEE_ALL_USERS.sql` - RLS policy fix only
- `FIX_PROFILE_TRIGGER.sql` - Trigger function update only

### Quick Reference

**Emergency Fix:**
```sql
-- Run ENSURE_ALL_USERS_HAVE_PROFILES.sql
```

**Check Status:**
```sql
-- Run HEALTH_CHECK_USER_PROFILES.sql
```

**Fix Specific User:**
```sql
-- Use FIX_CALEB_LOGIN.sql as template, replace email
```

---

## 🔗 Integration Points

### Frontend (UserContext.jsx)

The frontend UserContext component:
- Fetches profile from `profiles` table
- Falls back to creating profile if missing
- Uses in-memory profile as last resort
- Logs errors for debugging

### Database Schema

- **Table**: `profiles`
- **Trigger**: `on_auth_user_created`
- **Function**: `handle_new_user()`
- **Policies**: RLS policies for SELECT, UPDATE, INSERT

---

## 📞 Support

If issues persist after running scripts:

1. Check Supabase logs for errors
2. Verify environment variables are set
3. Check browser console for frontend errors
4. Review UserContext logs for profile fetch issues

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** Development Team

