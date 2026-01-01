# Step-by-Step: Configure Email Service in Vercel

This guide will walk you through setting up Resend (recommended) for sending bug reports.

## Option 1: Resend (Easiest - Recommended)

### Step 1: Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Click **"Sign Up"** (top right)
3. Sign up with your email or GitHub account
4. Verify your email address

### Step 2: Get Your API Key

1. Once logged in, you'll be taken to the dashboard
2. Click on **"API Keys"** in the left sidebar
3. Click **"Create API Key"**
4. Give it a name (e.g., "LECRM Bug Reports")
5. Click **"Add"**
6. **Copy the API key** - it will start with `re_` (you won't be able to see it again!)

### Step 3: Set Up a Domain (Optional but Recommended)

For production, you should verify a domain. For testing, Resend provides a default domain:

1. Go to **"Domains"** in the left sidebar
2. For testing, you can use the default domain: `onboarding@resend.dev`
3. For production, click **"Add Domain"** and follow the DNS verification steps

### Step 4: Add Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **LECRM** project
3. Click on the **"Settings"** tab
4. Click on **"Environment Variables"** in the left sidebar
5. Add the following variables:

   **Variable 1:**
   - **Key:** `EMAIL_SERVICE`
   - **Value:** `resend`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

   **Variable 2:**
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_xxxxxxxxxxxxx` (paste your API key from Step 2)
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

   **Variable 3:**
   - **Key:** `RESEND_FROM_EMAIL`
   - **Value:** `onboarding@resend.dev` (or your verified domain email)
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

   **Variable 4:**
   - **Key:** `BUG_REPORT_EMAIL`
   - **Value:** `jrsschroeder@gmail.com`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

### Step 5: Redeploy Your Application

After adding environment variables, you need to redeploy:

1. In Vercel, go to the **"Deployments"** tab
2. Click the **"..."** menu on your latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger a new deployment

### Step 6: Test the Bug Report Feature

1. Go to your deployed application
2. Click the blue bug icon in the bottom right
3. Fill out a test bug report
4. Submit it
5. Check your email (`jrsschroeder@gmail.com`) for the bug report

---

## Option 2: Gmail SMTP (Alternative - Free)

If you prefer to use Gmail directly, you can use SMTP:

### Step 1: Generate Gmail App Password

1. Go to your Google Account: [https://myaccount.google.com](https://myaccount.google.com)
2. Click **"Security"** in the left sidebar
3. Under **"How you sign in to Google"**, click **"2-Step Verification"** (enable it if not already)
4. Scroll down and click **"App passwords"**
5. Select **"Mail"** and **"Other (Custom name)"**
6. Enter "LECRM Bug Reports" as the name
7. Click **"Generate"**
8. **Copy the 16-character password** (you'll need this)

### Step 2: Install Nodemailer

```bash
npm install nodemailer
```

### Step 3: Add Environment Variables in Vercel

Add these variables in Vercel (same process as Step 4 above):

```
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your-email@gmail.com
BUG_REPORT_EMAIL=jrsschroeder@gmail.com
```

### Step 4: Redeploy

Same as Step 5 above - redeploy your application.

---

## Troubleshooting

### Emails Not Sending?

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → **"Deployments"**
   - Click on the latest deployment
   - Click **"Functions"** tab
   - Look for errors in the `/api/bug-report` function

2. **Verify Environment Variables:**
   - Make sure all variables are set correctly
   - Check that they're enabled for the right environments (Production/Preview/Development)

3. **Check Resend Dashboard:**
   - Go to Resend → **"Logs"** to see if emails were attempted
   - Check for any error messages

4. **Test API Key:**
   - Make sure your Resend API key is correct and active
   - Check that you haven't exceeded Resend's free tier limits (100 emails/day)

### Resend Free Tier Limits

- **100 emails per day** on the free tier
- For production, consider upgrading or using a different service

---

## Quick Reference: Environment Variables Summary

For **Resend** (Recommended):
```
EMAIL_SERVICE=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
BUG_REPORT_EMAIL=jrsschroeder@gmail.com
```

For **Gmail SMTP**:
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

---

## Need Help?

If you run into issues:
1. Check the Vercel function logs
2. Verify all environment variables are set correctly
3. Make sure you've redeployed after adding variables
4. Test with a simple bug report first

