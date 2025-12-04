# Staging Environment Setup Guide

## Overview
You now have three environments for your LECRM project:

1. **Local Development** - Your workspace at `/Users/joshua/LECRM`
2. **Staging** - lecrm-stg.vercel.app (to be set up)
3. **Production** - lecrm.vercel.app (already deployed)

## ✅ Completed Setup

### 1. GitHub Repository
- **Repository**: https://github.com/joshuadevelopsgames/LECRM.git
- **Main Branch**: `main` (production)
- **Staging Branch**: `staging` (newly created)
- **Status**: ✅ All your latest work has been committed and pushed

### 2. Branch Strategy
- `main` branch → Deploys to **lecrm.vercel.app** (Production)
- `staging` branch → Will deploy to **lecrm-stg.vercel.app** (Staging)

## 🚀 Setting Up Staging Deployment on Vercel

### Step 1: Log into Vercel
1. Go to https://vercel.com
2. Sign in with your account

### Step 2: Add New Project (for Staging)
1. Click "Add New..." → "Project"
2. Import your GitHub repository: `joshuadevelopsgames/LECRM`
3. **Important**: Name it `lecrm-staging` or `lecrm-stg`

### Step 3: Configure the Staging Project
**Build & Development Settings:**
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install --force`

**Git Branch:**
- Under "Git", set the Production Branch to: `staging` (NOT main!)

**Environment Variables:**
- Copy any environment variables from your production site
- Make sure all the same variables are set

### Step 4: Deploy
1. Click "Deploy"
2. Your staging site will be available at a URL like:
   - `lecrm-stg.vercel.app` (if available)
   - Or `lecrm-staging.vercel.app`

### Step 5: Custom Domain (Optional)
1. In your staging project settings → Domains
2. Add custom domain: `lecrm-stg.vercel.app`

## 📋 Workflow Guide

### For Development Work:

1. **Make changes locally** in your workspace
2. **Test locally** with `npm run dev`
3. **Commit to staging** first:
   ```bash
   git checkout staging
   git add .
   git commit -m "Your changes"
   git push origin staging
   ```
4. **Test on staging**: Visit lecrm-stg.vercel.app
5. **Merge to production** when ready:
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```
6. **Production updates automatically**: lecrm.vercel.app

### Quick Commands:

```bash
# Switch to staging branch
git checkout staging

# Switch to main branch
git checkout main

# Save your current work (from any branch)
git add .
git commit -m "Description of changes"
git push

# Merge staging into main (when ready for production)
git checkout main
git merge staging
git push origin main
```

## 🔒 Safety Features

1. **All changes are saved**: Every commit is backed up to GitHub
2. **Test before production**: Always test on staging first
3. **Easy rollback**: Can revert to any previous commit if needed
4. **Branch protection**: Main and staging are separate

## 📝 Best Practices

1. **Always commit frequently**: Don't lose work!
2. **Use descriptive commit messages**: Help future you understand changes
3. **Test on staging first**: Catch issues before they hit production
4. **Keep staging and main in sync**: Regularly merge staging → main

## 🆘 Troubleshooting

### If Vercel deployment fails:
1. Check the build logs in Vercel dashboard
2. Verify environment variables are set
3. Try clearing cache: "Redeploy" → "Clear Cache and Deploy"

### If you accidentally commit to wrong branch:
```bash
# Move commit to correct branch
git log  # Find the commit hash
git checkout correct-branch
git cherry-pick <commit-hash>
```

### If you need to undo a commit:
```bash
# Undo last commit (keep changes)
git reset HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

## ✅ Current Status

- ✅ GitHub repo configured
- ✅ Main branch (production) ready
- ✅ Staging branch created and pushed
- ⏳ Vercel staging deployment (manual step required - see above)

## Next Steps

1. Follow "Setting Up Staging Deployment on Vercel" section above
2. Test a deployment to staging
3. Once confirmed working, you'll have a complete dev → staging → production pipeline!
