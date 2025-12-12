# Three Repository Workflow Guide

## ✅ Setup Complete!

You now have **three separate repositories** for complete organization and backup:

### 1. 🛠️ **LECRM-dev** (Development/Local)
- **Purpose**: All your daily work, experiments, and changes
- **URL**: https://github.com/joshuadevelopsgames/LECRM-dev
- **Use for**: Every commit you make while working locally

### 2. 🧪 **LECRM-staging** (Testing)
- **Purpose**: Test changes before going to production
- **URL**: https://github.com/joshuadevelopsgames/LECRM-staging
- **Vercel**: Will deploy to lecrm-stg.vercel.app (setup below)

### 3. 🚀 **LECRM** (Production)
- **Purpose**: Live production site
- **URL**: https://github.com/joshuadevelopsgames/LECRM
- **Vercel**: Already deployed to lecrm.vercel.app ✓

---

## 🔄 Your Daily Workflow

### Step 1: Work Locally & Save to Dev Repo
Every time you make changes:

```bash
# Save your work to dev repo (do this frequently!)
git add .
git commit -m "Description of what you changed"
git push dev main
```

**This is your safety net** - every change is backed up to the dev repo.

---

### Step 2: When Ready to Test → Push to Staging

```bash
# Push to staging for testing
git push staging main
```

This will:
- Update the staging repo
- Trigger a Vercel deployment to lecrm-stg.vercel.app
- Let you test before it goes live

---

### Step 3: When Everything Works → Push to Production

```bash
# Push to production (live site)
git push production main
```

This will:
- Update the production repo
- Trigger a deployment to lecrm.vercel.app
- Your changes are now live!

---

## 🎯 Quick Commands

### Save work (always do this first):
```bash
git add .
git commit -m "Your change description"
git push dev main
```

### Push everywhere at once (when you're confident):
```bash
git push dev main && git push staging main && git push production main
```

### Check which repos you have:
```bash
git remote -v
```

### See what changed:
```bash
git status
git diff
```

---

## 🆘 Emergency: Rollback Changes

### If you made a mistake in dev:
```bash
# See recent commits
git log --oneline

# Go back to a specific commit (replace abc123 with commit hash)
git reset --hard abc123

# Push the rollback
git push dev main --force
```

### If you need to rollback staging or production:
```bash
# Rollback staging
git reset --hard abc123
git push staging main --force

# Rollback production
git reset --hard abc123
git push production main --force
```

---

## 📊 Setting Up Vercel Deployments

### For Staging Repo:

1. **Go to Vercel**: https://vercel.com
2. **Add New Project**
3. **Import**: `joshuadevelopsgames/LECRM-staging`
4. **Project Name**: `lecrm-staging`
5. **Settings**:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install --force`
6. **Deploy**
7. **Add Custom Domain**: lecrm-stg.vercel.app (in project settings)

### For Dev Repo (Optional):

You can also deploy the dev repo to test deployments, or just keep it as a backup without deploying.

---

## 💡 Best Practices

### 1. **Commit Often to Dev**
Every 15-30 minutes of work, save to dev:
```bash
git add .
git commit -m "Work in progress"
git push dev main
```

### 2. **Test on Staging Before Production**
Never push directly to production without testing on staging first:
```bash
# Test on staging first
git push staging main
# Visit lecrm-stg.vercel.app and test
# If good, then push to production
git push production main
```

### 3. **Write Good Commit Messages**
Help future you understand what changed:
```bash
# Bad
git commit -m "fixed stuff"

# Good
git commit -m "Fix contact import dialog validation bug"
```

### 4. **Keep All Repos in Sync**
Your local workspace should always push to dev first, then staging, then production. Don't skip steps!

---

## 📝 Understanding Your Setup

```
Your Workspace (Local)
        ↓ (save frequently)
    DEV REPO ← Your backup/database
        ↓ (when ready to test)
  STAGING REPO → lecrm-stg.vercel.app
        ↓ (when tested and working)
PRODUCTION REPO → lecrm.vercel.app
```

---

## 🎓 Common Scenarios

### Scenario 1: Making a new feature
```bash
# Work locally, test with npm run dev
npm run dev

# Save to dev as you go
git add .
git commit -m "Add new feature: customer scoring"
git push dev main

# When feature is done, test on staging
git push staging main
# Test at lecrm-stg.vercel.app

# When staging looks good, go to production
git push production main
```

### Scenario 2: Quick bug fix
```bash
# Fix the bug locally
# Save to dev immediately
git add .
git commit -m "Fix: login button not working on mobile"
git push dev main

# Test on staging
git push staging main

# If good, push to production
git push production main
```

### Scenario 3: End of day backup
```bash
# Save everything before closing laptop
git add .
git commit -m "End of day: working on account details page"
git push dev main
```

---

## ✅ Current Status

- ✅ **Dev Repo**: Created and pushed
- ✅ **Staging Repo**: Created and pushed
- ✅ **Production Repo**: Already set up
- ✅ **Local Remotes**: All configured
- ⏳ **Vercel Staging**: Needs manual setup (see above)
- ✅ **Vercel Production**: Already deployed

---

## 🔗 Quick Links

- **Dev Repo**: https://github.com/joshuadevelopsgames/LECRM-dev
- **Staging Repo**: https://github.com/joshuadevelopsgames/LECRM-staging
- **Production Repo**: https://github.com/joshuadevelopsgames/LECRM
- **Staging Site**: lecrm-stg.vercel.app (after Vercel setup)
- **Production Site**: lecrm.vercel.app

---

## 🆘 Need Help?

If anything goes wrong:
1. Don't panic - everything is backed up in Git!
2. Check `git log` to see your commit history
3. You can always reset to a previous commit
4. All three repos have full history of every change

**Remember**: Git is your time machine and safety net. Commit often!













