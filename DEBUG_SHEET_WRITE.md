# Debug: Google Sheet Not Getting Written To

## Quick Checklist

- [ ] Environment variables set in Vercel?
- [ ] Vercel project redeployed after adding env vars?
- [ ] Backend API endpoint exists (`/api/google-sheets/write`)?
- [ ] Check browser console for errors?
- [ ] Check Vercel function logs?

---

## Step 1: Check Browser Console

After importing, check the browser console (F12) for:

### ✅ Good Signs:
- "📝 Writing imported data to Google Sheets via secure API..."
- Network request to `/api/google-sheets/write`
- Success messages like "✅ Successfully wrote X accounts to Google Sheet"

### ❌ Bad Signs:
- "⚠️ Google Sheets Web App URL not configured" (old code)
- "Google Sheets Web App URL not configured on server" (env var missing)
- "Google Sheets secret token not configured on server" (env var missing)
- "Unauthorized" (token mismatch)
- 404 on `/api/google-sheets/write` (API not deployed)
- No network request to `/api/google-sheets/write` (code not calling API)

---

## Step 2: Verify Environment Variables

**Check Vercel Dashboard:**

1. Go to: https://vercel.com/dashboard
2. Select **lecrm-dev** project
3. **Settings** → **Environment Variables**
4. Verify these exist:
   - ✅ `GOOGLE_SHEETS_WEB_APP_URL`
   - ✅ `GOOGLE_SHEETS_SECRET_TOKEN`

5. **Check values:**
   - `GOOGLE_SHEETS_WEB_APP_URL` should be: `https://script.google.com/macros/s/AKfycbwkKotdbAmDbE4SD3RLjlgI0KSLlbxBTXdsKvJBcQX7qmbUOMLjIYyLEFkD8N7NAHlWbA/exec`
   - `GOOGLE_SHEETS_SECRET_TOKEN` should match your Apps Script token

6. **If missing or wrong:**
   - Add/update the variables
   - **Redeploy** the project (important!)

---

## Step 3: Test Backend API Directly

Open browser console on https://lecrm-dev.vercel.app and run:

```javascript
fetch('/api/google-sheets/write', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'accounts',
    records: [{ name: 'Test Account', id: 'test-123' }]
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### Expected Responses:

**✅ Success:**
```json
{
  "success": true,
  "result": {
    "created": 1,
    "updated": 0,
    "total": 1
  }
}
```

**❌ Error - Env Var Missing:**
```json
{
  "success": false,
  "error": "Google Sheets Web App URL not configured on server"
}
```
**Fix:** Add `GOOGLE_SHEETS_WEB_APP_URL` to Vercel and redeploy

**❌ Error - Token Missing:**
```json
{
  "success": false,
  "error": "Google Sheets secret token not configured on server"
}
```
**Fix:** Add `GOOGLE_SHEETS_SECRET_TOKEN` to Vercel and redeploy

**❌ Error - Unauthorized:**
```json
{
  "success": false,
  "error": "Authentication failed: Invalid secret token configured on server"
}
```
**Fix:** Verify token matches exactly between Vercel and Apps Script

**❌ Error - 404:**
```
Failed to fetch
```
**Fix:** API endpoint not deployed - check Vercel deployment logs

---

## Step 4: Check Vercel Function Logs

1. **Go to Vercel Dashboard** → lecrm-dev project
2. **Deployments** tab
3. **Click on latest deployment**
4. **Click "Functions" tab** (or "Function Logs")
5. **Look for `/api/google-sheets/write`**
6. **Check logs** for errors

Common errors in logs:
- "GOOGLE_SHEETS_WEB_APP_URL not configured"
- "GOOGLE_SHEETS_SECRET_TOKEN not configured"
- "Google Apps Script error: ..."
- "Unauthorized"

---

## Step 5: Check Network Tab

1. **Open Browser DevTools** (F12)
2. **Network tab**
3. **Try importing again**
4. **Look for `/api/google-sheets/write` request**

**Check:**
- ✅ Request exists?
- ✅ Status code? (200 = success, 401 = unauthorized, 500 = server error)
- ✅ Request payload? (should have `entityType` and `records`, NOT `token`)
- ✅ Response? (check Preview/Response tab)

---

## Step 6: Verify Apps Script

1. **Test Web App URL directly:**
   ```
   https://script.google.com/macros/s/AKfycbwkKotdbAmDbE4SD3RLjlgI0KSLlbxBTXdsKvJBcQX7qmbUOMLjIYyLEFkD8N7NAHlWbA/exec
   ```
   Should return JSON with `"authenticationConfigured": true`

2. **Check Apps Script execution logs:**
   - Apps Script → **Executions** tab
   - Look for recent executions
   - Check for errors

3. **Verify Script Properties:**
   - Apps Script → ⚙️ Project Settings → Script Properties
   - Verify `SECRET_TOKEN` exists and matches Vercel token

---

## Common Issues & Fixes

### Issue 1: "Web App URL not configured on server"

**Cause:** `GOOGLE_SHEETS_WEB_APP_URL` not set in Vercel

**Fix:**
1. Add env var to Vercel
2. Redeploy project

### Issue 2: "Secret token not configured on server"

**Cause:** `GOOGLE_SHEETS_SECRET_TOKEN` not set in Vercel

**Fix:**
1. Add env var to Vercel
2. Redeploy project

### Issue 3: "Unauthorized"

**Cause:** Token mismatch

**Fix:**
1. Verify tokens match exactly (no spaces, same case)
2. Copy from one place and paste to the other
3. Redeploy Vercel

### Issue 4: No network request to `/api/google-sheets/write`

**Cause:** Old code deployed or import not triggering write

**Fix:**
1. Check if latest code is deployed
2. Check browser console for import errors
3. Verify import completed successfully

### Issue 5: 404 on API endpoint

**Cause:** API file not deployed

**Fix:**
1. Verify `api/google-sheets/write.js` exists in code
2. Check Vercel deployment logs
3. Redeploy project

---

## Quick Test Script

Run this in browser console to test everything:

```javascript
// Test 1: Check if API endpoint exists
fetch('/api/google-sheets/write', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'accounts',
    records: [{ name: 'Test', id: 'test-1' }]
  })
})
.then(r => r.json())
.then(result => {
  console.log('API Test Result:', result);
  if (result.success) {
    console.log('✅ API is working!');
  } else {
    console.error('❌ API Error:', result.error);
  }
})
.catch(err => {
  console.error('❌ API Request Failed:', err);
});
```

---

## What to Share for Help

If still not working, share:

1. **Browser console output** (after importing)
2. **Network tab screenshot** (showing `/api/google-sheets/write` request)
3. **Vercel function logs** (from latest deployment)
4. **Environment variables status** (are they set? what are the keys?)

---

**Most Common Issue:** Environment variables not set or project not redeployed after adding them!














