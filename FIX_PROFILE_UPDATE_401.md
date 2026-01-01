# Fix Profile Update 401 Error

## The Problem
When trying to update your profile (full name, phone number), you get:
```
401 Unauthorized - Invalid token
```

## The Cause
The API endpoint was trying to verify user tokens using the service role key, which doesn't work. User tokens must be verified using the anon key.

## The Fix

### Step 1: Add SUPABASE_ANON_KEY to Vercel

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your **LECRM** project

2. **Go to Settings → Environment Variables**

3. **Add new variable:**
   - **Name:** `SUPABASE_ANON_KEY`
   - **Value:** Copy the same value as `VITE_SUPABASE_ANON_KEY` (the anon/public key from Supabase)
   - **Environments:** Check all (Production, Preview, Development)
   - **Click:** "Save"

### Step 2: Get the Anon Key

If you don't have it:
1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
   - Navigate to: **Settings → API**

2. **Copy the "anon public" key** (not the service_role key)

3. **Add it to Vercel** as `SUPABASE_ANON_KEY`

### Step 3: Redeploy

After adding the environment variable:
1. **Go to Deployments tab**
2. **Click "..." on latest deployment**
3. **Click "Redeploy"**
4. **✅ Check "Clear Build Cache"** (optional but recommended)
5. **Click "Redeploy"**

### Step 4: Test

After deployment:
1. Go to Settings page
2. Try updating your full name or phone number
3. Should work without 401 error!

## Why This Happened

- `VITE_SUPABASE_ANON_KEY` is only available during build time (for frontend)
- API functions need `SUPABASE_ANON_KEY` (without VITE_ prefix) for runtime
- The API needs the anon key to verify user tokens
- Service role key can't verify user tokens (only admin operations)

## Summary

Add `SUPABASE_ANON_KEY` to Vercel environment variables with the same value as `VITE_SUPABASE_ANON_KEY`, then redeploy.

