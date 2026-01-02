# Gmail Token Security Migration

## Overview

Gmail OAuth tokens have been moved from insecure `localStorage` to secure server-side storage in Supabase. This prevents XSS attacks from stealing tokens.

## Security Improvements

### Before (Insecure)
- ❌ Tokens stored in `localStorage` (accessible to any JavaScript)
- ❌ Vulnerable to XSS attacks
- ❌ Tokens exposed in browser DevTools
- ❌ No encryption at rest

### After (Secure)
- ✅ Tokens stored in Supabase `gmail_integrations` table
- ✅ Encrypted at rest by Supabase
- ✅ Protected by Row Level Security (RLS)
- ✅ Tokens never exposed to frontend
- ✅ All Gmail API calls proxied through secure backend

## Migration Steps

### 1. Run Database Migration

Execute the SQL migration to create the `gmail_integrations` table:

```sql
-- Run: add_gmail_integrations_table.sql
```

This creates:
- `gmail_integrations` table with RLS policies
- One integration per user (enforced by UNIQUE constraint)
- Automatic token expiry tracking

### 2. Deploy API Endpoints

Two new API endpoints are required:

#### `/api/gmail/integration` (GET, POST, DELETE)
- **GET**: Check if Gmail is connected
- **POST**: Store/update Gmail tokens
- **DELETE**: Disconnect Gmail

#### `/api/gmail/proxy` (GET, POST)
- Proxies all Gmail API calls
- Tokens are retrieved server-side and never exposed
- Handles token refresh automatically

### 3. Update Frontend Code

The `gmailService.js` has been updated to:
- Store tokens via `/api/gmail/integration` endpoint
- Use `/api/gmail/proxy` for all Gmail API calls
- Never access tokens directly from localStorage

### 4. User Migration

**Existing users** will need to reconnect Gmail:
1. Old tokens in localStorage will be ignored
2. Users should disconnect and reconnect Gmail
3. New tokens will be stored securely on the server

## API Endpoints

### Store Gmail Token
```javascript
POST /api/gmail/integration
Headers: Authorization: Bearer <supabase_jwt>
Body: {
  access_token: "...",
  refresh_token: "...",
  expires_in: 3600
}
```

### Check Connection
```javascript
GET /api/gmail/integration
Headers: Authorization: Bearer <supabase_jwt>
Response: {
  success: true,
  connected: true,
  last_sync: "...",
  token_expiry: "..."
}
```

### Disconnect
```javascript
DELETE /api/gmail/integration
Headers: Authorization: Bearer <supabase_jwt>
```

### Proxy Gmail API Call
```javascript
GET /api/gmail/proxy?endpoint=users/me/messages&maxResults=50
Headers: Authorization: Bearer <supabase_jwt>
```

## Security Features

1. **Row Level Security (RLS)**: Users can only access their own tokens
2. **Server-Side Storage**: Tokens never leave the server
3. **Encrypted at Rest**: Supabase encrypts all data
4. **Token Proxy**: All Gmail API calls go through secure proxy
5. **Automatic Refresh**: Token refresh handled server-side

## What's Still in localStorage

Only non-sensitive metadata remains in localStorage:
- `gmail_last_sync`: Last sync timestamp (non-sensitive)

This could be moved to server if cross-device sync is needed.

## Testing

1. Connect Gmail → Token stored in Supabase
2. Check connection → Returns status from server
3. Fetch emails → Uses proxy endpoint
4. Disconnect → Token deleted from server

## Rollback Plan

If issues occur:
1. The old localStorage code paths are still present (commented)
2. Can temporarily revert to localStorage if needed
3. But **strongly recommend** keeping server-side storage for security

---

**Status**: ✅ Migration complete - Gmail tokens now stored securely on server

