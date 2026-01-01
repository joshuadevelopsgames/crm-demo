# .env File vs Vercel Environment Variables

## 🎯 Quick Answer

**For local development, you need a SUBSET of what's in Vercel:**

- ✅ **VITE_*** variables (for frontend/client-side)
- ✅ **Server-side variables** (only if testing API routes locally with `vercel dev`)

**Vercel needs ALL variables** (both VITE_* and server-side).

---

## 📋 What Goes Where

### ✅ Required in `.env` (Local Development)

#### For Frontend Development (`npm run dev`)
These are the **minimum** needed to run the frontend locally:

```bash
# Supabase (Client-Side)
VITE_SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### For Full Local Testing (Frontend + API Routes with `vercel dev`)
If you want to test API routes locally, add these:

```bash
# Supabase (Server-Side - for API routes)
SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here  # Same as VITE_SUPABASE_ANON_KEY

# Bug Report Feature (Optional - only if testing bug reports locally)
BUG_REPORT_EMAIL=jrsschroeder@gmail.com
EMAIL_SERVICE=resend
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=your-email@domain.com

# Google Sheets (Optional - only if testing Google Sheets locally)
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/...
GOOGLE_SHEETS_SECRET_TOKEN=your-token
```

---

### ✅ Required in Vercel (Production/Deployment)

**Vercel needs ALL of these:**

#### Supabase Keys
```bash
SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co  # Same as SUPABASE_URL
VITE_SUPABASE_ANON_KEY=your-anon-key-here  # Same as SUPABASE_ANON_KEY
```

#### Bug Report Keys
```bash
BUG_REPORT_EMAIL=jrsschroeder@gmail.com
EMAIL_SERVICE=resend
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=your-email@domain.com
```

#### Google Sheets Keys (if using)
```bash
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/...
GOOGLE_SHEETS_SECRET_TOKEN=your-token
```

---

## 🔍 Key Differences

| Variable | `.env` (Local) | Vercel | Why? |
|----------|----------------|--------|------|
| `VITE_SUPABASE_URL` | ✅ **Required** | ✅ **Required** | Frontend needs this |
| `VITE_SUPABASE_ANON_KEY` | ✅ **Required** | ✅ **Required** | Frontend needs this |
| `SUPABASE_URL` | ⚠️ Only if testing API | ✅ **Required** | API routes need this |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Only if testing API | ✅ **Required** | API routes need this |
| `SUPABASE_ANON_KEY` | ⚠️ Only if testing API | ✅ **Required** | API token verification |
| `BUG_REPORT_EMAIL` | ⚠️ Optional | ✅ **Required** | Bug report feature |
| `RESEND_API_KEY` | ⚠️ Optional | ✅ **Required** | Bug report emails |
| `GOOGLE_SHEETS_*` | ⚠️ Optional | ✅ **Required** | If using Google Sheets |

---

## 🎯 Recommended `.env` Setup

### Minimal (Frontend Only)
If you only develop the frontend locally:

```bash
# Minimum for frontend development
VITE_SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Full (Frontend + API Testing)
If you want to test everything locally:

```bash
# Frontend
VITE_SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend API (for testing with vercel dev)
SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Bug Reports (optional)
BUG_REPORT_EMAIL=jrsschroeder@gmail.com
EMAIL_SERVICE=resend
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=your-email@domain.com

# Google Sheets (optional)
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/...
GOOGLE_SHEETS_SECRET_TOKEN=your-token
```

---

## 🚀 How to Test Locally

### Option 1: Frontend Only (`npm run dev`)
```bash
# Only needs VITE_* variables in .env
npm run dev
```
- ✅ Frontend works
- ❌ API routes won't work (they're on Vercel)

### Option 2: Full Stack (`vercel dev`)
```bash
# Needs all variables in .env
vercel dev
```
- ✅ Frontend works
- ✅ API routes work locally
- ✅ Full testing environment

---

## 📝 Summary

### `.env` File (Local)
- **Minimum:** Just `VITE_*` variables for frontend
- **Recommended:** Add server-side variables if testing API routes
- **Optional:** Add email/Google variables if testing those features

### Vercel (Production)
- **Required:** ALL variables (both VITE_* and server-side)
- **Why:** Vercel runs both frontend and API routes

---

## ✅ Checklist

### For `.env` (Local Development)
- [ ] `VITE_SUPABASE_URL` ✅ (required)
- [ ] `VITE_SUPABASE_ANON_KEY` ✅ (required)
- [ ] `SUPABASE_URL` ⚠️ (only if testing API)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (only if testing API)
- [ ] `SUPABASE_ANON_KEY` ⚠️ (only if testing API)
- [ ] `BUG_REPORT_EMAIL` ⚠️ (optional)
- [ ] `RESEND_API_KEY` ⚠️ (optional)
- [ ] `GOOGLE_SHEETS_*` ⚠️ (optional)

### For Vercel (Production)
- [ ] `SUPABASE_URL` ✅
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ✅
- [ ] `SUPABASE_ANON_KEY` ✅
- [ ] `VITE_SUPABASE_URL` ✅
- [ ] `VITE_SUPABASE_ANON_KEY` ✅
- [ ] `BUG_REPORT_EMAIL` ✅
- [ ] `EMAIL_SERVICE` ✅
- [ ] `RESEND_API_KEY` ✅
- [ ] `RESEND_FROM_EMAIL` ✅
- [ ] `GOOGLE_SHEETS_WEB_APP_URL` ✅ (if using)
- [ ] `GOOGLE_SHEETS_SECRET_TOKEN` ✅ (if using)

---

## 🔧 Quick Setup

### Step 1: Update `.env` (Minimum Required)
```bash
VITE_SUPABASE_URL=https://nyyukbaodgzyvcccpojn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 2: Update Vercel (All Required)
Add all variables from the checklist above to Vercel Dashboard.

### Step 3: Test
- Local: `npm run dev` (frontend only)
- Or: `vercel dev` (full stack)
- Production: Deploy to Vercel

