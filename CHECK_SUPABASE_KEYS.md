# Check Your Supabase Keys Match

## The Problem
"Invalid API key" error means your Supabase URL and anon key don't match the same project.

## How to Verify

### Step 1: Check Your Current Configuration

Your `.env` file shows:
- **URL**: `https://vtnaqheddlvnlcgwwssc.supabase.co` (dev project)
- **Anon Key**: For project `nyyukbaodgzyvcccpojn` (production project)

**These don't match!** That's why you're getting the error.

### Step 2: Decide Which Project to Use

**Option A: Use Production** (Recommended for deployed app)
- Project: `nyyukbaodgzyvcccpojn`
- URL: `https://nyyukbaodgzyvcccpojn.supabase.co`
- Get anon key from: https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn/settings/api

**Option B: Use Dev**
- Project: `vtnaqheddlvnlcgwwssc`
- URL: `https://vtnaqheddlvnlcgwwssc.supabase.co`
- Get anon key from: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/settings/api

### Step 3: Get the Correct Anon Key

1. Go to your Supabase Dashboard
2. Select the project you want to use
3. Go to **Settings** → **API**
4. Find the **anon/public** key
5. Copy it

### Step 4: Update Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your LECRM project
3. Go to **Settings** → **Environment Variables**
4. Update these two variables:

   **VITE_SUPABASE_URL:**
   - Use the URL that matches your chosen project
   
   **VITE_SUPABASE_ANON_KEY:**
   - Use the anon key from the same project

5. Make sure both are enabled for **Production, Preview, and Development**
6. Click **Save**

### Step 5: Redeploy

1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
4. Check **"Clear Build Cache"**
5. Click **"Redeploy"**

### Step 6: Test

After redeployment:
1. Try logging in again
2. Check browser console (F12) for errors
3. Should see: `✅ Supabase client created successfully`

## How to Decode JWT to Check Project

Your anon key is a JWT token. You can decode it to see which project it's for:

1. Go to https://jwt.io
2. Paste your anon key
3. Look at the payload - the `ref` field shows the project ID

Example:
```json
{
  "iss": "supabase",
  "ref": "nyyukbaodgzyvcccpojn",  // ← This is the project ID
  "role": "anon",
  ...
}
```

The `ref` value must match the project ID in your URL!

