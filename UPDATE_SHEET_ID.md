# Update Sheet ID - Complete Checklist

## ✅ Changes Made

I've updated the Sheet ID in your code to use the new sheet:
- **New Sheet ID:** `1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk`
- **Sheet URL:** https://docs.google.com/spreadsheets/d/1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk/edit

---

## 📋 What Was Updated

### 1. ✅ Google Apps Script (`google-apps-script.js`)
- Updated `SHEET_ID` constant
- This is where data gets written to

### 2. ✅ Frontend Service (`src/services/googleSheetsService.js`)
- Updated `GOOGLE_SHEET_ID` constant
- This is where data gets read from

---

## 🔧 What You Need to Do

### Step 1: Update Google Apps Script

1. **Open your Google Apps Script:**
   - Go to your new sheet: https://docs.google.com/spreadsheets/d/1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk/edit
   - Click **Extensions** → **Apps Script**

2. **Update the script:**
   - The code in `google-apps-script.js` has been updated
   - Copy the entire updated script from `google-apps-script.js`
   - Paste it into your Apps Script editor
   - **Save** (Ctrl+S / Cmd+S)

3. **Verify SHEET_ID:**
   - Check line 32 - should show: `const SHEET_ID = '1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk';`

4. **Set Script Properties (if not already done):**
   - ⚙️ Project Settings → Script Properties
   - Add: `SECRET_TOKEN` = your secret token
   - Save

5. **Redeploy:**
   - **Deploy** → **Manage deployments**
   - Click **Edit** (pencil icon) on your Web App deployment
   - Select **"New version"**
   - Click **"Deploy"**
   - **Copy the new Web App URL** (if it changed)

---

### Step 2: Update Vercel Environment Variables (If Web App URL Changed)

If you got a new Web App URL after redeploying:

1. **For each Vercel project** (dev, staging, production):
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Update `GOOGLE_SHEETS_WEB_APP_URL` with the new URL (if it changed)
   - Save and **Redeploy**

---

### Step 3: Verify Sheet Permissions

Make sure your Apps Script can access the new sheet:

1. **Check sheet sharing:**
   - The sheet should be accessible by your Google account
   - Apps Script runs as "Me" so it needs access

2. **Test the script:**
   - In Apps Script, click **"Run"** → Select `doGet` function
   - Click **"Run"**
   - Authorize if prompted
   - Should execute successfully

---

### Step 4: Test the Integration

1. **Test reading data:**
   - Open your app
   - Check if data loads from the new sheet
   - Verify accounts/contacts appear correctly

2. **Test writing data:**
   - Try importing a small CSV file
   - Check if data appears in the new Google Sheet
   - Verify it goes to the correct tabs

---

## 🔍 Verify Everything Works

### Checklist:

- [ ] Google Apps Script updated with new SHEET_ID
- [ ] Script saved in Apps Script editor
- [ ] Script Properties has SECRET_TOKEN set
- [ ] Web App redeployed (if needed)
- [ ] New Web App URL updated in Vercel (if changed)
- [ ] Vercel projects redeployed
- [ ] Sheet permissions allow Apps Script access
- [ ] Test import works
- [ ] Data appears in new sheet

---

## 🚨 Important Notes

### Sheet Structure

Make sure your new sheet has (or will create) these tabs:
- **Imported Accounts** - For account data
- **Imported Contacts** - For contact data
- **Imported Estimates** - For estimate data
- **Imported Jobsites** - For jobsite data
- **All Data** - Compilation tab (created automatically)

The script will create these tabs automatically when you import data, but make sure the sheet is set up correctly.

### Permissions

- The sheet should be accessible by your Google account
- Apps Script needs permission to read/write
- First time running the script will require authorization

---

## 🐛 Troubleshooting

### Error: "Sheet not found"

**Cause:** SHEET_ID doesn't match or sheet doesn't exist

**Fix:**
- Double-check the Sheet ID in the URL
- Verify the sheet exists and is accessible
- Make sure SHEET_ID in Apps Script matches exactly

### Error: "Permission denied"

**Cause:** Apps Script doesn't have access to the sheet

**Fix:**
- Run the script once manually to authorize
- Check sheet sharing settings
- Make sure you're the owner or have edit access

### Data not appearing

**Cause:** Wrong sheet or tabs don't exist

**Fix:**
- Verify you're looking at the correct sheet
- Check that import completed successfully
- Look for tabs: "Imported Accounts", "Imported Contacts", etc.

---

## 📝 Summary

**What changed:**
- ✅ Sheet ID updated in Google Apps Script
- ✅ Sheet ID updated in frontend service

**What you need to do:**
1. Update Apps Script with new code
2. Redeploy Web App (if needed)
3. Update Vercel env vars (if Web App URL changed)
4. Test import functionality

**New Sheet:**
- ID: `1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk`
- URL: https://docs.google.com/spreadsheets/d/1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk/edit

---

**Ready to test!** Once you've updated the Apps Script and redeployed, try importing some data to verify everything works with the new sheet.


