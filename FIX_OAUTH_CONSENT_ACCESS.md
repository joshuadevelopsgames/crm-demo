# Fix: OAuth Consent Screen Redirects to Sign-In

If accessing the OAuth consent screen redirects you to `https://console.cloud.google.com/auth/overview`, you need to sign in first.

## Solution 1: Sign In to Google Cloud Console

1. **Go to the auth page it redirected you to:**
   ```
   https://console.cloud.google.com/auth/overview?project=lecrm-478811
   ```

2. **Sign in with your Google account** (the one that has access to the project)

3. **After signing in, try the OAuth consent screen URL again:**
   ```
   https://console.cloud.google.com/apis/credentials/consent?project=lecrm-478811
   ```

## Solution 2: Sign In First, Then Navigate

1. **Go to Google Cloud Console home:**
   ```
   https://console.cloud.google.com/home?project=lecrm-478811
   ```

2. **Sign in if prompted**

3. **Once signed in, navigate to:**
   - **APIs & Services** → **OAuth consent screen**
   - Or use direct URL: `https://console.cloud.google.com/apis/credentials/consent?project=lecrm-478811`

## Solution 3: Use Incognito/Private Window

Sometimes browser cache/cookies cause issues:

1. **Open an incognito/private window**
2. **Go to:** `https://console.cloud.google.com/apis/credentials/consent?project=lecrm-478811`
3. **Sign in when prompted**
4. **This should work if it's a cache issue**

## Solution 4: Check You're Using the Right Account

Make sure you're signed in with the Google account that has access to project `lecrm-478811`:

1. **Check your account in the top right** of Google Cloud Console
2. **If wrong account, click it and switch accounts**
3. **Or sign out and sign in with the correct account**

## Solution 5: Clear Browser Cache

If signing in doesn't help:

1. **Clear cookies for `console.cloud.google.com`**
2. **Clear cache**
3. **Try again**

## Solution 6: Alternative Navigation Path

Once signed in, try this path:

1. **Go to:** `https://console.cloud.google.com/apis/credentials?project=lecrm-478811`
2. **Look for "OAuth consent screen" link at the top of the page**
3. **Or click "+ CREATE CREDENTIALS" → "OAuth client ID"**
4. **If consent screen isn't configured, you'll see a prompt to configure it**

## Quick Test

After signing in, try this sequence:

1. **Sign in at:** `https://console.cloud.google.com/auth/overview?project=lecrm-478811`
2. **Then go to:** `https://console.cloud.google.com/apis/credentials?project=lecrm-478811`
3. **Click "+ CREATE CREDENTIALS" → "OAuth client ID"**
4. **If you can select "Web application" → Consent screen is configured ✅**
5. **If you see "Configure consent screen" → Click it to create it**

## If It Still Redirects After Signing In

If you sign in but it still redirects to the auth page:

1. **Check your IAM permissions** - you need Owner or Editor role
2. **Try a different browser**
3. **Contact Google Support** - this might be a Google Cloud Console bug

## Most Likely Fix

**Just sign in first!** The redirect to `/auth/overview` means you're not authenticated. Once you sign in, the OAuth consent screen should be accessible.

