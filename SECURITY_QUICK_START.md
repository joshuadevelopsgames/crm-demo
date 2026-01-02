# 🔒 Quick Start: Secure Your Google Apps Script

## 5-Minute Setup

### 1. Generate Token
```bash
# Mac/Linux:
openssl rand -base64 32

# Or use: https://www.lastpass.com/features/password-generator
# (32+ characters, include symbols)
```

### 2. Set in Apps Script
1. Open Apps Script → ⚙️ Project Settings
2. Script Properties → Add script property
3. **Property:** `SECRET_TOKEN`
4. **Value:** Your generated token
5. Save

### 3. Add to .env
```bash
VITE_GOOGLE_SHEETS_SECRET_TOKEN=your-token-here
```

### 4. Add to Vercel
1. Vercel Dashboard → Settings → Environment Variables
2. **Key:** `VITE_GOOGLE_SHEETS_SECRET_TOKEN`
3. **Value:** Same token
4. Save & Redeploy

### 5. Redeploy Apps Script
1. Deploy → Manage deployments
2. Edit → New version → Deploy

✅ **Done!** Your sheet is now protected.

---

## Verify It Works

Visit your Web App URL - you should see:
```json
{
  "security": {
    "authenticationConfigured": true
  }
}
```

---

**Full guide:** See `SECURITY_SETUP_GUIDE.md`















