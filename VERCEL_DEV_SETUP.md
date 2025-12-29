# Vercel Dev Project Setup Guide

## 🎯 Goal
Set up a separate **dev** Vercel project that deploys from `LECRM-dev` GitHub repo, keeping it separate from staging.

---

## 📋 Step-by-Step Setup

### Step 1: Create New Vercel Project for Dev

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Login to your account

2. **Create New Project:**
   - Click **"Add New..."** → **"Project"**
   - Click **"Import Git Repository"**
   - Search for: `joshuadevelopsgames/LECRM-dev`
   - Click **"Import"**

3. **Configure Project Settings:**
   - **Project Name**: `lecrm-dev` (or `lecrm-development`)
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install --force`
   - **Environment Variables**: Copy from staging project if needed

4. **Deploy:**
   - Click **"Deploy"**
   - Wait for build to complete (~1-2 minutes)

5. **Get Your Dev URL:**
   - After deployment, you'll get a URL like: `https://lecrm-dev-xxxxx.vercel.app`
   - Or you can set a custom domain: `lecrm-dev.vercel.app` (in project settings)

---

## 🔧 Step 2: Configure Git Integration

The project should automatically:
- ✅ Deploy on every push to `main` branch of `LECRM-dev` repo
- ✅ Create preview deployments for pull requests
- ✅ Show build logs and deployment status

**Verify it's working:**
1. Make a small change in your code
2. Push to dev repo: `git push dev main`
3. Check Vercel dashboard - should see new deployment starting automatically

---

## 📊 Your Three Vercel Projects

After setup, you'll have:

| Environment | GitHub Repo | Vercel Project | URL |
|------------|------------|---------------|-----|
| **Dev** | `LECRM-dev` | `lecrm-dev` | `lecrm-dev.vercel.app` |
| **Staging** | `LECRM-staging` | `lecrm-stg` | `lecrm-stg.vercel.app` |
| **Production** | `LECRM` | `lecrm` | `lecrm.vercel.app` |

---

## 🚀 Workflow After Setup

### Daily Development:
```bash
# Work locally
git add .
git commit -m "Your changes"
git push dev main
# → Auto-deploys to lecrm-dev.vercel.app
```

### When Ready to Test:
```bash
# Push to staging
git push staging main
# → Auto-deploys to lecrm-stg.vercel.app
```

### When Ready for Production:
```bash
# Push to production
git push production main
# → Auto-deploys to lecrm.vercel.app
```

---

## 🔍 Verify Setup

1. **Check Dev Project:**
   - Go to: https://vercel.com/dashboard
   - Find `lecrm-dev` project
   - Check "Settings" → "Git" → Should show `LECRM-dev` repo

2. **Test Auto-Deploy:**
   ```bash
   # Make a small change
   echo "// test" >> src/App.jsx
   git add .
   git commit -m "Test dev deployment"
   git push dev main
   ```
   - Check Vercel dashboard - should see deployment starting

3. **Check URLs:**
   - Dev: `https://lecrm-dev-xxxxx.vercel.app` (or custom domain)
   - Staging: `https://lecrm-stg.vercel.app`
   - Production: `https://lecrm.vercel.app`

---

## 🛠️ Troubleshooting

### If Auto-Deploy Doesn't Work:

1. **Check Git Integration:**
   - Vercel Dashboard → Project → Settings → Git
   - Verify repo is connected: `joshuadevelopsgames/LECRM-dev`
   - If not connected, click "Connect Git Repository"

2. **Check Build Settings:**
   - Settings → General
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install --force`

3. **Check Environment Variables:**
   - Settings → Environment Variables
   - Copy any needed vars from staging project

### If Project Already Exists:

If you see a project already linked:
1. Go to Vercel Dashboard
2. Find the project
3. Settings → General → Scroll down → "Delete Project"
4. Then create new one following Step 1

---

## ✅ Success Checklist

- [ ] Dev Vercel project created (`lecrm-dev`)
- [ ] Linked to `LECRM-dev` GitHub repo
- [ ] Build settings configured correctly
- [ ] First deployment successful
- [ ] Auto-deploy working (test with a push)
- [ ] Dev URL accessible and working

---

## 📝 Notes

- **Dev deployments** are for testing your latest work
- **Staging deployments** are for pre-production testing
- **Production deployments** are your live site

Keep them separate! 🎯













