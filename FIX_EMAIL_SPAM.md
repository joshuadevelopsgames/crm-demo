# Fix Email Spam Issues - Domain Verification Guide

## Problem
Emails are being sent but going to spam folders. This happens because:
1. Using `onboarding@resend.dev` (Resend's default domain) - not verified
2. Missing SPF, DKIM, and DMARC records
3. No domain verification

## Solution: Verify Your Domain in Resend

### Step 1: Add Domain to Resend

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click **"Add Domain"**
3. Enter your domain (e.g., `yourdomain.com`)
4. Click **"Add"**

### Step 2: Add DNS Records

Resend will provide you with DNS records to add. You need to add these to your domain's DNS settings:

#### Required Records:

1. **SPF Record** (TXT)
   - Name: `@` (or your domain root)
   - Value: `v=spf1 include:resend.com ~all`

2. **DKIM Records** (TXT)
   - Resend will provide 2-3 DKIM records
   - Add each one as a TXT record with the name and value provided

3. **DMARC Record** (TXT) - Optional but recommended
   - Name: `_dmarc`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`

### Step 3: Wait for Verification

- DNS changes can take 24-48 hours to propagate
- Check Resend dashboard - it will show "Verified" when ready
- You can use [MXToolbox](https://mxtoolbox.com/) to check if records are live

### Step 4: Update Vercel Environment Variables

Once your domain is verified, update these in Vercel:

1. Go to your Vercel project → Settings → Environment Variables
2. Set `RESEND_FROM_EMAIL` to your verified email:
   ```
   noreply@yourdomain.com
   ```
   Or with a name:
   ```
   LECRM Bug Reports <noreply@yourdomain.com>
   ```

3. (Optional) Set `RESEND_REPLY_TO` if you want replies to go to a different address:
   ```
   support@yourdomain.com
   ```

### Step 5: Test

1. Submit a bug report
2. Check your inbox (not spam)
3. If still in spam, check:
   - DNS records are properly set (use MXToolbox)
   - Domain is verified in Resend dashboard
   - You're using the verified domain email address

## Quick Fix (Temporary)

If you need emails working immediately while setting up domain verification:

1. Use a different email service (SendGrid, Mailgun, etc.)
2. Or use your existing email provider's SMTP settings
3. Update `EMAIL_SERVICE` in Vercel to `smtp` and configure SMTP variables

## Best Practices

1. **Always use a verified domain** - Never use `onboarding@resend.dev`
2. **Use a proper "from" name** - Format: `"App Name <noreply@domain.com>"`
3. **Set up DMARC** - Helps with deliverability
4. **Monitor bounce rates** - Check Resend dashboard regularly
5. **Warm up your domain** - Start with low volume, gradually increase

## Troubleshooting

### Emails still going to spam?

1. **Check DNS records**:
   ```bash
   # Check SPF
   dig TXT yourdomain.com | grep spf
   
   # Check DKIM
   dig TXT default._domainkey.yourdomain.com
   
   # Check DMARC
   dig TXT _dmarc.yourdomain.com
   ```

2. **Check Resend dashboard**:
   - Domain status should be "Verified"
   - Check bounce/complaint rates

3. **Test email deliverability**:
   - Use [Mail Tester](https://www.mail-tester.com/)
   - Send a test email and check the score

4. **Check email content**:
   - Avoid spam trigger words
   - Don't use all caps
   - Include proper HTML structure
   - Have a text version

## Current Configuration

The code now:
- ✅ Requires a verified domain (won't use `onboarding@resend.dev`)
- ✅ Uses proper HTML email formatting
- ✅ Includes proper email headers
- ✅ Uses "from" name format for better deliverability

Make sure to set `RESEND_FROM_EMAIL` in Vercel to your verified domain email!

