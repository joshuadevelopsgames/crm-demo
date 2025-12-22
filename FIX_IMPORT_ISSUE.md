# Fix: Import Not Working

## Issues Found

1. **Old code deployed** - Console shows old warning about `VITE_GOOGLE_SHEETS_WEB_APP_URL`
2. **Backend API not configured** - Environment variables need to be set and project redeployed
3. **JavaScript error** - "Cannot read properties of null (reading 'style')" - separate UI issue

---

## Solution Steps

### Step 1: Commit and Push Latest Code

Make sure all the security fixes are committed:

```bash
git add .
git commit -m "Update to use backend API for Google Sheets sync"
git push dev main
```

This will trigger a new deployment with the updated code.

---

### Step 2: Verify Environment Variables in Vercel

**For lecrm-dev project:**

1. Go to: https://vercel.com/dashboard
2. Select **lecrm-dev** project
3. **Settings** → **Environment Variables**
4. Verify these exist:
   - ✅ `GOOGLE_SHEETS_WEB_APP_URL` = `https://script.google.com/macros/s/AKfycbwkKotdbAmDbE4SD3RLjlgI0KSLlbxBTXdsKvJBcQX7qmbUOMLjIYyLEFkD8N7NAHlWbA/exec`
   - ✅ `GOOGLE_SHEETS_SECRET_TOKEN` = your secret token

5. **If missing, add them:**
   - Key: `GOOGLE_SHEETS_WEB_APP_URL`
   - Value: Your Web App URL
   - Environment: ✅ Production ✅ Preview ✅ Development
   - Save

   - Key: `GOOGLE_SHEETS_SECRET_TOKEN`
   - Value: Your secret token
   - Environment: ✅ Production ✅ Preview ✅ Development
   - Save

---

### Step 3: Redeploy lecrm-dev

After adding/verifying environment variables:

1. **Deployments** tab
2. Click **"Redeploy"** on latest deployment
3. **OR** wait for auto-deploy after git push

**Important:** Environment variables only take effect after redeploy!

---

### Step 4: Test the Backend API

After redeploy, test if the API endpoint works:

1. **Open browser console** on https://lecrm-dev.vercel.app
2. **Run this test:**
   ```javascript
   fetch('/api/google-sheets/write', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       entityType: 'accounts',
       records: [{ name: 'Test', id: 'test-1' }]
     })
   }).then(r => r.json()).then(console.log)
   ```

**Expected response:**
- ✅ Success: `{success: true, result: {...}}`
- ❌ Error: Check error message

---

### Step 5: Test Import Again

After redeploy:

1. **Clear browser cache** (or use incognito)
2. **Go to:** https://lecrm-dev.vercel.app/import-leads
3. **Upload a small CSV file**
4. **Watch console:**
   - Should see: "📝 Writing imported data to Google Sheets via secure API..."
   - Should NOT see: "Web App URL not configured"
   - Should see API calls to `/api/google-sheets/write`

---

## Troubleshooting

### Still seeing "Web App URL not configured"

**Cause:** Old code still deployed

**Fix:**
- Make sure code is pushed to GitHub
- Check Vercel deployment logs
- Force redeploy with "Clear Build Cache"

### Error: "Google Sheets Web App URL not configured on server"

**Cause:** Environment variable not set in Vercel

**Fix:**
- Add `GOOGLE_SHEETS_WEB_APP_URL` to Vercel
- Redeploy project

### Error: "Google Sheets secret token not configured on server"

**Cause:** Environment variable not set in Vercel

**Fix:**
- Add `GOOGLE_SHEETS_SECRET_TOKEN` to Vercel
- Make sure it matches Apps Script token exactly
- Redeploy project

### Error: "Cannot read properties of null (reading 'style')"

**Cause:** UI element not found (separate issue)

**Fix:**
- This is a React rendering issue
- Check browser console for full stack trace
- Might be related to loading screen or dialog component

### Import completes but no data in Google Sheet

**Possible causes:**
1. Backend API not working (check Step 4)
2. Token mismatch (verify tokens match)
3. Sheet permissions (make sure Apps Script can write)

**Fix:**
- Test backend API (Step 4)
- Check Vercel function logs
- Verify Apps Script can access the sheet

---

## Quick Checklist

- [ ] Code pushed to GitHub (with backend API changes)
- [ ] Vercel auto-deployed (or manually redeployed)
- [ ] `GOOGLE_SHEETS_WEB_APP_URL` set in Vercel
- [ ] `GOOGLE_SHEETS_SECRET_TOKEN` set in Vercel
- [ ] Project redeployed after adding env vars
- [ ] Backend API test works (Step 4)
- [ ] Import test works
- [ ] Data appears in Google Sheet

---

## Verify It's Working

After fixing, you should see in console:

✅ **Good signs:**
- "📝 Writing imported data to Google Sheets via secure API..."
- Network request to `/api/google-sheets/write`
- Success messages
- Data appears in Google Sheet

❌ **Bad signs:**
- "Web App URL not configured" (old code)
- "Google Sheets Web App URL not configured on server" (env var missing)
- 404 on `/api/google-sheets/write` (API not deployed)
- "Unauthorized" (token mismatch)

---

**Next Step:** Push your code, add env vars to Vercel, and redeploy. Then test again!








