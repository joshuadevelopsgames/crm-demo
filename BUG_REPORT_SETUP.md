# Bug Report Feature Setup

The bug report feature allows users to report issues directly from the application. It includes:
- A floating blue button with a bug icon in the bottom right corner
- Element selection to highlight problematic features
- Console log capture
- Email submission to the configured recipient

## Email Configuration

The bug report API endpoint (`/api/bug-report.js`) supports multiple email services. Configure one of the following:

### Option 1: Resend (Recommended for Vercel)

1. Sign up at [Resend](https://resend.com)
2. Get your API key
3. Set environment variables in Vercel:
   ```
   EMAIL_SERVICE=resend
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   BUG_REPORT_EMAIL=jrsschroeder@gmail.com
   ```

### Option 2: SendGrid

1. Sign up at [SendGrid](https://sendgrid.com)
2. Get your API key
3. Set environment variables in Vercel:
   ```
   EMAIL_SERVICE=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   BUG_REPORT_EMAIL=jrsschroeder@gmail.com
   ```

### Option 3: SMTP (Nodemailer)

1. Install nodemailer (if not already installed):
   ```bash
   npm install nodemailer
   ```

2. Set environment variables in Vercel:
   ```
   EMAIL_SERVICE=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=your-email@gmail.com
   BUG_REPORT_EMAIL=jrsschroeder@gmail.com
   ```

## Default Configuration

If no email service is configured, the API will default to sending to `jrsschroeder@gmail.com` and attempt to use Resend first, then fall back to SMTP if available.

## Testing

1. Click the blue bug icon in the bottom right corner
2. Click "Click to Select Feature" to highlight and select a problematic element
3. Fill in the description
4. Optionally provide your email
5. Click "Send Report"

The bug report will be sent to the configured email address with:
- User's description
- Selected element details (tag, ID, class, XPath, etc.)
- Console logs captured during the session
- Browser and environment information

