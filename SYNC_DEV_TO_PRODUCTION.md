# Syncing Dev to Production

## Current Status

Both `lecrm-dev.vercel.app` and `lecrm.vercel.app` should now be synced to the same codebase.

**Last Sync:** Both remotes are at commit `d8905b0` - "Remove duplicate Neglected Accounts section and add users migration script"

## If You See Differences

If you notice differences between dev and production, it could be:

1. **Vercel hasn't redeployed yet** - Wait a few minutes for automatic deployment
2. **Cached builds** - Clear browser cache or do a hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
3. **Environment variables** - Check that both Vercel projects have the same environment variables set

## Manual Sync Steps

If you need to manually sync production to match dev:

```bash
# 1. Make sure you're on main branch
git checkout main

# 2. Fetch latest from dev
git fetch dev

# 3. Merge dev/main into main (if needed)
git merge dev/main

# 4. Push to production
git push production main

# 5. Also push to dev (to keep them in sync)
git push dev main
```

## Key Files That Should Match

These files should be identical between dev and production:

- `src/pages/Dashboard.jsx` - Dashboard layout and order
- `src/pages/Reports.jsx` - Reports functionality
- `src/components/ImportLeadsDialog.jsx` - Import dialog
- `src/api/base44Client.js` - API client
- All files in `api/data/` - API endpoints

## Verification

After syncing, verify both sites show:
- ✅ Same dashboard order (Neglected Accounts before At Risk Accounts)
- ✅ Same import functionality
- ✅ Same reports behavior
- ✅ Same API endpoints

