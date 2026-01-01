# Verify Vercel Environment Variables

## The Problem
Your deployed app is using:
- **URL**: `vtnaqheddlvnlcgwwssc` (dev project)
- **Key**: Likely for `nyyukbaodgzyvcccpojn` (production project)

**These don't match!**

## Quick Fix Steps

### Step 1: Check What's Actually Set in Vercel

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your **LECRM** project

2. **Go to Settings → Environment Variables**

3. **Check `VITE_SUPABASE_URL`:**
   - What value does it show?
   - Should be: `https://nyyukbaodgzyvcccpojn.supabase.co` (production)
   - If it shows `vtnaqheddlvnlcgwwssc`, that's the problem!

4. **Check `VITE_SUPABASE_ANON_KEY`:**
   - What value does it show?
   - Should match the production project

### Step 2: Update if Wrong

If `VITE_SUPABASE_URL` shows the dev project:

1. **Click Edit** on `VITE_SUPABASE_URL`
2. **Change to:** `https://nyyukbaodgzyvcccpojn.supabase.co`
3. **Make sure it's enabled for:** Production, Preview, Development
4. **Click Save**

### Step 3: Get Correct Anon Key

1. **Go to Supabase:**
   - https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn/settings/api

2. **Copy the anon/public key**

3. **Update in Vercel:**
   - Edit `VITE_SUPABASE_ANON_KEY`
   - Paste the production anon key
   - Make sure it's enabled for all environments
   - Click Save

### Step 4: Redeploy with Cache Clear

1. **Go to Deployments tab**
2. **Click "..." on latest deployment**
3. **Click "Redeploy"**
4. **✅ Check "Clear Build Cache"** (important!)
5. **Click "Redeploy"**

### Step 5: Verify After Deployment

After deployment completes:
1. Open your app
2. Open browser console (F12)
3. Look for:
   ```
   projectIdFromUrl: nyyukbaodgzyvcccpojn
   projectIdFromKey: nyyukbaodgzyvcccpojn
   keysMatch: true
   ```

If `keysMatch: true`, you're good! If `false`, the values still don't match.

## Common Issues

### Issue: URL shows dev project in Vercel
**Fix:** Update `VITE_SUPABASE_URL` to production URL

### Issue: Key is from different project
**Fix:** Get the anon key from the same project as your URL

### Issue: Values look correct but still not working
**Fix:** 
- Make sure you cleared build cache
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Check that env vars are enabled for **Production** environment

