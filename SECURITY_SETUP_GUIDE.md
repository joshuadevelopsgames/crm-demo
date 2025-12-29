# Google Apps Script Security Setup Guide

This guide will help you secure your Google Apps Script Web App with secret token authentication.

## 🔒 Why This Matters

Without authentication, **anyone who discovers your Web App URL can write to your Google Sheet**. Adding a secret token ensures only authorized requests can modify your data.

---

## Step 1: Generate a Secret Token

You need a strong, random token. Here are a few ways to generate one:

### Option A: Use an Online Generator
1. Go to: https://www.lastpass.com/features/password-generator
2. Set length to **32 characters** (or longer)
3. Include: Letters, Numbers, Symbols
4. Click "Generate"
5. **Copy the token** - you'll need it in both places

### Option B: Use Command Line (Mac/Linux)
```bash
openssl rand -base64 32
```

### Option C: Use Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example token:** `aB3xK9mP2qR7vN5tY8wZ1cD4fG6hJ0lM3nO5pQ8rS2tU`

---

## Step 2: Set Token in Google Apps Script

1. **Open your Google Apps Script project:**
   - Go to: https://script.google.com/
   - Or open your Google Sheet → Extensions → Apps Script

2. **Open Project Settings:**
   - Click the **gear icon** (⚙️) in the left sidebar
   - Or go to: Project Settings

3. **Add Script Property:**
   - Scroll down to **"Script Properties"** section
   - Click **"Add script property"** button

4. **Enter the property:**
   - **Property:** `SECRET_TOKEN` (exactly this, case-sensitive)
   - **Value:** Paste your generated token
   - Click **"Save script properties"**

5. **Verify it's saved:**
   - You should see `SECRET_TOKEN` in the list of script properties

---

## Step 3: Add Token to Your Environment Variables

### For Local Development (.env file)

1. **Open or create `.env` file** in your project root:
   ```bash
   # If file doesn't exist, create it:
   touch .env
   ```

2. **Add the token:**
   ```bash
   VITE_GOOGLE_SHEETS_SECRET_TOKEN=your-token-here
   ```
   
   Replace `your-token-here` with the **exact same token** you used in Step 2.

3. **Save the file**

4. **Restart your dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

### For Vercel Deployment

You have **three Vercel projects** (dev, staging, production). You need to add the token to **each one**.

#### Option 1: Same Token for All (Simpler) ✅ Recommended

Use the **same token** for all environments. This is simpler and works if you're using the same Google Sheet.

**For each Vercel project (dev, staging, production):**

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select the project:
     - `lecrm-dev` (dev environment)
     - `lecrm-stg` (staging environment)  
     - `lecrm` (production environment)

2. **Go to Settings → Environment Variables**

3. **Add new variable:**
   - **Key:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN`
   - **Value:** Paste your token (same one from Step 2)
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

4. **Repeat for each project** (dev, staging, production)

5. **Redeploy each project:**
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"

#### Option 2: Different Tokens (More Secure) 🔒

Use **different tokens** for each environment. This provides better security isolation.

**Setup:**

1. **Generate 3 different tokens** (one for each environment)

2. **Set up Google Apps Script:**
   - You can either:
     - **Option A:** Use 3 different Google Sheets (one per environment)
     - **Option B:** Use the same sheet but accept multiple tokens (requires code change)

3. **Add tokens to Vercel:**
   - **Dev project:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN` = dev token
   - **Staging project:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN` = staging token
   - **Production project:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN` = production token

**Recommendation:** Start with **Option 1** (same token). It's simpler and sufficient for most use cases. You can always switch to different tokens later if needed.

---

## Step 4: Update Google Apps Script (If Needed)

If you haven't updated your Google Apps Script code yet:

1. **Open Apps Script editor**
2. **Replace the entire `doPost` function** with the updated version from `google-apps-script.js`
3. **Save** (Ctrl+S or Cmd+S)
4. **Redeploy:**
   - Click **"Deploy"** → **"Manage deployments"**
   - Click the **pencil icon** (✏️) next to your deployment
   - Under **"Version"**, select **"New version"**
   - Click **"Deploy"**

---

## Step 5: Test the Setup

### Test 1: Check Web App Status
1. Visit your Web App URL in a browser:
   ```
   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
2. You should see:
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

### Test 2: Try Importing Data
1. Open your LECRM app
2. Try importing some test data
3. Check the browser console for any errors
4. If you see "Unauthorized" errors, double-check:
   - Token matches exactly in both places
   - Environment variable is loaded (restart dev server)
   - Script Properties saved correctly

---

## Troubleshooting

### Error: "Unauthorized: Invalid or missing authentication token"

**Possible causes:**
1. ✅ Token doesn't match between Apps Script and .env
2. ✅ Environment variable not loaded (restart dev server)
3. ✅ Script Property not saved correctly
4. ✅ Token has extra spaces or newlines

**Fix:**
- Copy token from one place and paste to the other (don't retype)
- Check for leading/trailing spaces
- Restart your dev server after changing .env
- Verify Script Property name is exactly `SECRET_TOKEN` (case-sensitive)

### Error: "SECRET_TOKEN not configured"

**This means:**
- The Apps Script doesn't have the token set yet
- Follow Step 2 above

### Token Not Working After Deployment

**Check:**
1. Did you add the env var to Vercel?
2. Did you redeploy after adding it?
3. Is the variable name correct? (`VITE_GOOGLE_SHEETS_SECRET_TOKEN`)

---

## Security Best Practices

✅ **DO:**
- Use a long, random token (32+ characters)
- Use different tokens for dev/staging/production
- Keep tokens secret (never commit to git)
- Rotate tokens periodically (every 90 days)
- Use strong, unique tokens

❌ **DON'T:**
- Share tokens in chat/email
- Commit tokens to git (they're in .gitignore)
- Use simple passwords as tokens
- Reuse tokens across projects
- Leave tokens in code comments

---

## What's Protected Now?

✅ **Protected:**
- Writing data to Google Sheets (requires token)
- Modifying existing records (requires token)
- Creating new records (requires token)

✅ **Still Public (Safe):**
- Reading sheet status (GET request)
- Health checks

---

## Next Steps

After securing your Google Apps Script, consider:

1. **Restrict CORS** - Update your API endpoints (see SECURITY_AUDIT.md)
2. **Implement real authentication** - Add user login system
3. **Add rate limiting** - Prevent abuse
4. **Monitor access** - Check Apps Script execution logs

---

## Need Help?

If you run into issues:
1. Check Apps Script execution logs (Executions tab)
2. Check browser console for errors
3. Verify token matches exactly in both places
4. Make sure you redeployed the Apps Script after changes

---

**🎉 You're now protected!** Your Google Sheet can only be modified by requests with the correct secret token.













