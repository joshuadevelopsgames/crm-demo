# Fix "Invalid API key" Error

## The Problem
Your Supabase URL and anon key in Vercel don't match the same project.

## Quick Fix Steps

### Step 1: Verify Which Project You're Using

Based on your `.env` file, your anon key is for project: **`nyyukbaodgzyvcccpojn`** (production)

So you need to use:
- **URL**: `https://nyyukbaodgzyvcccpojn.supabase.co`
- **Anon Key**: The one from project `nyyukbaodgzyvcccpojn`

### Step 2: Get the Correct Keys from Supabase

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn/settings/api

2. **Copy these values:**
   - **Project URL**: `https://nyyukbaodgzyvcccpojn.supabase.co`
   - **anon/public key**: (starts with `eyJ...`)

### Step 3: Update Vercel Environment Variables

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your **LECRM** project

2. **Go to Settings → Environment Variables**

3. **Update/Create these variables:**

   **Variable 1: VITE_SUPABASE_URL**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** `https://nyyukbaodgzyvcccpojn.supabase.co`
   - **Environment:** ✅ Production, ✅ Preview, ✅ Development
   - Click **Save**

   **Variable 2: VITE_SUPABASE_ANON_KEY**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** (paste the anon key from Step 2)
   - **Environment:** ✅ Production, ✅ Preview, ✅ Development
   - Click **Save**

### Step 4: Verify They Match

**Important:** Both values must be from the **same project** (`nyyukbaodgzyvcccpojn`)

- ✅ URL contains: `nyyukbaodgzyvcccpojn`
- ✅ Anon key is from project: `nyyukbaodgzyvcccpojn`

### Step 5: Redeploy

1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
4. ✅ Check **"Clear Build Cache"**
5. Click **"Redeploy"**

### Step 6: Test

After redeployment completes:
1. Open your app
2. Open browser console (F12)
3. Look for:
   ```
   🔧 Supabase client initialization: { hasUrl: true, hasKey: true, ... }
   ✅ Creating Supabase client with provided keys
   ✅ Supabase client created successfully
   ```
4. Try logging in - should work now!

## How to Verify Keys Match

You can decode the JWT to check the project:

1. Go to https://jwt.io
2. Paste your anon key
3. Look at the payload - the `ref` field should be `nyyukbaodgzyvcccpojn`

If the `ref` doesn't match your URL, that's the problem!

## Common Mistakes

❌ **Wrong:** URL is for project A, key is for project B
✅ **Correct:** URL and key are both for the same project

❌ **Wrong:** Using dev project keys in production
✅ **Correct:** Using production project keys in production

❌ **Wrong:** Extra spaces or typos in the values
✅ **Correct:** Exact copy-paste from Supabase dashboard

