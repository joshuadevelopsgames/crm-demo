# Fix Dev Repo Deployment to Vercel

## Problem
The `LECRM-dev` GitHub repo is not automatically deploying to Vercel when you push changes.

## Quick Fix Steps

### Step 1: Check Vercel Project Connection

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Login to your account

2. **Find Your Dev Project:**
   - Look for a project named `lecrm-dev` or similar
   - If you don't see it, you need to create it (see Step 2)

3. **Check Git Integration:**
   - Click on the dev project
   - Go to **Settings** → **Git**
   - Verify it shows: `joshuadevelopsgames/LECRM-dev`
   - Check the **Production Branch** is set to `main`

### Step 2: Create Dev Project (If It Doesn't Exist)

If you don't have a dev project in Vercel:

1. **Create New Project:**
   - Click **"Add New..."** → **"Project"**
   - Click **"Import Git Repository"**
   - Search for: `joshuadevelopsgames/LECRM-dev`
   - Click **"Import"**

2. **Configure Settings:**
   - **Project Name**: `lecrm-dev`
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install --force`

3. **Add Environment Variables:**
   - Copy environment variables from your production project
   - Go to Settings → Environment Variables
   - Add all the same variables (SUPABASE_URL, etc.)

4. **Deploy:**
   - Click **"Deploy"**
   - Wait for build to complete

### Step 3: Fix Auto-Deploy (If Project Exists But Not Deploying)

1. **Check Deployment Status:**
   - Go to **Deployments** tab
   - Check if deployments are "Paused"
   - If paused, click **"Resume Deployments"**

2. **Reconnect Git Repository:**
   - Go to **Settings** → **Git**
   - Click **"Disconnect"**
   - Then click **"Connect Git Repository"**
   - Select `joshuadevelopsgames/LECRM-dev`
   - Select branch: `main`
   - Click **"Save"**

3. **Verify Webhook:**
   - In Settings → Git, check if webhook is active
   - If not, Vercel will create one automatically when you reconnect

### Step 4: Test the Connection

After fixing the connection:

1. **Make a test change:**
   ```bash
   echo "// Test deployment" >> src/App.jsx
   git add src/App.jsx
   git commit -m "Test: verify dev deployment"
   git push dev main
   ```

2. **Check Vercel Dashboard:**
   - Go to Deployments tab
   - You should see a new deployment starting within 30 seconds
   - Watch it build and deploy

3. **Verify Deployment:**
   - Once "Ready", visit your dev URL
   - Should be something like: `https://lecrm-dev-xxxxx.vercel.app`

## Common Issues

### Issue 1: "No deployments found"
**Solution:** The project might not be connected. Follow Step 2 to create it.

### Issue 2: "Deployments paused"
**Solution:** Go to Settings → Git → Resume Deployments

### Issue 3: "Build failing"
**Solution:** 
- Check build logs in Vercel
- Verify environment variables are set
- Check that `package.json` has correct build scripts

### Issue 4: "Webhook not receiving events"
**Solution:**
- Disconnect and reconnect the Git repository
- This will recreate the webhook

## Manual Deployment (Temporary Fix)

If auto-deploy still doesn't work, you can manually trigger:

1. **Via Vercel Dashboard:**
   - Go to Deployments tab
   - Click **"Deploy"** or **"Redeploy"**
   - Select branch: `main`
   - Click **"Deploy"**

2. **Via Vercel CLI:**
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

## Verify Your Setup

After fixing, verify:
- ✅ Dev project exists in Vercel
- ✅ Connected to `LECRM-dev` repo
- ✅ Production branch is `main`
- ✅ Auto-deploy is enabled (not paused)
- ✅ Environment variables are set
- ✅ Test push triggers deployment

## Your Dev URL

Once working, your dev site will be at:
- `https://lecrm-dev-xxxxx.vercel.app` (auto-generated)
- Or custom domain if you set one up
