# Approval Gates Setup Guide

## 🎯 What You'll Have

With approval gates, you get **full control** over when code moves between environments:

```
1. Work locally → Push to dev (auto-saves)
2. Click "Approve" → Syncs dev → staging (deploys to lecrm-stg.vercel.app)
3. Click "Approve" → Syncs staging → production (deploys to lecrm.vercel.app)
```

**Every step requires your manual approval!** No accidental deployments.

---

## ⚙️ One-Time Setup (5 minutes)

### Step 1: Create a GitHub Personal Access Token

1. **Go to GitHub**: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. **Name it**: `LECRM Sync Token`
4. **Set expiration**: `No expiration` (or 1 year)
5. **Select scopes**:
   - ✅ `repo` (Full control of private repositories)
   - That's it! Just `repo` is needed
6. Click **"Generate token"** at the bottom
7. **COPY THE TOKEN** - You'll only see it once!
   - It looks like: `ghp_xxxxxxxxxxxxxxxxxxxx`

### Step 2: Add Token to All Three Repos

#### For LECRM-dev:
1. Go to: https://github.com/joshuadevelopsgames/LECRM-dev/settings/secrets/actions
2. Click **"New repository secret"**
3. **Name**: `SYNC_TOKEN`
4. **Value**: Paste your token
5. Click **"Add secret"**

#### For LECRM-staging:
1. Go to: https://github.com/joshuadevelopsgames/LECRM-staging/settings/secrets/actions
2. Click **"New repository secret"**
3. **Name**: `SYNC_TOKEN`
4. **Value**: Paste your token
5. Click **"Add secret"**

#### For LECRM (production):
1. Go to: https://github.com/joshuadevelopsgames/LECRM/settings/secrets/actions
2. Click **"New repository secret"**
3. **Name**: `SYNC_TOKEN`
4. **Value**: Paste your token
5. Click **"Add secret"**

---

## 🚀 How to Use Approval Gates

### Daily Workflow:

#### 1. Work Locally & Save to Dev
```bash
# Make your changes
git add .
git commit -m "Add new feature"
git push dev main
```
✅ **Your work is now backed up in the dev repo!**

---

#### 2. Deploy to Staging (Manual Approval)

When you're ready to test on staging:

1. **Go to**: https://github.com/joshuadevelopsgames/LECRM-dev/actions
2. Click **"Sync to Staging (Manual Approval)"** in the left sidebar
3. Click **"Run workflow"** button (top right)
4. **Type "yes"** in the confirmation box
5. Click green **"Run workflow"** button

**What happens:**
- ✅ Code copies from dev → staging repo
- ✅ Vercel auto-deploys to lecrm-stg.vercel.app
- 🧪 **Test your changes on staging!**

---

#### 3. Deploy to Production (Manual Approval)

When staging looks good and you're ready to go live:

1. **Go to**: https://github.com/joshuadevelopsgames/LECRM-staging/actions
2. Click **"Sync to Production (Manual Approval)"** in the left sidebar
3. Click **"Run workflow"** button (top right)
4. **Type "yes"** in the confirmation box
5. Click green **"Run workflow"** button

**What happens:**
- ✅ Code copies from staging → production repo
- ✅ Vercel auto-deploys to lecrm.vercel.app
- 🚀 **Your changes are now LIVE!**

---

## 📊 Visual Workflow

```
┌─────────────────┐
│  Your Computer  │
│  (Local Work)   │
└────────┬────────┘
         │ git push dev main
         ▼
┌─────────────────┐
│   LECRM-dev     │ ← All your work backed up here
│   (Dev Repo)    │
└────────┬────────┘
         │ Manual Approval Required
         │ (Click "Run workflow" on GitHub)
         ▼
┌─────────────────┐
│ LECRM-staging   │ → Deploys to lecrm-stg.vercel.app
│ (Staging Repo)  │
└────────┬────────┘
         │ Manual Approval Required
         │ (Click "Run workflow" on GitHub)
         ▼
┌─────────────────┐
│     LECRM       │ → Deploys to lecrm.vercel.app
│ (Production)    │
└─────────────────┘
```

---

## 🎓 Example: Adding a New Feature

### Day 1: Building the feature
```bash
# Work on feature
git add .
git commit -m "WIP: new customer dashboard"
git push dev main
```
✅ Backed up to dev

### Day 2: Continue working
```bash
# More work
git add .
git commit -m "Finish customer dashboard"
git push dev main
```
✅ Backed up to dev

### Day 3: Ready to test
1. Go to GitHub Actions on LECRM-dev
2. Run "Sync to Staging" workflow
3. Type "yes" to confirm
4. Visit lecrm-stg.vercel.app to test

### Day 4: Looks good, go live!
1. Go to GitHub Actions on LECRM-staging
2. Run "Sync to Production" workflow
3. Type "yes" to confirm
4. Visit lecrm.vercel.app - feature is live!

---

## 🔒 Safety Features

### 1. **Double Confirmation**
- Must type "yes" to deploy
- Prevents accidental clicks

### 2. **Separate Approvals**
- Dev → Staging (one approval)
- Staging → Production (separate approval)

### 3. **Full History**
- Every sync is logged in GitHub Actions
- Can see what was deployed and when

### 4. **Easy Rollback**
If something goes wrong:
```bash
# Find the last good commit
git log --oneline

# Rollback to that commit
git reset --hard abc123

# Push to dev
git push dev main --force

# Then approve to staging/production
```

---

## 💡 Quick Reference

### Push to dev (backup):
```bash
git add .
git commit -m "Your changes"
git push dev main
```

### Approve to staging:
1. https://github.com/joshuadevelopsgames/LECRM-dev/actions
2. "Sync to Staging (Manual Approval)"
3. "Run workflow" → Type "yes" → Run

### Approve to production:
1. https://github.com/joshuadevelopsgames/LECRM-staging/actions
2. "Sync to Production (Manual Approval)"
3. "Run workflow" → Type "yes" → Run

---

## 🆘 Troubleshooting

### "Error: SYNC_TOKEN not found"
- Make sure you added the secret to all three repos
- Secret name must be exactly: `SYNC_TOKEN`

### "Error: Failed to push"
- Check that your token has `repo` permissions
- Try regenerating the token if it expired

### Workflow doesn't appear
- Make sure the workflow files are pushed to each repo
- Check the `.github/workflows/` folder exists in the repo

### Need to re-sync immediately
- You can run the workflow multiple times
- No waiting period between syncs

---

## ✅ Current Status

- ✅ Workflow files created locally
- ⏳ Need to push workflows to repos (see below)
- ⏳ Need to add SYNC_TOKEN to all repos (see above)

---

## 📝 Next Steps

1. **Complete the setup above** (create token, add to repos)
2. **Push workflow files** to all repos (I'll do this next)
3. **Test the approval gates** with a small change
4. **Use it daily** - commit often to dev, approve when ready!

---

## 🎉 Benefits

- ✅ **Never lose work** - everything backed up in dev
- ✅ **Test before deploying** - staging environment
- ✅ **Full control** - manual approval for every step
- ✅ **No accidental deploys** - must type "yes" to confirm
- ✅ **Complete history** - see every deployment in GitHub
- ✅ **Easy rollback** - revert to any previous version

**You now have enterprise-level deployment control!** 🚀






















