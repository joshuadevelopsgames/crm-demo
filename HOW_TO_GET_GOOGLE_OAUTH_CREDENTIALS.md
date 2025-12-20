# How to Get Google OAuth Client ID and Secret

Follow these steps to get your Google OAuth credentials:

## Step 1: Go to Google Cloud Console

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account

## Step 2: Create or Select a Project

1. Click the project dropdown at the top of the page
2. Either:
   - **Select an existing project** (if you have one)
   - **Click "New Project"** to create a new one
   - Enter a project name (e.g., "LECRM")
   - Click "Create"

## Step 3: Enable Google+ API (if needed)

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"People API"**
3. Click on it and click **"Enable"** (if not already enabled)

## Step 4: Create OAuth Credentials

1. In the left sidebar, go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**

## Step 5: Configure OAuth Consent Screen (First Time Only)

If this is your first time, you'll need to configure the consent screen:

1. You'll see a warning about configuring the consent screen - click **"CONFIGURE CONSENT SCREEN"**
2. Choose **"External"** (unless you have a Google Workspace account, then use "Internal")
3. Click **"CREATE"**
4. Fill in the required fields:
   - **App name**: LECRM (or your app name)
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Click **"SAVE AND CONTINUE"**
6. On the "Scopes" page, click **"SAVE AND CONTINUE"** (you can add scopes later if needed)
7. On the "Test users" page, click **"SAVE AND CONTINUE"** (you can add test users later)
8. Review and click **"BACK TO DASHBOARD"**

## Step 6: Create OAuth Client ID

1. Go back to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Select **"Web application"** as the application type
4. Give it a name (e.g., "LECRM Web Client")
5. **Authorized JavaScript origins** (add these):
   ```
   https://YOUR_SUPABASE_PROJECT.supabase.co
   https://YOUR_VERCEL_DOMAIN.vercel.app
   ```
   
   **How to find these:**
   
   **For Supabase URL:**
   - Go to your [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to **Settings** → **API**
   - Copy the **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - OR: Your Supabase project subdomain is in your project URL: `https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT`
     - Example: If your dashboard URL is `https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc`
     - Then your Supabase URL is: `https://vtnaqheddlvnlcgwwssc.supabase.co`
   
   **For Vercel URL:**
   - Go to your [Vercel Dashboard](https://vercel.com/dashboard)
   - Click on your project (e.g., "lecrm", "lecrm-dev", etc.)
   - Look at the top of the page - you'll see your deployment URL
   - It will look like: `https://lecrm.vercel.app` or `https://lecrm-dev.vercel.app`
   - OR: Go to **Settings** → **Domains** to see all your domains
   - Copy the domain (without the `https://` part, just the domain name)

6. **Authorized redirect URIs** (add these):
   ```
   https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback
   https://YOUR_VERCEL_DOMAIN.vercel.app/google-auth-callback
   ```
   Use the same domains you found above:
   - Replace `YOUR_SUPABASE_PROJECT` with your Supabase subdomain
   - Replace `YOUR_VERCEL_DOMAIN` with your Vercel domain

7. Click **"CREATE"**

## Step 7: Copy Your Credentials

After creating the OAuth client, you'll see a popup with:
- **Your Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
- **Your Client Secret** (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)

⚠️ **Important**: Copy these immediately! The Client Secret will only be shown once.

## Step 8: Add Credentials to Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **"Authentication"** → **"Providers"**
4. Find **"Google"** in the list
5. Toggle it **ON**
6. Enter your:
   - **Client ID** (from Step 7)
   - **Client Secret** (from Step 7)
7. Click **"Save"**

## Step 9: Add Credentials to Vercel (Optional - for custom OAuth flow)

If you need to use the credentials in your Vercel environment variables:

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **"Settings"** → **"Environment Variables"**
4. Add:
   - `VITE_GOOGLE_CLIENT_ID` = Your Client ID
   - `GOOGLE_CLIENT_SECRET` = Your Client Secret (only if needed for custom implementation)

## Quick Reference

- **Client ID**: Public identifier for your OAuth app
- **Client Secret**: Private key - keep it secure, never commit to git
- **Redirect URI**: Must match exactly what you configured in Google Cloud Console

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in Google Cloud Console **exactly matches** what Supabase expects
- The Supabase redirect URI is: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### "Invalid client" error
- Double-check that you copied the Client ID and Secret correctly
- Make sure there are no extra spaces or line breaks

### Can't find the Client Secret
- If you lost it, you'll need to create a new OAuth client
- Go to Credentials → Find your OAuth client → Click the edit icon → You can reset the secret

## Security Notes

- ⚠️ **Never commit** your Client Secret to git
- ⚠️ **Never expose** your Client Secret in client-side code
- ✅ The Client ID is safe to use in client-side code
- ✅ Supabase handles the OAuth flow securely on the server side


