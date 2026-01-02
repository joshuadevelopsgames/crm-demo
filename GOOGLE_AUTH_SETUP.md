# Google Authentication Setup Guide

This guide will help you set up Google OAuth authentication using Supabase Auth.

## Prerequisites

1. A Supabase project (https://supabase.com)
2. A Google Cloud Console project with OAuth 2.0 credentials

## Step 1: Configure Google OAuth in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
   - `https://YOUR_VERCEL_DOMAIN.vercel.app/google-auth-callback` (for your app)
7. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Supabase Auth

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Google** provider
4. Enter your Google OAuth **Client ID** and **Client Secret**
5. Save the configuration

## Step 3: Set Environment Variables in Vercel

Add these environment variables in your Vercel project settings:

### Required Variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_URL` - Same as VITE_SUPABASE_URL (for server-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side API routes)

### Optional (if you want email/password auth):
- Email templates can be configured in Supabase Dashboard → Authentication → Email Templates

## Step 4: Run Database Migration

Run the `add_profiles_table.sql` migration in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `add_profiles_table.sql`
3. Run the query

This will:
- Create a `profiles` table to store additional user information
- Set up automatic profile creation when users sign up
- Configure Row Level Security (RLS) policies

## Step 5: Test the Authentication

1. Start your development server
2. Navigate to `/login`
3. Click "Sign in with Google"
4. Complete the OAuth flow
5. You should be redirected to the dashboard

## How It Works

1. **User clicks "Sign in with Google"** → Supabase redirects to Google OAuth
2. **User authorizes** → Google redirects back to Supabase
3. **Supabase creates user** → User is created in `auth.users` table
4. **Profile is created** → Trigger automatically creates a profile in `profiles` table
5. **Session is stored** → Supabase manages the session automatically
6. **User is redirected** → Back to your app at `/dashboard`

## Features

- ✅ Secure authentication using Supabase Auth
- ✅ Automatic user profile creation
- ✅ Session management (automatic refresh)
- ✅ Protected routes (redirects to login if not authenticated)
- ✅ Email/password authentication also supported
- ✅ Row Level Security (RLS) policies for data protection

## Troubleshooting

### "Authentication is not configured"
- Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in your `.env` file and Vercel

### "Redirect URI mismatch"
- Check that your redirect URI in Google Cloud Console matches exactly:
  - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`

### "No session found"
- Clear browser cookies and try again
- Check Supabase Dashboard → Authentication → Users to see if the user was created

### Users not appearing in profiles table
- Check that the trigger was created successfully
- Verify the `add_profiles_table.sql` migration ran without errors

## Security Notes

- Never expose your `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- The service role key should only be used in server-side API routes
- RLS policies ensure users can only access their own data
- Supabase automatically handles token refresh and session management











