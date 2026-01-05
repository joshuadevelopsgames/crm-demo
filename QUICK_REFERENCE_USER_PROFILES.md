# User Profile System - Quick Reference Card

## 🚨 Emergency Fixes

### Multiple Users Can't Login
```sql
-- Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql
```

### System Admin Can't Login
```sql
-- Run: FIX_SYSTEM_ADMIN_PROFILE.sql
```

### Specific User Can't Login
```sql
-- Run: FIX_CALEB_LOGIN.sql (replace email)
```

## 🔍 Health Check

### Weekly Check
```sql
-- Run: HEALTH_CHECK_USER_PROFILES.sql
-- Look for: ❌ FAIL or ⚠️ WARNING
```

## 📋 Scripts Quick Reference

| Issue | Script | When |
|-------|--------|------|
| All users | `ENSURE_ALL_USERS_HAVE_PROFILES.sql` | Initial setup, after migrations |
| System admin | `FIX_SYSTEM_ADMIN_PROFILE.sql` | Admin login issues |
| Specific user | `FIX_CALEB_LOGIN.sql` | Individual user issues |
| Check status | `HEALTH_CHECK_USER_PROFILES.sql` | Weekly, troubleshooting |
| Test system | `TEST_USER_PROFILE_SYSTEM.sql` | After changes |

## ✅ Health Check Results

- ✅ **PASS** = Working correctly
- ⚠️ **WARNING** = Fix soon
- ❌ **FAIL** = Fix immediately

## 🔧 Common Fixes

### Profile Missing
```sql
INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, '', 'user'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

### Role is NULL
```sql
UPDATE profiles 
SET role = CASE 
  WHEN email = 'jrsschroeder@gmail.com' THEN 'system_admin'
  ELSE 'user'
END
WHERE role IS NULL;
```

### Trigger Missing
```sql
-- Run: ENSURE_ALL_USERS_HAVE_PROFILES.sql
```

## 📊 Quick Status Check

```sql
SELECT 
  (SELECT COUNT(*) FROM auth.users) as users,
  (SELECT COUNT(*) FROM profiles) as profiles,
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)) as missing;
```

## 🎯 Maintenance Schedule

- **Weekly**: Run health check
- **After migrations**: Run health check
- **When issues reported**: Run health check, then fix script

## 📖 Full Documentation

See: `USER_PROFILE_SYSTEM_COMPLETE_GUIDE.md`

