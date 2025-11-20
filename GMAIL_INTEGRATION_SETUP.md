# Gmail Integration Setup Guide

This guide will help you set up Gmail integration to automatically sync emails with your CRM and track client relationships.

## Overview

The Gmail integration allows you to:
- Automatically sync emails from Gmail to CRM interactions
- Track email communication with clients
- Link emails to contacts and accounts
- View email threads directly from the CRM
- Track relationship history and engagement

## Prerequisites

1. Google Cloud Project with Gmail API enabled
2. OAuth 2.0 credentials (Client ID)
3. Backend service to handle token exchange (for security)

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (or Internal for Google Workspace)
   - App name: LECRM
   - User support email: your email
   - Scopes: Add `https://www.googleapis.com/auth/gmail.readonly`
   - Save and continue
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: LECRM Gmail Integration
   - Authorized redirect URIs: 
     - `http://localhost:5173/gmail-callback` (development)
     - `https://yourdomain.com/gmail-callback` (production)
   - Click "Create"
5. Copy the **Client ID** (you'll need this)

### 3. Configure Environment Variables

Create a `.env` file in your project root:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

**Important**: For production, you'll need a backend service to securely handle token exchange. The client-side implementation is for development only.

### 4. Backend Service (Required for Production)

For security, token exchange should happen on your backend. Create API endpoints:

**`/api/gmail/token`** (POST)
- Receives authorization code
- Exchanges code for access/refresh tokens
- Returns tokens to frontend

**`/api/gmail/refresh`** (POST)
- Receives refresh token
- Gets new access token
- Returns new tokens

Example Node.js/Express implementation:

```javascript
// Backend endpoint example
app.post('/api/gmail/token', async (req, res) => {
  const { code, redirect_uri } = req.body;
  
  const { OAuth2Client } = require('google-auth-library');
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri
  );
  
  const { tokens } = await oauth2Client.getToken(code);
  res.json(tokens);
});
```

### 5. Using Gmail Integration

1. **Connect Gmail**:
   - Go to any Account Detail page
   - Click "Interactions" tab
   - Click "Connect Gmail" button
   - Authorize access in Google's OAuth screen
   - You'll be redirected back to the CRM

2. **Sync Emails**:
   - After connecting, click "Sync Now" to sync emails
   - Emails are matched to contacts/accounts automatically
   - Only emails matching CRM contacts are synced

3. **View Synced Emails**:
   - Synced emails appear in the Interactions timeline
   - Click "View in Gmail" to open the email thread
   - Email content, subject, and metadata are stored

## How Email Matching Works

1. **Exact Match**: Email address matches a contact's email exactly
2. **Domain Match**: Email domain matches an account name
3. **No Match**: Email is skipped (not synced)

## Data Stored

For each synced email, the CRM stores:
- Subject and body content
- Sender and recipient information
- Date and time
- Direction (inbound/outbound)
- Gmail thread ID and message ID
- Link to view in Gmail
- Tags extracted from content

## Privacy & Security

- Users authorize their own Gmail access
- Only emails matching CRM contacts are synced
- OAuth tokens are stored in browser localStorage (consider backend storage for production)
- Users can disconnect Gmail anytime
- All data stays within your CRM system

## Troubleshooting

**"Gmail integration not configured"**
- Check that `VITE_GOOGLE_CLIENT_ID` is set in `.env`
- Restart your development server after adding env variables

**"Failed to exchange code for token"**
- Ensure you have a backend service running
- Check that redirect URI matches exactly in Google Cloud Console
- Verify OAuth consent screen is configured

**"No emails syncing"**
- Check that contacts have email addresses in CRM
- Verify Gmail account has emails
- Check browser console for errors

**"Token expired"**
- Reconnect Gmail account
- Ensure refresh token is being stored
- Check backend refresh token endpoint

## Next Steps

- Set up automatic background sync (every X hours)
- Add email sentiment analysis
- Create relationship engagement dashboard
- Add email thread grouping
- Implement email search within CRM


