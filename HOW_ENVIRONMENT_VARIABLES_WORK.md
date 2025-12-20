# How Environment Variables Work: Local vs Vercel vs Supabase

## 🔑 The Key Concept

**Environment variables are configured separately in each environment:**
- **Local development** → Uses `.env` file on your computer
- **Vercel (hosting)** → Uses environment variables set in Vercel Dashboard
- **Supabase** → Doesn't need your env vars (it's just a database service)

---

## 📍 Where Environment Variables Live

### 1. Local Development (Your Computer)
**Location:** `.env` file in your project folder

```
/Users/joshua/LECRM/.env
```

**What's in it:**
```bash
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_SUPABASE_URL=https://vtnaqheddlvnlcgwwssc.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
# etc...
```

**When it's used:**
- When you run `npm run dev` locally
- Only works on your computer
- Not sent to GitHub (it's in `.gitignore`)

---

### 2. Vercel (Your Hosting Platform)
**Location:** Vercel Dashboard → Project Settings → Environment Variables

**How to set them:**
1. Go to: https://vercel.com/dashboard
2. Click your project (e.g., `lecrm`, `lecrm-dev`, `lecrm-stg`)
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Enter:
   - **Key:** `SUPABASE_URL`
   - **Value:** `https://vtnaqheddlvnlcgwwssc.supabase.co`
   - **Environment:** Select Production, Preview, Development
6. Click **"Save"**
7. **Redeploy** the project (important!)

**What Vercel does:**
- Stores these variables securely in their system
- Injects them into your app when it builds/deploys
- Makes them available as `process.env.VARIABLE_NAME` in your code

**Important:** 
- These are **separate** from your local `.env` file
- You must add them manually in Vercel Dashboard
- They're not automatically copied from your local `.env`

---

### 3. Supabase (Database Service)
**Location:** Supabase Dashboard → Settings → API

**What Supabase provides:**
- Your **Project URL** (e.g., `https://vtnaqheddlvnlcgwwssc.supabase.co`)
- Your **API Keys** (anon key, service role key)

**What you do:**
- Copy these values from Supabase Dashboard
- Add them to:
  1. Your local `.env` file (for local dev)
  2. Vercel Environment Variables (for hosting)

**Important:**
- Supabase doesn't "run" your software
- Supabase is just a database service
- Your app (hosted on Vercel) connects to Supabase using the keys

---

## 🔄 How It All Works Together

### When You Develop Locally:
```
Your Computer
├── .env file (has all the keys)
├── npm run dev
└── App reads from .env file
    └── Connects to Supabase using keys from .env
```

### When Vercel Deploys Your App:
```
Vercel Servers
├── Gets code from GitHub (no .env file!)
├── Reads environment variables from Vercel Dashboard
├── Builds your app
└── App uses variables from Vercel (not from .env)
    └── Connects to Supabase using keys from Vercel
```

### The Flow:
```
1. You push code to GitHub (no secrets in code ✅)
2. Vercel pulls code from GitHub
3. Vercel reads environment variables from Vercel Dashboard
4. Vercel builds your app with those variables
5. Your app runs on Vercel servers
6. App connects to Supabase using the keys from Vercel
```

---

## 🎯 Why This Design?

### Security Benefits:
1. **Secrets never in code** - They're stored separately
2. **Different keys per environment** - Dev, staging, production can have different keys
3. **Easy to rotate** - Change keys in Vercel without touching code
4. **Access control** - Only you can see/edit Vercel environment variables

### Flexibility:
- Local dev uses local `.env`
- Vercel uses Vercel's environment variables
- Each environment is independent

---

## 📋 What You Need to Do

### ✅ Already Done (Local):
- [x] `.env` file exists locally
- [x] Environment variables set in `.env`
- [x] Local development works

### ⚠️ Need to Do (Vercel):
You need to add the same environment variables to **each Vercel project**:

**Required Variables:**
1. `SUPABASE_URL` - Your Supabase project URL
2. `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
3. `GOOGLE_SHEETS_WEB_APP_URL` - Your Google Apps Script URL
4. `GOOGLE_SHEETS_SECRET_TOKEN` - Your secret token
5. `VITE_GOOGLE_CLIENT_ID` - Your Google OAuth Client ID (optional)
6. `VITE_SUPABASE_URL` - Same as SUPABASE_URL (optional)
7. `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key (optional)

**For each Vercel project:**
- `lecrm-dev` (development)
- `lecrm-stg` (staging)
- `lecrm` (production)

---

## 🛠️ Step-by-Step: Add Variables to Vercel

### 1. Get Your Values
Copy these from your local `.env` file or from service dashboards:
- Supabase keys: https://supabase.com/dashboard → Settings → API
- Google OAuth: https://console.cloud.google.com → APIs & Services → Credentials

### 2. Add to Vercel
For **each** Vercel project:

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Click project: `lecrm`, `lecrm-dev`, or `lecrm-stg`

2. **Settings → Environment Variables**

3. **Add each variable:**
   - Click **"Add New"**
   - Enter **Key** and **Value**
   - Select **Environments** (Production, Preview, Development)
   - Click **"Save"**

4. **Repeat for all variables**

5. **Redeploy:**
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**

### 3. Verify It Works
After redeploying, your app should work because:
- Vercel now has all the environment variables
- Your code reads `process.env.VARIABLE_NAME`
- Vercel injects the values during build

---

## 🔍 How to Check If Variables Are Set in Vercel

### Method 1: Vercel Dashboard
1. Go to your project in Vercel
2. Settings → Environment Variables
3. You should see all your variables listed

### Method 2: Check Build Logs
1. Go to Deployments → Latest deployment
2. Click on the deployment
3. Check build logs - should not show errors about missing env vars

### Method 3: Test Your App
- If your app works on Vercel (connects to Supabase, Google Sheets, etc.)
- Then environment variables are set correctly ✅

---

## ❓ Common Questions

### Q: Why doesn't Vercel automatically use my `.env` file?
**A:** Security! Your `.env` file is local and not in GitHub. Vercel can't access files on your computer. You must manually add them to Vercel Dashboard.

### Q: Do I need to add variables to all 3 Vercel projects?
**A:** Yes! Each project (dev, staging, production) is independent. You need to add variables to each one separately.

### Q: Can I use different keys for dev vs production?
**A:** Yes! That's actually a best practice. You can:
- Use different Supabase projects per environment
- Use different Google OAuth clients per environment
- Use different secret tokens per environment

### Q: What if I forget to add a variable to Vercel?
**A:** Your app will fail! You'll see errors like:
- "Supabase environment variables not configured"
- "Google Sheets Web App URL not configured"
- Connection errors, authentication failures, etc.

### Q: Do I need to redeploy after adding variables?
**A:** Yes! Environment variables are injected during the build process. You must redeploy for them to take effect.

---

## 🎯 Summary

**The Answer to Your Question:**

> "How are Vercel and Supabase running the software if all of the keys are local?"

**Answer:**
1. **Vercel doesn't use your local `.env` file**
   - You must add environment variables in Vercel Dashboard
   - Vercel stores them securely and injects them during build

2. **Supabase doesn't "run" your software**
   - Supabase is just a database service
   - Your app (on Vercel) connects to Supabase using the keys you set in Vercel

3. **The flow:**
   - Local dev → Uses `.env` file
   - Vercel → Uses Vercel Dashboard environment variables
   - Both connect to Supabase using the same keys (but stored in different places)

**Bottom Line:** You need to configure environment variables in **three places**:
1. ✅ Local `.env` file (for local development) - **Already done**
2. ⚠️ Vercel Dashboard (for hosting) - **Need to do this**
3. ✅ Supabase Dashboard (to get the keys) - **Already done**

---

## 🚀 Quick Action Items

1. **Check Vercel Dashboard:**
   - Go to each project (lecrm, lecrm-dev, lecrm-stg)
   - Settings → Environment Variables
   - See what's already there

2. **Add Missing Variables:**
   - Compare with your local `.env` file
   - Add any missing variables to Vercel

3. **Redeploy:**
   - After adding variables, redeploy each project

4. **Test:**
   - Visit your Vercel URLs
   - Make sure everything works

---

**Need help?** Check your Vercel Dashboard to see which variables are already set and which ones are missing!

