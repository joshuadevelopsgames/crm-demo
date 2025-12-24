# How to Find Your Google Apps Script Web App URL

## Step-by-Step Instructions

### Step 1: Open Deployments

1. In your Google Apps Script editor
2. Click **"Deploy"** button (top right)
3. Click **"Manage deployments"**

### Step 2: Find Your Web App Deployment

You should see a list of deployments. Look for:
- **Type:** Web app
- **Description:** Something like "lecrm-database (version 3)" or similar

### Step 3: Copy the Web App URL

1. Click on the deployment (or click the **copy icon** 📋 next to it)
2. You'll see a URL that looks like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```
   OR
   ```
   https://script.google.com/macros/s/AKfycby.../dev
   ```
   (The `/exec` is for production, `/dev` is for test deployments)

3. **Copy the entire URL** - this is what you need!

### Step 4: Test the URL

Open the URL in a browser. You should see:
```json
{
  "success": true,
  "message": "LECRM Google Sheets Sync Web App is running",
  "security": {
    "authenticationConfigured": true,
    "note": "Authentication is enabled..."
  }
}
```

If you see this, the URL is correct! ✅

---

## Alternative: If You Don't See Deployments

If you don't have a deployment yet:

1. Click **"Deploy"** → **"New deployment"**
2. Click the **gear icon** ⚙️ next to "Select type"
3. Choose **"Web app"**
4. Configure:
   - **Description:** "LECRM Database Sync"
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Click **"Deploy"**
6. **Copy the Web App URL** that appears
7. Click **"Done"**

---

## What to Do With the URL

Once you have the URL:

1. **Add to Vercel Environment Variables:**
   - Go to each Vercel project (dev, staging, production)
   - Settings → Environment Variables
   - Add: `GOOGLE_SHEETS_WEB_APP_URL` = your URL
   - Save and redeploy

2. **Test it:**
   - Visit the URL in browser → Should show JSON response
   - Try importing data in your app → Should work

---

## Troubleshooting

### "I don't see a Web App deployment"

**Solution:** Create a new deployment (see "Alternative" section above)

### "The URL shows an error"

**Possible causes:**
- Script needs to be authorized (click "Authorize access")
- Script has errors (check execution logs)
- Deployment not active

**Fix:**
- Check Apps Script → Executions tab for errors
- Make sure script is saved
- Try creating a new deployment

### "I see the URL but it's not working"

**Check:**
1. Is the deployment active? (Status should be "Active")
2. Did you authorize the script? (First time requires authorization)
3. Are there any errors in Executions tab?

---

## Quick Visual Guide

```
Apps Script Editor
    ↓
Click "Deploy" button
    ↓
Click "Manage deployments"
    ↓
Find "Web app" deployment
    ↓
Copy the URL (looks like: https://script.google.com/macros/s/.../exec)
    ↓
Add to Vercel as GOOGLE_SHEETS_WEB_APP_URL
```

---

**Need help?** Share what you see when you click "Deploy" → "Manage deployments" and I can help you find the right URL!









