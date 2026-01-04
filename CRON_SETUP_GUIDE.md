# Vercel Cron Job Setup Guide

## Overview
This guide walks you through setting up cron jobs for the notification refresh system in both dev and production Vercel projects.

**Important:** Cron jobs are automatically created from `vercel.json` - no manual creation needed in the dashboard!

## Prerequisites
- ✅ `vercel.json` already configured with cron schedule
- ✅ `CRON_SECRET` environment variable set in both projects
- ✅ `/api/cron/refresh-notifications` endpoint deployed

---

## How Vercel Cron Jobs Work

Vercel automatically creates cron jobs from your `vercel.json` configuration. When you deploy, Vercel reads the `crons` array and sets up the scheduled jobs automatically.

**Current `vercel.json` configuration:**
```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-notifications",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This means:
- ✅ Cron job is automatically created on deploy
- ✅ Runs every 5 minutes (`*/5 * * * *`)
- ✅ Calls `/api/cron/refresh-notifications` endpoint
- ✅ Vercel automatically adds `Authorization: Bearer ${CRON_SECRET}` header

---

## Step 1: Verify CRON_SECRET is Set in Dev Project

### 1.1 Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Click on your **`lecrm-dev`** project

### 1.2 Check Environment Variables
1. Click **Settings** → **Environment Variables**
2. Verify `CRON_SECRET` exists
3. If missing, add it:
   - **Key:** `CRON_SECRET`
   - **Value:** (your secret value)
   - **Environments:** ✅ Production ✅ Preview ✅ Development
   - Click **Save**
4. **Redeploy** the project after adding (Deployments → Redeploy)

---

## Step 2: Verify CRON_SECRET is Set in Production Project

### 2.1 Go to Production Project
1. In Vercel Dashboard, click on your **`lecrm`** (production) project

### 2.2 Check Environment Variables
1. Click **Settings** → **Environment Variables**
2. Verify `CRON_SECRET` exists
3. If missing, add it (same value as dev, or different for security)
4. **Redeploy** the project after adding

---

## Step 3: Deploy to Activate Cron Jobs

Once `vercel.json` has the cron configuration and `CRON_SECRET` is set:

1. **Deploy your code** (push to git or deploy manually)
2. **Vercel automatically creates the cron jobs** from `vercel.json`
3. **Cron jobs start running** immediately after deployment

**No manual creation needed** - it's all automatic from `vercel.json`!

---

## Step 4: How Vercel Sends CRON_SECRET

According to Vercel's documentation:
- **Vercel automatically adds CRON_SECRET to the Authorization header** as `Bearer ${CRON_SECRET}`
- This happens automatically on every cron invocation
- The endpoint code checks: `req.headers.authorization === 'Bearer ${CRON_SECRET}'`

**This is already configured in the code** - no additional setup needed!

---

## Step 5: Verify Cron Jobs Are Running

### 5.1 Check Function Logs
1. Go to **Deployments** tab in Vercel
2. Click on the latest deployment
3. Go to **Functions** tab
4. Find `/api/cron/refresh-notifications`
5. Wait ~5 minutes after deployment
6. Check logs for:
   ```
   🔄 Starting notification cache refresh...
   ✅ Calculated X at-risk accounts, Y neglected accounts, Z duplicate estimate groups
   ```

### 5.2 Check Cron Job Status
1. Go to **Settings** → **Cron Jobs** (or **Deployments** → **Cron Jobs**)
2. You should see your cron job listed:
   - **Path:** `/api/cron/refresh-notifications`
   - **Schedule:** `*/5 * * * *`
   - **Status:** Active
   - **Next Run:** (shows next scheduled time)
   - **Last Run:** (shows when it last ran)

**Note:** If you don't see a Cron Jobs section, the cron jobs are still active - they're managed automatically from `vercel.json`.

### 5.3 Test Manually (Optional)
You can test the endpoint manually (requires CRON_SECRET):

```bash
# For dev (replace YOUR_SECRET with actual CRON_SECRET value)
curl -X GET "https://lecrm-dev.vercel.app/api/cron/refresh-notifications" \
  -H "Authorization: Bearer YOUR_SECRET"

# For production
curl -X GET "https://lecrm.vercel.app/api/cron/refresh-notifications" \
  -H "Authorization: Bearer YOUR_SECRET"
```

**Note:** Vercel automatically adds this header when invoking cron jobs, so manual testing requires you to provide it.

---

## Troubleshooting

### Issue: Cron job not appearing in dashboard
**Solution:**
- Cron jobs are created automatically from `vercel.json` - they may not show in dashboard
- Verify `vercel.json` has the cron configuration
- Check function logs to see if cron is running
- Redeploy the project to ensure cron is activated
- Check that you're looking at the correct project (dev vs prod)

### Issue: Cron job not running
**Solution:**
- Check function logs for errors
- Verify CRON_SECRET is set (if using secret in path)
- Check that the endpoint path matches exactly
- Verify the schedule syntax is correct: `*/5 * * * *`

### Issue: 401 Unauthorized errors
**Solution:**
- Verify `CRON_SECRET` environment variable is set in Vercel
- Check that Vercel is sending it in Authorization header as `Bearer ${CRON_SECRET}`
- Verify the secret value matches between environment variable and what the code expects
- Check function logs for "Unauthorized cron request" messages

### Issue: Function timeout
**Solution:**
- The function might be taking too long
- Check Supabase query performance
- Consider optimizing the calculation logic
- Vercel functions have a 10-second timeout on Hobby plan, 60 seconds on Pro

---

## Schedule Reference

The current schedule `*/5 * * * *` means:
- **Every 5 minutes**
- Format: `minute hour day month weekday`

Other common schedules:
- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday at midnight

---

## Next Steps

After cron jobs are set up:

1. ✅ Run SQL migrations in Supabase:
   - `create_notification_cache_table.sql`
   - `create_duplicate_estimates_table.sql`

2. ✅ Monitor the first few runs:
   - Check logs for any errors
   - Verify cache is being populated
   - Confirm duplicate detection is working

3. ✅ Test the frontend:
   - Check Dashboard shows at-risk accounts
   - Verify duplicate warnings appear
   - Test real-time updates

---

## Summary

You should now have:
- ✅ Cron job in `lecrm-dev` project (runs every 5 minutes)
- ✅ Cron job in `lecrm` production project (runs every 5 minutes)
- ✅ CRON_SECRET set in both projects (as environment variable)
- ✅ Endpoint secured with Authorization header check (`Bearer ${CRON_SECRET}`)
- ✅ Vercel automatically adds CRON_SECRET to Authorization header on cron invocations

The cron jobs will automatically:
- Calculate at-risk accounts (with renewal detection)
- Calculate neglected accounts
- Detect duplicate estimates
- Update notification cache
- Create notifications for duplicates

