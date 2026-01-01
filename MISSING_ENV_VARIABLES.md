# Missing Environment Variables in .env

## Current Variables (Found)
✅ `DEV_SUPABASE_SERVICE_ROLE_KEY`
✅ `DEV_SUPABASE_URL`
✅ `PROD_SUPABASE_SERVICE_ROLE_KEY`
✅ `PROD_SUPABASE_URL`

## Missing Variables (Required)

### For Client-Side (Frontend)
- [ ] `VITE_SUPABASE_URL` - Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key

### For Server-Side (API Routes)
- [ ] `SUPABASE_URL` - Supabase project URL (same as VITE_SUPABASE_URL)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `SUPABASE_ANON_KEY` - Supabase anon key (for API token verification)

## How to Fix

### Option 1: Use Production Values (Recommended)

Add these to your `.env` file:

```bash
# Client-Side (Frontend)
VITE_SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Server-Side (API Routes)
SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here (same as VITE_SUPABASE_ANON_KEY)
```

### Option 2: Use Your Existing Variables

If you want to use your `PROD_` or `DEV_` variables, you'll need to:
1. Either rename them in your code
2. Or add aliases in your `.env` file

**Quick fix - add aliases:**
```bash
# Add these lines to your .env file
SUPABASE_URL=${PROD_SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${PROD_SUPABASE_SERVICE_ROLE_KEY}
VITE_SUPABASE_URL=${PROD_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_ANON_KEY=your-anon-key-here
```

## Get Your Anon Key

1. Go to: https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. Navigate to: **Settings → API
3. Copy the **"anon public"** key (not service_role)
4. Use it for both `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`

## Why These Are Missing

The code expects specific variable names:
- `VITE_*` variables are for client-side (injected at build time)
- Variables without `VITE_` are for server-side API routes
- `SUPABASE_ANON_KEY` is specifically needed for the profile API to verify tokens

## After Adding

1. Save your `.env` file
2. Restart your dev server (`npm run dev`)
3. Try updating your profile again

