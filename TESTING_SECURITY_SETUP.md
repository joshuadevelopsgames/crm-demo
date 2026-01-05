# 🧪 Testing Security Setup - Step by Step Guide

## Quick Test Checklist

- [ ] Google Apps Script has SECRET_TOKEN set
- [ ] Vercel has GOOGLE_SHEETS_WEB_APP_URL set
- [ ] Vercel has GOOGLE_SHEETS_SECRET_TOKEN set
- [ ] Backend API endpoint exists (`/api/google-sheets/write`)
- [ ] Frontend calls backend API (not Google Apps Script directly)
- [ ] Test import works end-to-end

---

## Step 1: Verify Google Apps Script Setup

### Check Script Property

1. **Open Apps Script:**
   - Go to: https://script.google.com/
   - Or: Your Google Sheet → Extensions → Apps Script

2. **Check Script Properties:**
   - Click ⚙️ Project Settings
   - Scroll to "Script Properties"
   - Verify `SECRET_TOKEN` exists
   - ✅ Should see your token value (partially masked)

### Test Web App Directly

1. **Get your Web App URL:**
   - Deploy → Manage deployments
   - Copy the Web App URL

2. **Test GET request:**
   ```bash
   # In browser or terminal:
   curl "YOUR_WEB_APP_URL"
   ```
   
   **Expected response:**
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

3. **Test POST without token (should fail):**
   ```bash
   curl -X POST "YOUR_WEB_APP_URL" \
     -H "Content-Type: application/json" \
     -d '{"action":"upsert","entityType":"accounts","records":[]}'
   ```
   
   **Expected response:**
   ```json
   {
     "success": false,
     "error": "Unauthorized: Invalid or missing authentication token"
   }
   ```

4. **Test POST with token (should work):**
   ```bash
   curl -X POST "YOUR_WEB_APP_URL" \
     -H "Content-Type: application/json" \
     -d '{"action":"upsert","entityType":"accounts","records":[],"token":"YOUR_TOKEN"}'
   ```
   
   **Expected response:**
   ```json
   {
     "success": true,
     "result": {
       "created": 0,
       "updated": 0,
       "total": 0
     }
   }
   ```

---

## Step 2: Verify Vercel Environment Variables

### Check Each Project

For **each** Vercel project (dev, staging, production):

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select project

2. **Check Environment Variables:**
   - Settings → Environment Variables
   - Verify these exist:
     - ✅ `GOOGLE_SHEETS_WEB_APP_URL` (no VITE_ prefix)
     - ✅ `GOOGLE_SHEETS_SECRET_TOKEN` (no VITE_ prefix)
   - ❌ Should NOT have `VITE_GOOGLE_SHEETS_*` variables

3. **Verify values:**
   - `GOOGLE_SHEETS_WEB_APP_URL` = Your Apps Script Web App URL
   - `GOOGLE_SHEETS_SECRET_TOKEN` = Same token as Apps Script

---

## Step 3: Test Backend API Endpoint

### Local Testing (if using Vercel CLI)

1. **Start Vercel dev server:**
   ```bash
   vercel dev
   ```

2. **Test API endpoint:**
   ```bash
   curl -X POST "http://localhost:3000/api/google-sheets/write" \
     -H "Content-Type: application/json" \
     -d '{
       "entityType": "accounts",
       "records": [{"name": "Test Account", "id": "test-1"}]
     }'
   ```

   **Expected:** Should proxy to Google Apps Script and return success

### Production Testing

1. **After deploying, test the endpoint:**
   ```bash
   curl -X POST "https://lecrm.vercel.app/api/google-sheets/write" \
     -H "Content-Type: application/json" \
     -H "Origin: https://lecrm.vercel.app" \
     -d '{
       "entityType": "accounts",
       "records": [{"name": "Test Account", "id": "test-1"}]
     }'
   ```

   **Expected:** Should work if environment variables are set

---

## Step 4: Test Frontend Integration

### Check Browser Console

1. **Open your app:**
   - Dev: `http://localhost:5173` or `https://lecrm-dev.vercel.app`
   - Staging: `https://lecrm-stg.vercel.app`
   - Production: `https://lecrm.vercel.app`

2. **Open Browser DevTools:**
   - Press F12 or Cmd+Option+I
   - Go to "Console" tab
   - Go to "Network" tab

3. **Try importing data:**
   - Go to Import Leads page
   - Upload a CSV file
   - Watch the Network tab

4. **Verify API call:**
   - Look for request to `/api/google-sheets/write`
   - ✅ Should NOT see direct calls to `script.google.com`
   - ✅ Should NOT see token in request payload (check Request Payload)
   - ✅ Should see `entityType` and `records` only

### Check Request Details

**In Network tab, click on the `/api/google-sheets/write` request:**

**Request Headers:**
```
Content-Type: application/json
```

**Request Payload:**
```json
{
  "entityType": "accounts",
  "records": [...]
}
```

**Should NOT contain:**
- ❌ `token` field
- ❌ `VITE_GOOGLE_SHEETS_SECRET_TOKEN`
- ❌ Any secret values

**Response:**
```json
{
  "success": true,
  "result": {
    "created": 5,
    "updated": 2,
    "total": 7
  }
}
```

---

## Step 5: Verify Security

### Check Source Code Exposure

1. **View Page Source:**
   - Right-click → "View Page Source"
   - Search for: `GOOGLE_SHEETS_SECRET_TOKEN`
   - ✅ Should NOT find it

2. **Check JavaScript Bundle:**
   - DevTools → Sources tab
   - Look for bundled JavaScript files
   - Search for: `SECRET_TOKEN` or `GOOGLE_SHEETS_SECRET`
   - ✅ Should NOT find the token value

3. **Check Network Requests:**
   - DevTools → Network tab
   - Filter: XHR or Fetch
   - Check all requests to `/api/google-sheets/write`
   - ✅ Token should NOT be in any request

### Verify CORS Protection

1. **Test from different origin (should fail):**
   ```bash
   curl -X POST "https://lecrm.vercel.app/api/google-sheets/write" \
     -H "Content-Type: application/json" \
     -H "Origin: https://evil-site.com" \
     -d '{"entityType":"accounts","records":[]}'
   ```
   
   **Expected:** Should be blocked or return CORS error

---

## Step 6: End-to-End Test

### Full Import Test

1. **Prepare test CSV:**
   - Create a small CSV with 2-3 test accounts
   - Use LMN format or your standard format

2. **Import in app:**
   - Go to Import Leads page
   - Upload CSV
   - Click Import

3. **Check results:**
   - ✅ Should see success message
   - ✅ Should see "X records imported"
   - ✅ Check Google Sheet - data should appear

4. **Check console:**
   - ✅ No errors
   - ✅ Success logs
   - ✅ No "Unauthorized" errors

---

## Troubleshooting

### Error: "Unauthorized: Invalid or missing authentication token"

**Possible causes:**
1. Token doesn't match between Apps Script and Vercel
2. Environment variable not set in Vercel
3. Vercel project not redeployed after adding env var

**Fix:**
- Double-check token matches exactly
- Verify env var is set in correct Vercel project
- Redeploy the project

### Error: "Google Sheets Web App URL not configured on server"

**Cause:** `GOOGLE_SHEETS_WEB_APP_URL` not set in Vercel

**Fix:**
- Add environment variable to Vercel
- Redeploy

### Error: "Google Sheets secret token not configured on server"

**Cause:** `GOOGLE_SHEETS_SECRET_TOKEN` not set in Vercel

**Fix:**
- Add environment variable to Vercel
- Redeploy

### Error: CORS error

**Cause:** Origin not in allowed list

**Fix:**
- Check `/api/google-sheets/write.js`
- Add your domain to `allowedOrigins` array
- Redeploy

### Error: 404 on `/api/google-sheets/write`

**Cause:** API endpoint not deployed

**Fix:**
- Verify `api/google-sheets/write.js` exists
- Check Vercel deployment logs
- Redeploy

---

## Success Indicators

✅ **Everything is working if:**
- Import completes successfully
- Data appears in Google Sheet
- No errors in console
- No token visible in browser
- API calls go to `/api/google-sheets/write` (not directly to Google)
- Backend API successfully proxies to Google Apps Script

---

## Quick Test Script

Run this in your browser console after importing:

```javascript
// Check if token is exposed
console.log('Checking for exposed tokens...');
const scripts = Array.from(document.querySelectorAll('script'));
const hasToken = scripts.some(script => 
  script.textContent.includes('GOOGLE_SHEETS_SECRET_TOKEN') ||
  script.textContent.includes('SECRET_TOKEN')
);
console.log('Token exposed in scripts:', hasToken ? '❌ YES (BAD!)' : '✅ NO (GOOD!)');

// Check network requests
console.log('Check Network tab for /api/google-sheets/write requests');
console.log('Verify token is NOT in request payload');
```

---

## Next Steps After Testing

Once everything works:
1. ✅ Remove any old `VITE_GOOGLE_SHEETS_*` variables
2. ✅ Document your token (securely, not in code)
3. ✅ Set up monitoring/alerts
4. ✅ Consider rotating token periodically

---

**Need help?** Check the error messages and refer to troubleshooting section above.
















