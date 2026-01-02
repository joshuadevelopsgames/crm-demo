# 🚨 Emergency Production Push Bypass

## Emergency Codeword

**`FLASH25`**

## How to Use

### Option 1: Emergency Script (Recommended)
```bash
./scripts/emergency-production-push.sh
```

This script will:
1. Ask you to type "EMERGENCY" to confirm
2. Ask for the codeword (hidden input)
3. Ask you to type "DEPLOY NOW" for final confirmation
4. Push directly to production

### Option 2: Manual Bypass
```bash
PRODUCTION_BYPASS=FLASH25 git push production main
```

## ⚠️ Important Notes

- **Only use in true emergencies** when the normal workflow cannot be used
- This bypasses all safety checks and workflow validation
- **Document why** you needed to use the emergency bypass
- The normal workflow is still the preferred method:
  1. `./scripts/push-to-dev.sh`
  2. `./scripts/sync-to-staging.sh`
  3. `./scripts/sync-to-production.sh`

## When to Use

✅ **Appropriate uses:**
- Critical security fix that needs immediate deployment
- Production is down and needs urgent fix
- Emergency rollback that can't wait for staging

❌ **Don't use for:**
- Regular feature deployments
- "I'm in a hurry" situations
- Skipping testing on staging
- Convenience

## Security

The codeword is stored in the git hook file, but:
- It's not in your git history (hook is in `.git/hooks/` which is not tracked)
- You must explicitly set the environment variable
- The emergency script adds multiple confirmation steps

---

**Remember:** The normal workflow exists for a reason - use the emergency bypass sparingly!

