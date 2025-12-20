# Update Your Google Apps Script - CORS Fix

## The Problem
The error `setHeaders is not a function` occurs because Google Apps Script's `ContentService` doesn't support custom headers. We need to use a different approach.

## The Solution

I've updated the script to:
1. Remove the invalid `setHeaders` calls
2. Use `text/plain` content type on the client side (avoids CORS preflight)
3. Keep the script simple with just `ContentService`

## Steps to Update

1. **Open your Google Apps Script:**
   - Go to: https://script.google.com/u/0/home/projects/1nJ28cX31SvmFRRvBgy3b-ooi_4q981xT4CLEETW3lkVCo105w5kuJIW3/edit

2. **Copy the updated code:**
   - Open `google-apps-script.js` from your LECRM project
   - Copy the entire file content

3. **Paste into Apps Script:**
   - Replace ALL code in your Apps Script editor with the new code
   - Make sure the `SHEET_ID` matches your sheet: `1CzkVSbflUrYO_90Zk7IEreDOIV4lMFnWe30dFilFa6s`

4. **Save the project** (Ctrl+S / Cmd+S)

5. **Redeploy:**
   - Click **Deploy** → **Manage deployments**
   - Click the **pencil icon** (edit) next to your existing deployment
   - Under **Version**, select **New version**
   - **IMPORTANT**: Make sure "Who has access" is set to **"Anyone"** (not "Anyone with Google account")
   - Click **Deploy**

6. **Test:**
   - The Web App URL should be the same: `https://script.google.com/macros/s/AKfycbx16EotbBPsrE_jYTrnc26G_b6n83qqeoR1i-HuKYUEkIgmGNLm-QKRk_Sk1WFHEGo/exec`
   - Try importing data again

## What Changed

- Removed `doOptions()` function (not needed)
- Removed `setHeaders()` calls (doesn't exist in ContentService)
- Simplified to use `ContentService.createTextOutput()` only
- Client-side now uses `text/plain` content type to avoid CORS preflight

The Web App will handle CORS automatically when deployed with "Anyone" access.









