# Verify All Supabase Keys - Step-by-Step Guide

## 🎯 Goal
Make sure all Supabase keys are from the **same project** and are the **correct type** (anon vs service_role).

## 📋 Current Keys in Vercel (from your screenshot)

✅ **Supabase Keys:**
1. `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin)
2. `SUPABASE_ANON_KEY` - Anon key (public)
3. `VITE_SUPABASE_URL` - Supabase project URL
4. `VITE_SUPABASE_ANON_KEY` - Anon key (for frontend)
5. `SUPABASE_URL` - Supabase project URL (for API)

✅ **Email/Bug Report Keys:**
6. `BUG_REPORT_EMAIL` - Email for bug reports
7. `RESEND_FROM_EMAIL` - Resend sender email
8. `RESEND_API_KEY` - Resend API key
9. `EMAIL_SERVICE` - Email service type

✅ **Google Keys:**
10. `GOOGLE_SHEETS_WEB_APP_URL` - Google Sheets web app URL
11. `GOOGLE_SHEETS_SECRET_TOKEN` - Google Sheets secret token

## ✅ Keys You Need (Keep These)

### Required Supabase Keys:
1. ✅ `SUPABASE_URL` - Your Supabase project URL
2. ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin, secret)
3. ✅ `SUPABASE_ANON_KEY` - Anon key (for API token verification)
4. ✅ `VITE_SUPABASE_URL` - Same as SUPABASE_URL (for frontend)
5. ✅ `VITE_SUPABASE_ANON_KEY` - Same as SUPABASE_ANON_KEY (for frontend)

### Required Email Keys (if using bug reports):
6. ✅ `BUG_REPORT_EMAIL` - Email to receive bug reports
7. ✅ `EMAIL_SERVICE` - 'resend', 'sendgrid', or 'smtp'
8. ✅ `RESEND_API_KEY` - If using Resend
9. ✅ `RESEND_FROM_EMAIL` - If using Resend

### Required Google Keys (if using Google Sheets):
10. ✅ `GOOGLE_SHEETS_WEB_APP_URL` - Google Sheets web app URL
11. ✅ `GOOGLE_SHEETS_SECRET_TOKEN` - Google Sheets secret token

## ❌ Keys You DON'T Need

**None!** All the keys you have are needed. However, some should have the **same values**:

- `VITE_SUPABASE_URL` = `SUPABASE_URL` (same value)
- `VITE_SUPABASE_ANON_KEY` = `SUPABASE_ANON_KEY` (same value)

## 🔍 Step-by-Step: Verify and Update Keys

### Step 1: Go to Supabase Dashboard

1. **Open:** https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. **Navigate to:** Settings → API

### Step 2: Get Your Keys

You'll see a table with API keys. You need:

#### A. Project URL
- **Label:** "Project URL" or "API URL"
- **Value:** `https://nyyukbaodgzyvcccpojn.supabase.co`
- **Use for:** `SUPABASE_URL` and `VITE_SUPABASE_URL`

#### B. Anon Key (Public)
- **Label:** "anon" or "anon public"
- **Role:** `anon`
- **Use for:** `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
- **Safe to expose:** ✅ Yes (it's public)

#### C. Service Role Key (Secret)
- **Label:** "service_role" or "service_role secret"
- **Role:** `service_role`
- **Use for:** `SUPABASE_SERVICE_ROLE_KEY` only
- **Safe to expose:** ❌ NO! Keep secret!

### Step 3: Verify Keys Match Project

**All keys should be from project:** `nyyukbaodgzyvcccpojn`

**Quick check:**
- URL should contain: `nyyukbaodgzyvcccpojn.supabase.co`
- Keys should decode to project: `nyyukbaodgzyvcccpojn`

### Step 4: Update Vercel Environment Variables

For **each key** in Vercel:

1. **Go to:** Vercel Dashboard → Your Project → Settings → Environment Variables
2. **Click on the key** to edit it
3. **Verify the value** matches what you got from Supabase
4. **Update if needed**
5. **Save**

### Step 5: Verify Key Types

**Check that `SUPABASE_SERVICE_ROLE_KEY` is NOT the same as `SUPABASE_ANON_KEY`:**

Run this in your terminal to check:
```bash
# Decode and check the role in each key
# Replace YOUR_SERVICE_ROLE_KEY with the actual key
echo "YOUR_SERVICE_ROLE_KEY" | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"role":"[^"]*"'
# Should show: "role":"service_role"

# Replace YOUR_ANON_KEY with the actual key  
echo "YOUR_ANON_KEY" | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"role":"[^"]*"'
# Should show: "role":"anon"
```

## 📝 Checklist

### Supabase Keys (All from same project: nyyukbaodgzyvcccpojn)
- [ ] `SUPABASE_URL` = `https://nyyukbaodgzyvcccpojn.supabase.co`
- [ ] `VITE_SUPABASE_URL` = Same as `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY` = Anon key from Supabase (role: "anon")
- [ ] `VITE_SUPABASE_ANON_KEY` = Same as `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = Service role key from Supabase (role: "service_role")
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ≠ `SUPABASE_ANON_KEY` (they must be different!)

### Email Keys (Optional - only if using bug reports)
- [ ] `BUG_REPORT_EMAIL` = Your email (e.g., jrsschroeder@gmail.com)
- [ ] `EMAIL_SERVICE` = 'resend', 'sendgrid', or 'smtp'
- [ ] `RESEND_API_KEY` = Your Resend API key (if using Resend)
- [ ] `RESEND_FROM_EMAIL` = Your sender email (if using Resend)

### Google Keys (Optional - only if using Google Sheets)
- [ ] `GOOGLE_SHEETS_WEB_APP_URL` = Your Google Apps Script web app URL
- [ ] `GOOGLE_SHEETS_SECRET_TOKEN` = Your secret token

## 🔧 Quick Fix Script

After updating keys in Vercel, you need to:

1. **Redeploy** your project
2. **Clear build cache** (optional but recommended)
3. **Test** the profile update

## ⚠️ Common Mistakes

1. ❌ Using anon key as service role key
2. ❌ Using keys from different Supabase projects
3. ❌ Not updating both `VITE_*` and non-VITE versions
4. ❌ Forgetting to redeploy after updating

## ✅ After Verification

Once all keys are correct:
1. Redeploy in Vercel
2. Test profile update
3. Should work without 401 errors!

