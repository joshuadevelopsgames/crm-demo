# Trigger Vercel Deployment

## The Issue
Code was pushed to GitHub (`LECRM-dev` repo, commit `e492780`) but Vercel isn't automatically deploying.

## Quick Fix: Manual Deployment

### Option 1: Redeploy from Vercel Dashboard (Easiest)

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Find your project (should be `lecrm` or `lecrm-dev`)

2. **Check Which Repository It's Connected To:**
   - Click on your project
   - Go to **Settings** → **Git**
   - Verify it shows: `joshuadevelopsgames/LECRM` (production) or `joshuadevelopsgames/LECRM-dev` (dev)
   - **If it shows the wrong repo, that's the problem!**

3. **Trigger Manual Deployment:**
   - Go to **Deployments** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**
   - OR click **"Deploy"** button at the top to deploy latest from GitHub

### Option 2: Fix Git Connection

If Vercel is connected to the wrong repository:

1. **Go to Settings** → **Git**
2. **Disconnect** the current repository
3. **Connect Git Repository** again
4. Select: `joshuadevelopsgames/LECRM-dev` (for dev) or `joshuadevelopsgames/LECRM` (for production)
5. Select branch: `main`
6. Click **Save**
7. This should trigger an automatic deployment

### Option 3: Use Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Link to your project (if not already linked)
cd /Users/joshua/LECRM
vercel link

# Deploy to production
vercel --prod

# Or deploy to preview
vercel
```

## Verify the Push

The commit was successfully pushed:
- **Commit**: `e492780` - "Trigger deployment: sync dashboard order"
- **Repository**: `joshuadevelopsgames/LECRM-dev`
- **Branch**: `main`
- **Date**: Dec 31, 2025

You can verify on GitHub:
- https://github.com/joshuadevelopsgames/LECRM-dev/commits/main

## Why Auto-Deploy Might Not Work

Common reasons:
1. ❌ Vercel project is connected to wrong GitHub repository
2. ❌ GitHub webhook is disabled or broken
3. ❌ Deployments are paused in Vercel
4. ❌ Project settings need updating

## Check Deployment Status

After triggering deployment:
1. Go to **Deployments** tab in Vercel
2. You should see a new deployment starting
3. Wait 1-2 minutes for build to complete
4. Status should show "Ready" when done

