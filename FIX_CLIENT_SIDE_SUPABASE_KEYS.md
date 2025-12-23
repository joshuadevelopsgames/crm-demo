# Fix: Supabase Client-Side Keys Not Configured

## The Problem

You're seeing this warning:
```
Supabase client-side keys not configured. Using API endpoints instead.
```

This means `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set in your Vercel environment variables.

**Impact:**
- Login falls back to demo mode (no real authentication)
- Profile can't be fetched from Supabase
- Admin role check can't work properly
- Permissions page won't be accessible

## The Solution

Add the client-side Supabase keys to your Vercel project.

### Step 1: Get Your Supabase Keys

1. Go to your Supabase Dashboard:
   - https://supabase.com/dashboard
   - Select your project

2. Go to **Settings** → **API**

3. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`) → This is `VITE_SUPABASE_URL`
   - **anon/public key** → This is `VITE_SUPABASE_ANON_KEY`

### Step 2: Add to Vercel

1. Go to Vercel Dashboard:
   - https://vercel.com/dashboard
   - Select your project (e.g., `lecrm-dev`)

2. Go to **Settings** → **Environment Variables**

3. Add these two variables:

   **Variable 1:**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** Your Supabase Project URL (e.g., `https://vtnaqheddlvnlcgwwssc.supabase.co`)
   - **Environments:** Select all (Production, Preview, Development)
   - Click **Save**

   **Variable 2:**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Your Supabase anon/public key
   - **Environments:** Select all (Production, Preview, Development)
   - Click **Save**

### Step 3: Redeploy

**Important:** After adding environment variables, you must redeploy:

1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. Wait for the deployment to complete

### Step 4: Verify

After redeploying, check the browser console:
- The warning should be gone
- Login should work with real Supabase authentication
- Profile should be fetched from the database
- Admin access should work for `jrsschroeder@gmail.com`

## Alternative: If You Don't Want Client-Side Supabase

If you prefer to use API endpoints only (without client-side Supabase), you'll need to modify the authentication flow. However, this is more complex and not recommended.

**Recommended:** Add the client-side keys as described above.

## Quick Check

To verify your keys are set in Vercel:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. You should see:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. If they're missing, add them and redeploy

