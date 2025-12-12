# Fix: Data Not Displaying on Site After Import

## The Problem

After importing data to Google Sheets, the data isn't showing up on your website. This is because the frontend needs to **read** from the Google Sheet, and there are two ways it can do this:

1. **Google Sheets API** (requires API key)
2. **Public CSV Export** (requires sheet to be public)

---

## Quick Fix: Make Your Sheet Public

The easiest solution is to make your Google Sheet publicly readable:

### Step 1: Open Your Google Sheet
1. Go to: https://docs.google.com/spreadsheets/d/1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk/edit
2. Click the **"Share"** button (top right)

### Step 2: Make It Public
1. Click **"Change to anyone with the link"**
2. Select **"Viewer"** (read-only access)
3. Click **"Done"**

**Note:** Making it "Viewer" means people can only read the data, not edit it. Your Apps Script write protection (secret token) still prevents unauthorized writes.

### Step 3: Refresh Your Site
1. Go to your site (e.g., `https://lecrm-dev.vercel.app/accounts`)
2. **Hard refresh** the page:
   - **Chrome/Edge:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - **Firefox:** `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
3. The data should now appear!

---

## Alternative: Use Google Sheets API (More Secure)

If you don't want to make the sheet public, you can use the Google Sheets API with an API key:

### Step 1: Get a Google Sheets API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create an API Key:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key

### Step 2: Restrict the API Key (Recommended)

1. Click on your API key to edit it
2. Under "API restrictions", select **"Restrict key"**
3. Choose **"Google Sheets API"**
4. Under "Application restrictions", you can restrict to your domain (optional)
5. Click "Save"

### Step 3: Add API Key to Vercel

1. Go to your Vercel project settings
2. Go to "Environment Variables"
3. Add:
   - **Name:** `VITE_GOOGLE_SHEETS_API_KEY`
   - **Value:** Your API key
   - **Environment:** Production, Preview, Development (all)
4. Click "Save"
5. **Redeploy** your project

### Step 4: Test

1. Refresh your site
2. Check browser console (F12) for any errors
3. Data should load via API instead of CSV

---

## Verify It's Working

### Check Browser Console

1. Open your site
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for messages like:
   - ✅ `✅ Loaded X rows from Imported Accounts tab`
   - ✅ `✅ Loaded X rows from Imported Contacts tab`
   - ❌ `❌ Error fetching Imported Accounts via CSV`

### Check Network Tab

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Refresh the page
4. Look for requests to:
   - `sheets.googleapis.com` (API method)
   - `docs.google.com/spreadsheets/.../gviz/tq` (CSV method)
5. Check if they return **200 OK** or an error

---

## Troubleshooting

### Issue: "Failed to fetch" errors

**Cause:** Sheet is not public OR API key is invalid

**Fix:**
- Make sheet public (see Step 1 above), OR
- Check API key is correct in Vercel environment variables

### Issue: Data loads but shows 0 rows

**Cause:** Sheet tabs don't exist or are empty

**Fix:**
1. Check your Google Sheet directly
2. Verify tabs exist: "Imported Accounts", "Imported Contacts", etc.
3. Verify they have data (not just headers)

### Issue: Old data showing (cache issue)

**Cause:** Browser or service cache

**Fix:**
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. The service has a 5-minute cache - wait 5 minutes or force refresh

### Issue: CORS errors

**Cause:** Sheet permissions or API restrictions

**Fix:**
- If using CSV method: Make sure sheet is public
- If using API: Check API key restrictions allow your domain

---

## How Data Loading Works

1. **Frontend calls:** `base44.entities.Account.list()`
2. **Which calls:** `getData('accounts', forceRefresh)`
3. **Which calls:** `loadSheetData(forceRefresh)`
4. **Which calls:** `getSheetData(forceRefresh)` from `googleSheetsService.js`
5. **Which calls:** `fetchSheetData('Imported Accounts')`
6. **Which tries:**
   - First: Google Sheets API (if `VITE_GOOGLE_SHEETS_API_KEY` is set)
   - Fallback: Public CSV export (if sheet is public)

---

## Recommended Solution

**For Development/Testing:** Make the sheet public (easiest)

**For Production:** Use Google Sheets API with restricted API key (more secure)

---

**After making the sheet public or adding the API key, refresh your site and the data should appear!**

