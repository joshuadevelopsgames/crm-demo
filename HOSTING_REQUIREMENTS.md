# Hosting Requirements for LECRM

This document outlines all the technical requirements needed to host the LECRM website.

## 🎯 Overview

LECRM is a **React-based Single Page Application (SPA)** that requires:
- **Frontend hosting** (static site hosting)
- **Serverless functions** (for API endpoints)
- **Database** (Supabase PostgreSQL)
- **Third-party integrations** (Google Sheets, Google OAuth)

---

## 📋 Core Technology Stack

### Frontend Technologies
- **JavaScript/TypeScript**: ES6+ JavaScript
- **React 18.2.0**: UI framework
- **React Router v6**: Client-side routing
- **Vite 5.0.8**: Build tool and dev server
- **Node.js**: Required for build process (v16+ recommended)

### Styling & UI
- **Tailwind CSS 3.3.6**: Utility-first CSS framework
- **PostCSS**: CSS processing
- **Radix UI**: Accessible component primitives
- **shadcn/ui**: Component library built on Radix UI

### State Management & Data Fetching
- **@tanstack/react-query 5.12.0**: Server state management
- **React Context**: Client state management

### Build Output
- **Static HTML/CSS/JS files** in `dist/` directory
- **ES Modules** (ESM) format
- **No server-side rendering** (pure client-side React app)

---

## 🖥️ Hosting Platform Requirements

### Minimum Requirements
1. **Static Site Hosting**
   - Must serve static files (HTML, CSS, JS)
   - Support for client-side routing (SPA)
   - HTTPS required

2. **Serverless Functions Support**
   - Node.js runtime (v16+ or v18+)
   - Support for ES modules
   - API routes/endpoints capability
   - Environment variable support

3. **Build Process**
   - Ability to run `npm install` and `npm run build`
   - Node.js build environment

### Recommended Platforms
- ✅ **Vercel** (currently used) - Full support for all features
- ✅ **Netlify** - Similar capabilities to Vercel
- ✅ **AWS Amplify** - Supports React + serverless functions
- ✅ **Cloudflare Pages** - Static hosting + Workers for API
- ⚠️ **GitHub Pages** - Static only, no serverless functions
- ⚠️ **Traditional hosting** - Requires separate API server setup

---

## 🔧 Required Hosting Features

### 1. Static File Serving
- Serve files from `dist/` directory after build
- Support for SPA routing (redirect all routes to `index.html`)
- Gzip/Brotli compression
- CDN capabilities

### 2. Serverless Functions/API Routes
The app requires serverless functions for:

**API Endpoints:**
- `/api/data/*` - Data CRUD operations (accounts, contacts, estimates, jobsites, scorecards, templates)
- `/api/google-sheets/write` - Google Sheets write proxy
- `/api/google-auth/token` - Google OAuth token handling

**Function Requirements:**
- Node.js runtime
- Environment variable access
- CORS support
- Request/response handling
- Timeout: 5 minutes (for large data operations)

### 3. Environment Variables
Host must support environment variables (server-side and client-side):

**Server-Side Variables** (not exposed to browser):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `GOOGLE_SHEETS_WEB_APP_URL` - Google Apps Script Web App URL
- `GOOGLE_SHEETS_SECRET_TOKEN` - Secret token for Google Sheets API

**Client-Side Variables** (exposed to browser, prefixed with `VITE_`):
- `VITE_SUPABASE_URL` - Supabase project URL (optional)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (optional)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID

### 4. Build Configuration
**Build Command:**
```bash
npm install && npm run build
```

**Output Directory:**
```
dist/
```

**Node Version:**
- Node.js 16.x or higher (18.x recommended)

---

## 🗄️ Database Requirements

### Supabase PostgreSQL Database

**Required Tables:**
- `accounts` - Account/company data
- `contacts` - Contact information
- `estimates` - Estimate records
- `jobsites` - Jobsite data
- `scorecards` - Scorecard responses
- `templates` - Scorecard templates
- `profiles` - User profiles (for authentication)

**Database Features Needed:**
- PostgreSQL database
- Row Level Security (RLS) policies
- REST API access
- Real-time subscriptions (optional)

**Setup:**
1. Create Supabase project
2. Run SQL migrations (see `add_profiles_table.sql` and `SUPABASE_SETUP.md`)
3. Configure RLS policies
4. Get API credentials

---

## 🔌 Third-Party Integrations

### 1. Google Sheets Integration
**Required:**
- Google Apps Script Web App deployed
- Google Sheets API access
- Secret token authentication

**Setup:**
- Deploy Google Apps Script (see `google-apps-script.js`)
- Configure Web App URL
- Set secret token in Apps Script Properties
- Add environment variables to hosting platform

### 2. Google OAuth
**Required:**
- Google Cloud Project
- OAuth 2.0 Client ID
- Authorized redirect URIs configured

**Setup:**
- Create OAuth credentials in Google Cloud Console
- Add authorized redirect URIs
- Configure `VITE_GOOGLE_CLIENT_ID` environment variable

---

## 📦 Dependencies & Build Tools

### Runtime Dependencies
- React 18.2.0
- React DOM 18.2.0
- React Router DOM 6.20.0
- @tanstack/react-query 5.12.0
- @supabase/supabase-js 2.87.1
- date-fns 2.30.0
- xlsx 0.18.5
- framer-motion 12.23.24
- lucide-react 0.294.0
- react-hot-toast 2.6.0

### Build Dependencies
- Vite 5.0.8
- @vitejs/plugin-react 4.2.1
- Tailwind CSS 3.3.6
- PostCSS 8.4.32
- Autoprefixer 10.4.16

### Build Process
1. Install dependencies: `npm install`
2. Build static files: `npm run build`
3. Output: `dist/` directory with optimized production build

---

## 🌐 Network & Security Requirements

### CORS Configuration
The API endpoints require CORS headers for:
- `https://lecrm.vercel.app` (production)
- `https://lecrm-stg.vercel.app` (staging)
- `https://lecrm-dev.vercel.app` (development)
- `http://localhost:5173` (local dev)
- `http://localhost:3000` (local dev)

### Security Requirements
- HTTPS required (SSL/TLS certificate)
- Secure environment variable storage
- CORS protection on API endpoints
- Secret token authentication for Google Sheets API

### Domain Configuration
- Custom domain support (optional)
- SSL certificate (automatic on most platforms)
- DNS configuration for custom domains

---

## 📱 Mobile App Support (Optional)

The app can be built as native mobile apps using **Capacitor**:

**Requirements:**
- iOS: Xcode (macOS only)
- Android: Android Studio
- Capacitor CLI

**Note:** Mobile app builds are separate from web hosting. The web app remains unchanged.

---

## ✅ Hosting Checklist

### Pre-Deployment
- [ ] Node.js 16+ available in build environment
- [ ] Supabase project created and configured
- [ ] Google Apps Script Web App deployed
- [ ] Google OAuth credentials created
- [ ] Environment variables configured
- [ ] Database tables created and migrated

### Platform Configuration
- [ ] Build command: `npm install && npm run build`
- [ ] Output directory: `dist/`
- [ ] Node version: 16.x or 18.x
- [ ] SPA routing configured (redirect to index.html)
- [ ] Serverless functions enabled
- [ ] Environment variables added

### Post-Deployment
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] API endpoints responding
- [ ] Database connection working
- [ ] Google Sheets integration tested
- [ ] OAuth flow working

---

## 🚀 Quick Start for New Hosting Platform

1. **Connect Repository**
   - Link GitHub/GitLab repository
   - Configure build settings

2. **Set Environment Variables**
   - Add all required server-side variables
   - Add all required client-side variables (VITE_ prefix)

3. **Configure Build**
   - Build command: `npm install && npm run build`
   - Output directory: `dist/`
   - Node version: 18.x

4. **Deploy**
   - Trigger initial deployment
   - Verify build succeeds
   - Test all functionality

---

## 📊 Resource Requirements

### Build Time
- Initial build: ~2-5 minutes
- Subsequent builds: ~1-3 minutes

### Runtime
- **Static files**: Minimal (CDN cached)
- **Serverless functions**: 
  - Memory: 512MB - 1GB recommended
  - Timeout: 5 minutes (for large data operations)
  - Cold start: ~1-2 seconds

### Storage
- **Code repository**: ~50-100 MB
- **Build artifacts**: ~5-10 MB (compressed)
- **Database**: Depends on data volume (Supabase managed)

---

## 🔍 Testing Your Hosting Setup

### 1. Build Test
```bash
npm install
npm run build
# Should create dist/ directory with no errors
```

### 2. API Test
Test serverless functions are working:
```bash
curl https://your-domain.com/api/data/accounts
```

### 3. Frontend Test
- Visit your domain
- Check browser console for errors
- Test login/authentication
- Test data loading

### 4. Integration Test
- Test Google Sheets write functionality
- Test OAuth login flow
- Test database CRUD operations

---

## 📚 Additional Documentation

- **Setup Guide**: See `SETUP.md`
- **Supabase Setup**: See `SUPABASE_SETUP.md`
- **Google Sheets Setup**: See `GOOGLE_SHEETS_QUICK_SETUP.md`
- **Google OAuth Setup**: See `HOW_TO_GET_GOOGLE_OAUTH_CREDENTIALS.md`
- **Environment Variables**: See `ENV_VAR_SETUP.md`
- **Security Setup**: See `SECURITY_SETUP_GUIDE.md`

---

## 🆘 Troubleshooting

### Build Fails
- Check Node.js version (must be 16+)
- Verify all dependencies in `package.json`
- Check for missing environment variables

### API Endpoints Not Working
- Verify serverless functions are enabled
- Check environment variables are set
- Verify CORS configuration
- Check function logs for errors

### Database Connection Issues
- Verify Supabase credentials
- Check database tables exist
- Verify RLS policies are configured
- Test Supabase connection directly

### Google Integration Issues
- Verify Google Apps Script is deployed
- Check secret token matches
- Verify OAuth redirect URIs
- Check Google Cloud Console for API quotas

---

**Last Updated**: Based on current codebase analysis
**Recommended Platform**: Vercel (currently configured and working)

