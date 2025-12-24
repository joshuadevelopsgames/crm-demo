# Fix CORS Issue for Google Apps Script Web App

## Problem
You're seeing CORS errors when trying to write to Google Sheets:
```
Access to fetch at 'https://script.google.com/macros/s/...' from origin 'https://lecrm-stg.vercel.app' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solution

The Google Apps Script needs to be updated to handle CORS headers. Follow these steps:

### Step 1: Update Your Google Apps Script

1. Open your Google Apps Script project:
   - Go to: https://script.google.com/u/0/home/projects/1nJ28cX31SvmFRRvBgy3b-ooi_4q981xT4CLEETW3lkVCo105w5kuJIW3/edit
   - Or open your Google Sheet → Extensions → Apps Script

2. Replace the `doPost`, `doGet`, and add `doOptions` functions with the updated code from `google-apps-script.js` in this repo.

3. **Important**: The key changes are:
   - Added `doOptions()` function to handle CORS preflight requests
   - Added CORS headers to all responses (`doPost`, `doGet`)
   - Headers include: `Access-Control-Allow-Origin: *`

### Step 2: Redeploy the Web App

After updating the script:

1. Click **Deploy** → **Manage deployments**
2. Click the **pencil icon** (edit) next to your existing deployment
3. Under **Version**, select **New version**
4. Click **Deploy**
5. **Important**: Make sure "Who has access" is set to **"Anyone"** (not "Anyone with Google account")

### Step 3: Test

After redeploying, try importing data again. The CORS errors should be resolved.

## Why This Happens

Google Apps Script Web Apps don't automatically include CORS headers. When your frontend (hosted on Vercel) tries to make a POST request to the Apps Script Web App, the browser sends a "preflight" OPTIONS request first. If the server doesn't respond with the right CORS headers, the browser blocks the actual request.

The `doOptions()` function handles the preflight request, and the CORS headers in `doPost()` allow the actual request to succeed.

## Alternative: Use JSONP (Not Recommended)

If CORS continues to be an issue, you could use JSONP, but it's less secure and doesn't support POST requests properly. The CORS solution above is the correct approach.












