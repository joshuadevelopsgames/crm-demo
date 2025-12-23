# Environment Variable Security Guide

## ⚠️ Security Considerations

The **Supabase Service Role Key** has **full admin access** to your database. It can:
- Bypass Row Level Security (RLS) policies
- Read, write, and delete any data
- Modify database schema
- Access all tables and data

**Treat it like a password!**

---

## 🔒 Security Best Practices

### ❌ NOT Recommended: Storing in Shell Profile

**Why it's risky:**
- Visible in plain text in `~/.zshrc` or `~/.bash_profile`
- Could be accidentally shared if you sync your dotfiles
- Visible to anyone with access to your user account
- Could be exposed in shell history
- If your machine is compromised, the key is accessible

### ✅ Recommended: Use a `.env` File (Project-Specific)

**Why it's better:**
- Stays in your project directory (not system-wide)
- Can be easily excluded from git (via `.gitignore`)
- Only loaded when you're working on this project
- Less likely to be accidentally shared

**Setup:**

1. Create a `.env` file in your project root:
   ```bash
   cd /Users/joshua/LECRM
   touch .env
   ```

2. Add your credentials:
   ```bash
   SUPABASE_URL=https://vtnaqheddlvnlcgwwssc.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. Make sure `.env` is in `.gitignore` (it should already be)

4. Update the comparison script to load from `.env` (we'll do this)

---

## 🛡️ Alternative: Temporary Session Only

**Safest option for occasional use:**

Only set the variables when you need to run the script, then unset them:

```bash
# Set them
export SUPABASE_URL="https://vtnaqheddlvnlcgwwssc.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Run your script
npm run compare:estimates

# Unset them when done
unset SUPABASE_SERVICE_ROLE_KEY
unset SUPABASE_URL
```

---

## 📋 Comparison of Methods

| Method | Security | Convenience | Recommended For |
|--------|----------|-------------|-----------------|
| Shell Profile (`~/.zshrc`) | ⚠️ Low | ✅ High | ❌ Not recommended |
| `.env` file | ✅ Medium | ✅ High | ✅ Recommended |
| Temporary session | ✅ High | ⚠️ Low | ✅ Occasional use |
| Secrets manager | ✅✅ Highest | ⚠️ Medium | Enterprise/production |

---

## 🔧 Recommended Setup: `.env` File

I'll update the comparison script to automatically load from a `.env` file if it exists, making it both secure and convenient.

