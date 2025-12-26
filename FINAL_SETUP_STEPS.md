# ✅ Final Setup Steps - Your Web App is Ready!

## 🎉 Your Web App URL

**Web App URL:** `https://script.google.com/macros/s/AKfycbwkKotdbAmDbE4SD3RLjlgI0KSLlbxBTXdsKvJBcQX7qmbUOMLjIYyLEFkD8N7NAHlWbA/exec`

**Status:** ✅ Working and authenticated!

---

## 📋 What You Need to Do Now

### Step 1: Add Environment Variables to Vercel

You need to add **TWO** environment variables to **each** Vercel project (dev, staging, production).

#### For Each Vercel Project:

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select project (lecrm-dev, lecrm-stg, or lecrm)

2. **Go to Settings → Environment Variables**

3. **Add Variable 1:**
   - **Key:** `GOOGLE_SHEETS_WEB_APP_URL`
   - **Value:** `https://script.google.com/macros/s/AKfycbwkKotdbAmDbE4SD3RLjlgI0KSLlbxBTXdsKvJBcQX7qmbUOMLjIYyLEFkD8N7NAHlWbA/exec`
   - **Environment:** ✅ Production ✅ Preview ✅ Development
   - Click **"Save"**

4. **Add Variable 2:**
   - **Key:** `GOOGLE_SHEETS_SECRET_TOKEN`
   - **Value:** Your secret token (same one you set in Apps Script Properties)
   - **Environment:** ✅ Production ✅ Preview ✅ Development
   - Click **"Save"**

5. **Repeat for all 3 projects:**
   - ✅ lecrm-dev
   - ✅ lecrm-stg  
   - ✅ lecrm (production)

---

### Step 2: Redeploy All Projects

After adding environment variables, redeploy each project:

1. **Go to Deployments tab**
2. **Click "Redeploy"** on the latest deployment
3. **Or trigger a new deployment** by pushing to GitHub

**Important:** Environment variables only take effect after redeploy!

---

### Step 3: Verify Setup

#### Test 1: Check Web App (Already Done ✅)
Your Web App URL is working and shows:
```json
{
  "success": true,
  "security": {
    "authenticationConfigured": true
  }
}
```

#### Test 2: Test Backend API

After redeploying Vercel, test the API endpoint:

```bash
curl -X POST "https://lecrm.vercel.app/api/google-sheets/write" \
  -H "Content-Type: application/json" \
  -H "Origin: https://lecrm.vercel.app" \
  -d '{
    "entityType": "accounts",
    "records": [{"name": "Test Account", "id": "test-1"}]
  }'
```

**Expected:** Success response (if env vars are set correctly)

#### Test 3: Test in Your App

1. **Open your app** (local or deployed)
2. **Open Browser DevTools** (F12)
   - Go to **Console** tab
   - Go to **Network** tab
3. **Try importing a small CSV file**
4. **Watch the Network tab:**
   - Should see request to `/api/google-sheets/write`
   - Should NOT see direct calls to `script.google.com`
   - Should NOT see token in request payload

---

## 🔍 Quick Verification Checklist

- [ ] `GOOGLE_SHEETS_WEB_APP_URL` added to all 3 Vercel projects
- [ ] `GOOGLE_SHEETS_SECRET_TOKEN` added to all 3 Vercel projects
- [ ] All 3 projects redeployed
- [ ] Web App URL tested (already working ✅)
- [ ] Test import in app works
- [ ] Data appears in Google Sheet

---

## 🚨 Important Reminders

### Environment Variable Names

**✅ CORRECT (Server-side, secure):**
- `GOOGLE_SHEETS_WEB_APP_URL`
- `GOOGLE_SHEETS_SECRET_TOKEN`

**❌ WRONG (Client-side, insecure):**
- `VITE_GOOGLE_SHEETS_WEB_APP_URL` (don't use!)
- `VITE_GOOGLE_SHEETS_SECRET_TOKEN` (don't use!)

### Token Must Match

The `GOOGLE_SHEETS_SECRET_TOKEN` in Vercel must be **exactly the same** as the `SECRET_TOKEN` in Apps Script Properties.

---

## 🐛 Troubleshooting

### Error: "Google Sheets Web App URL not configured on server"

**Cause:** `GOOGLE_SHEETS_WEB_APP_URL` not set in Vercel

**Fix:**
- Add the environment variable
- Redeploy the project

### Error: "Google Sheets secret token not configured on server"

**Cause:** `GOOGLE_SHEETS_SECRET_TOKEN` not set in Vercel

**Fix:**
- Add the environment variable
- Make sure it matches Apps Script token exactly
- Redeploy the project

### Error: "Unauthorized: Invalid or missing authentication token"

**Cause:** Token mismatch between Vercel and Apps Script

**Fix:**
- Verify tokens match exactly (no extra spaces)
- Copy token from one place and paste to the other
- Redeploy after updating

### Error: 404 on `/api/google-sheets/write`

**Cause:** API endpoint not deployed

**Fix:**
- Verify `api/google-sheets/write.js` exists in your code
- Check Vercel deployment logs
- Redeploy the project

---

## 📝 Summary

**Your Web App:** ✅ Working and authenticated  
**Your Sheet ID:** ✅ Updated to new sheet  
**What's Left:** Add env vars to Vercel and redeploy

**Next Steps:**
1. Add `GOOGLE_SHEETS_WEB_APP_URL` to all Vercel projects
2. Add `GOOGLE_SHEETS_SECRET_TOKEN` to all Vercel projects  
3. Redeploy all projects
4. Test import functionality

---

**You're almost there!** Once you add the environment variables and redeploy, everything should work perfectly. 🚀











