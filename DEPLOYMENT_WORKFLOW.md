# 🔒 Protected Deployment Workflow

## ⚠️ CRITICAL RULES FOR AI ASSISTANTS

1. **NEVER push directly to production** - `git push production main` is BLOCKED by git hook
2. **ALWAYS follow the workflow**: dev → staging → production
3. **Use wrapper scripts** - they enforce the workflow and provide safety checks
4. **Check status first** - use `./scripts/workflow-status.sh` to see current state

## 📋 Standard Workflow

### Step 1: Save to Dev (Always First)
```bash
git add .
git commit -m "Description of changes"
./scripts/push-to-dev.sh
```
✅ This backs up your work to the dev repository

### Step 2: Sync to Staging (When Ready to Test)
```bash
./scripts/sync-to-staging.sh
```
This will:
- Show you what changes will be synced
- Require typing "yes" to confirm
- Push dev → staging
- Trigger Vercel deployment to lecrm-stg.vercel.app

**OR** use GitHub Actions:
1. Go to: https://github.com/joshuadevelopsgames/LECRM-dev/actions
2. Click "Sync to Staging (Manual Approval)"
3. Click "Run workflow"
4. Type "yes" in the confirmation box
5. Click "Run workflow"

### Step 3: Sync to Production (After Staging Tests Pass)
```bash
./scripts/sync-to-production.sh
```
This will:
- Show you what changes will be deployed
- Require typing "DEPLOY" to confirm
- Verify staging matches dev
- Push staging → production
- Trigger Vercel deployment to lecrm.vercel.app

**OR** use GitHub Actions:
1. Go to: https://github.com/joshuadevelopsgames/LECRM-staging/actions
2. Click "Sync to Production (Manual Approval)"
3. Click "Run workflow"
4. Type "DEPLOY" in the confirmation box
5. Click "Run workflow"

## 🚫 What NOT to Do

❌ `git push production main` - **BLOCKED** by git pre-push hook (unless using emergency bypass)
❌ `git push staging main` - Use `./scripts/sync-to-staging.sh` instead
❌ Skip staging - Always test on staging first
❌ Push directly from local to production - Must go through staging (except emergencies)

## ✅ What TO Do

✅ `./scripts/push-to-dev.sh` - Safe dev push (your daily backup)
✅ `./scripts/sync-to-staging.sh` - Safe staging sync
✅ `./scripts/sync-to-production.sh` - Safe production deploy
✅ `./scripts/workflow-status.sh` - Check environment status
✅ `./scripts/check-migrations.sh` - Check SQL migration status

## 🔄 Complete Workflow Example

### Daily Development
```bash
# Work on feature
git add .
git commit -m "Add customer dashboard"
./scripts/push-to-dev.sh              # ← Backs up to dev

# Ready to test?
./scripts/sync-to-staging.sh          # ← Deploys to staging
# Test at lecrm-stg.vercel.app

# Looks good? 
./scripts/sync-to-production.sh       # ← Deploys to production (LIVE!)
```

### Checking Status
```bash
# See what's deployed where
./scripts/workflow-status.sh

# Check for SQL migrations needed
./scripts/check-migrations.sh
```

## 🗄️ Supabase Migrations

After syncing code, you may need to apply SQL migrations:

1. **Check for new migrations:**
   ```bash
   ./scripts/check-migrations.sh
   ```

2. **Apply to each environment:**
   - Dev: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/sql
   - Staging: https://supabase.com/dashboard/project/YOUR_STAGING_PROJECT/sql
   - Production: https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn/sql

3. **Follow migration order:**
   - Check `PRODUCTION_MIGRATION_ORDER.md` if it exists
   - Run migrations in the correct order

## 🔒 Safety Features

### Git Pre-Push Hook
- Blocks direct `git push production main`
- Shows helpful error message with correct workflow
- Cannot be bypassed accidentally

### Script Safety Checks
- Shows what will be synced before confirming
- Requires explicit confirmation ("yes" or "DEPLOY")
- Verifies staging matches dev before production deploy
- Prevents accidental deployments

### GitHub Actions Approval Gates
- Manual approval required for each sync
- Must type confirmation text
- Full audit trail in GitHub Actions

## 📊 Environment Overview

| Environment | GitHub Repo | Vercel Project | URL | Supabase Project |
|------------|-------------|----------------|-----|------------------|
| **Dev** | LECRM-dev | lecrm-dev | lecrm-dev.vercel.app | vtnaqheddlvnlcgwwssc |
| **Staging** | LECRM-staging | lecrm-stg | lecrm-stg.vercel.app | (your staging project) |
| **Production** | LECRM | lecrm | lecrm.vercel.app | nyyukbaodgzyvcccpojn |

## 🚨 Emergency Bypass

In true emergencies, you can bypass the production push block using the codeword:

### Option 1: Use the Emergency Script (Recommended)
```bash
./scripts/emergency-production-push.sh
```
This script will:
- Ask for multiple confirmations
- Require the emergency codeword
- Push directly to production

### Option 2: Manual Bypass
```bash
PRODUCTION_BYPASS=FLASH25 git push production main
```

**Emergency Codeword:** `FLASH25`

⚠️ **Use sparingly!** This bypasses all safety checks. Only use in true emergencies.

## 🆘 Troubleshooting

### "Direct pushes to production are blocked"
- This is intentional! Use `./scripts/sync-to-production.sh` instead
- The hook prevents accidental production deployments
- For emergencies, use `./scripts/emergency-production-push.sh`

### "Staging and dev are not in sync"
- Sync dev → staging first: `./scripts/sync-to-staging.sh`
- Or continue anyway if you know what you're doing

### Scripts not working
- Make sure scripts are executable: `chmod +x scripts/*.sh`
- Check you're in the project root directory

### GitHub Actions not appearing
- Make sure workflow files are pushed to the repo
- Check `.github/workflows/` directory exists
- Verify `SYNC_TOKEN` secret is set in repo settings

## 🎯 Quick Reference

```bash
# Daily backup
./scripts/push-to-dev.sh

# Deploy to staging
./scripts/sync-to-staging.sh

# Deploy to production
./scripts/sync-to-production.sh

# Check status
./scripts/workflow-status.sh

# Check migrations
./scripts/check-migrations.sh
```

## 📝 Notes for AI Assistants

When helping with deployments:
1. **Always check status first**: `./scripts/workflow-status.sh`
2. **Never suggest** `git push production main` directly
3. **Always use scripts** for syncing between environments
4. **Remind about SQL migrations** after code syncs
5. **Verify environment variables** are set in Vercel for each project

---

**Remember**: This workflow ensures code quality, prevents accidents, and maintains consistency across all environments! 🚀

