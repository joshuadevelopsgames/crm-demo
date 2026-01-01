# Environment Variables Checklist

## Required for Local Development (.env file)

### Supabase (Client-Side - VITE_ prefix)
- [ ] `VITE_SUPABASE_URL` - Your Supabase project URL
  - Example: `https://nyyukbaodgzyvcccpojn.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
  - Get from: Supabase Dashboard → Settings → API → anon public key

### Supabase (Server-Side - for API routes)
- [ ] `SUPABASE_URL` - Same as VITE_SUPABASE_URL (without VITE_ prefix)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
  - Get from: Supabase Dashboard → Settings → API → service_role key
  - ⚠️ Keep this secret! Never commit to git!
- [ ] `SUPABASE_ANON_KEY` - Same as VITE_SUPABASE_ANON_KEY (for API token verification)
  - Same value as VITE_SUPABASE_ANON_KEY

### Bug Report Feature (Optional)
- [ ] `BUG_REPORT_EMAIL` - Email to receive bug reports (defaults to jrsschroeder@gmail.com)
- [ ] `EMAIL_SERVICE` - Email service to use: 'resend', 'sendgrid', or 'smtp' (defaults to 'resend')

#### If using Resend:
- [ ] `RESEND_API_KEY` - Your Resend API key
- [ ] `RESEND_FROM_EMAIL` - Email address to send from (defaults to onboarding@resend.dev)

#### If using SendGrid:
- [ ] `SENDGRID_API_KEY` - Your SendGrid API key
- [ ] `SENDGRID_FROM_EMAIL` - Email address to send from

#### If using SMTP:
- [ ] `SMTP_HOST` - SMTP server hostname
- [ ] `SMTP_PORT` - SMTP port (usually 587 or 465)
- [ ] `SMTP_SECURE` - 'true' for SSL/TLS, 'false' for STARTTLS
- [ ] `SMTP_USER` - SMTP username
- [ ] `SMTP_PASS` - SMTP password
- [ ] `SMTP_FROM` - Email address to send from

### Google Services (Optional)
- [ ] `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID (for Google Sign-In)
- [ ] `VITE_GOOGLE_SHEETS_API_KEY` - Google Sheets API key (if using Google Sheets integration)

## Quick Check Command

Run this to see what's in your .env file (without showing values):
```bash
cat .env | grep -E "^[A-Z_]+=" | cut -d'=' -f1 | sort
```

## Required Minimum

**Absolute minimum for the app to work:**
1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_ANON_KEY`
3. `SUPABASE_URL` (same as above)
4. `SUPABASE_SERVICE_ROLE_KEY`
5. `SUPABASE_ANON_KEY` (same as VITE_SUPABASE_ANON_KEY)

**For profile updates to work:**
- All of the above, especially `SUPABASE_ANON_KEY` for API token verification

## Example .env File

```bash
# Supabase - Client Side
VITE_SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase - Server Side (API routes)
SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (same as VITE_SUPABASE_ANON_KEY)

# Bug Report Email (Optional)
BUG_REPORT_EMAIL=jrsschroeder@gmail.com
EMAIL_SERVICE=resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Google (Optional)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Most Likely Missing

Based on the profile update error, you're probably missing:
- [ ] `SUPABASE_ANON_KEY` - This is needed for API token verification

Even if you have `VITE_SUPABASE_ANON_KEY`, you also need `SUPABASE_ANON_KEY` (without VITE_ prefix) for the API routes to work.

