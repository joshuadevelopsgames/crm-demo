# 🔒 Production Hook Security Update

## What Changed

The git pre-push hook has been updated to be **more secure** and prevent AI assistants from bypassing it.

### Before (Less Secure)
- Hook checked for `PRODUCTION_BYPASS=FLASH25` environment variable
- AI assistants could set this variable in their commands
- Example: `PRODUCTION_BYPASS=FLASH25 git push production main`

### After (More Secure)
- Hook **ONLY** checks for `FLASH25` in the commit message
- Environment variables are **NOT accepted**
- AI assistants cannot modify existing commit messages
- You must explicitly include `FLASH25` when you commit

## How It Works Now

### Normal Workflow (Recommended)
```bash
./scripts/sync-to-production.sh
```

### Emergency Bypass (New Method)
```bash
# Step 1: Include FLASH25 in your commit message
git commit -m "Your changes FLASH25"

# Step 2: Push to production
git push production main
```

The hook will:
1. Check the most recent commit message
2. Look for "FLASH25" (case-insensitive)
3. Allow the push if found, block if not

## Why This Is More Secure

1. **AI assistants cannot modify commit messages** - Once a commit is made, the message is immutable
2. **You must explicitly include the codeword** - It's visible in your commit message
3. **No environment variable bypass** - Prevents automated bypass attempts
4. **Audit trail** - The codeword is permanently recorded in git history

## Installing the Hook

The hook is already installed in this repository. To install in other repositories:

```bash
# Option 1: Use the install script
./scripts/install-production-hook.sh

# Option 2: Manual installation
# Copy .git/hooks/pre-push to each repository's .git/hooks/ directory
```

## Testing

```bash
# This should be BLOCKED:
git push production main

# This should WORK:
git commit -m "Test changes FLASH25"
git push production main
```

## Important Notes

- ⚠️ The hook only checks the **most recent commit** message
- ⚠️ The codeword must be in the commit message when you commit (not added later)
- ⚠️ If you want to use emergency bypass, include FLASH25 in your commit message
- ✅ This prevents AI assistants from bypassing the protection
- ✅ You maintain full control over when emergency bypass is used

## For AI Assistants

**I will NEVER:**
- Set `PRODUCTION_BYPASS=FLASH25` in commands
- Try to bypass the hook using environment variables
- Run `./scripts/sync-to-production.sh` unless you explicitly say FLASH25 in your request
- Push to production without explicit user request with codeword

**I will ONLY:**
- Use the normal workflow: `./scripts/sync-to-production.sh` **IF AND ONLY IF** you explicitly include FLASH25 in your request
- Push to production if you explicitly include FLASH25 in your commit message (for emergency bypass)
- Wait for you to provide the codeword in your request before running any production deployment commands

**Example of what I need to see:**
- ✅ "push to production FLASH25" - I will run the script
- ✅ "deploy FLASH25" - I will run the script  
- ❌ "push to production" - I will NOT run the script (no codeword)
- ❌ "deploy" - I will NOT run the script (no codeword)

