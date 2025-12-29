# Your Supabase Configuration

Based on your Supabase project URL, here are your specific configuration details:

## Your Supabase Project Details

- **Project Subdomain**: `vtnaqheddlvnlcgwwssc`
- **Supabase URL**: `https://vtnaqheddlvnlcgwwssc.supabase.co`
- **Project Dashboard**: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc

## Google OAuth Redirect URIs

When configuring Google OAuth in Google Cloud Console, use these **exact** redirect URIs:

### Authorized JavaScript Origins:
```
https://vtnaqheddlvnlcgwwssc.supabase.co
https://YOUR_VERCEL_DOMAIN.vercel.app
```
(Replace `YOUR_VERCEL_DOMAIN` with your actual Vercel domain)

### Authorized Redirect URIs:
```
https://vtnaqheddlvnlcgwwssc.supabase.co/auth/v1/callback
https://YOUR_VERCEL_DOMAIN.vercel.app/google-auth-callback
```
(Replace `YOUR_VERCEL_DOMAIN` with your actual Vercel domain)

## Environment Variables for Vercel

Add these to your Vercel project settings:

```
VITE_SUPABASE_URL=https://vtnaqheddlvnlcgwwssc.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_URL=https://vtnaqheddlvnlcgwwssc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## How to Get Your Supabase Keys

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc)
2. Click on **"Settings"** (gear icon in the left sidebar)
3. Click on **"API"**
4. You'll find:
   - **Project URL**: `https://vtnaqheddlvnlcgwwssc.supabase.co` (already have this)
   - **anon/public key**: Copy this for `VITE_SUPABASE_ANON_KEY`
   - **service_role key**: Copy this for `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## Next Steps

1. **Get your Supabase keys** (see above)
2. **Configure Google OAuth** in Google Cloud Console with the redirect URIs above
3. **Add Google provider in Supabase**:
   - Go to: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/auth/providers
   - Enable Google
   - Add your Google OAuth Client ID and Secret
4. **Run the database migration**:
   - Go to: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/sql/new
   - Copy and paste the contents of `add_profiles_table.sql`
   - Click "Run"

## Quick Links

- **Supabase Dashboard**: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc
- **Authentication Settings**: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/auth/providers
- **API Settings**: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/settings/api
- **SQL Editor**: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/sql/new









