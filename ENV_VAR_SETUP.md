# Environment Variable Setup for All Environments

## Quick Answer

**Yes, you need to add `VITE_GOOGLE_SHEETS_SECRET_TOKEN` to each Vercel project separately.**

---

## Your Three Environments

| Environment | Vercel Project | GitHub Repo | URL |
|------------|---------------|-------------|-----|
| **Dev** | `lecrm-dev` | `LECRM-dev` | `lecrm-dev.vercel.app` |
| **Staging** | `lecrm-stg` | `LECRM-staging` | `lecrm-stg.vercel.app` |
| **Production** | `lecrm` | `LECRM` | `lecrm.vercel.app` |

---

## Setup Steps

### 1. Local Development (.env file)

Add to your `.env` file (already done if you followed the guide):
```bash
VITE_GOOGLE_SHEETS_SECRET_TOKEN=your-token-here
```

### 2. Vercel - Dev Project

1. Go to: https://vercel.com/dashboard
2. Click **`lecrm-dev`** project
3. Settings → **Environment Variables**
4. Add:
   - **Key:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN`
   - **Value:** Your token
   - **Environment:** ✅ Production ✅ Preview ✅ Development
5. **Save**
6. **Redeploy** (Deployments → Redeploy)

### 3. Vercel - Staging Project

1. Go to: https://vercel.com/dashboard
2. Click **`lecrm-stg`** project
3. Settings → **Environment Variables**
4. Add:
   - **Key:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN`
   - **Value:** Your token (same one)
   - **Environment:** ✅ Production ✅ Preview ✅ Development
5. **Save**
6. **Redeploy**

### 4. Vercel - Production Project

1. Go to: https://vercel.com/dashboard
2. Click **`lecrm`** project
3. Settings → **Environment Variables**
4. Add:
   - **Key:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN`
   - **Value:** Your token (same one)
   - **Environment:** ✅ Production ✅ Preview ✅ Development
5. **Save**
6. **Redeploy**

---

## Same Token vs Different Tokens?

### ✅ Same Token (Recommended)

**Use the same token for all environments if:**
- You're using the same Google Sheet for all environments
- You want simpler management
- You're okay with all environments having the same access level

**Pros:**
- ✅ Easier to manage (one token)
- ✅ Less configuration
- ✅ Works immediately

**Cons:**
- ⚠️ If one environment is compromised, all are compromised
- ⚠️ Can't restrict dev/staging from accessing production data

### 🔒 Different Tokens (More Secure)

**Use different tokens if:**
- You want to isolate environments
- You have separate Google Sheets per environment
- You want better security boundaries

**Pros:**
- ✅ Better security isolation
- ✅ Can revoke access per environment
- ✅ More granular control

**Cons:**
- ⚠️ More tokens to manage
- ⚠️ Need to update Google Apps Script to accept multiple tokens (or use separate sheets)

---

## Quick Checklist

- [ ] Token generated
- [ ] Token set in Google Apps Script Properties
- [ ] Token added to local `.env` file
- [ ] Token added to Vercel **dev** project
- [ ] Token added to Vercel **staging** project
- [ ] Token added to Vercel **production** project
- [ ] All projects redeployed
- [ ] Tested import in each environment

---

## Verify It's Working

After adding to all environments, test each:

1. **Dev:** `https://lecrm-dev.vercel.app` → Try importing data
2. **Staging:** `https://lecrm-stg.vercel.app` → Try importing data
3. **Production:** `https://lecrm.vercel.app` → Try importing data

All should work without "Unauthorized" errors!

---

## Pro Tip: Bulk Add in Vercel

If you want to add the same variable to multiple projects quickly:

1. Add it to one project first
2. Copy the exact key and value
3. Use Vercel's bulk operations (if available) or manually add to each

**Note:** Vercel doesn't have a "copy env vars between projects" feature, so you'll need to add it manually to each project.













