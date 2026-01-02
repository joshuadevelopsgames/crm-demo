#!/bin/bash
# Safely syncs staging → production
# This ensures production gets the exact code from staging

set -e

echo "🚀 Syncing staging → production..."
echo ""

# Fetch latest from staging
echo "📥 Fetching latest from staging repo..."
git fetch staging main

# Check if production is behind staging
LOCAL=$(git rev-parse production/main 2>/dev/null || echo "")
REMOTE=$(git rev-parse staging/main 2>/dev/null || echo "")

if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
    echo "⚠️  Could not determine sync status, proceeding anyway..."
elif [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Production is already up to date with staging"
    echo ""
    read -p "Force sync anyway? (y/n): " force_sync
    if [ "$force_sync" != "y" ] && [ "$force_sync" != "Y" ]; then
        echo "❌ Sync cancelled"
        exit 0
    fi
fi

# Show what will be deployed
echo ""
echo "📊 Changes to deploy to PRODUCTION:"
if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    git log production/main..staging/main --oneline || git log staging/main --oneline -10
else
    echo "   (showing last 10 commits from staging)"
    git log staging/main --oneline -10
fi

echo ""
echo "⚠️  WARNING: This will deploy to PRODUCTION (lecrm.vercel.app)"
read -p "⚠️  Type 'DEPLOY' to confirm: " confirm
if [ "$confirm" != "DEPLOY" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Verify staging and dev are in sync (optional check)
echo ""
echo "🔍 Verifying staging matches dev..."
git fetch dev main
STAGING_HASH=$(git rev-parse staging/main 2>/dev/null || echo "")
DEV_HASH=$(git rev-parse dev/main 2>/dev/null || echo "")

if [ -n "$STAGING_HASH" ] && [ -n "$DEV_HASH" ] && [ "$STAGING_HASH" != "$DEV_HASH" ]; then
    echo "⚠️  WARNING: Staging and dev are not in sync!"
    echo "   Staging: $(git log -1 --oneline staging/main)"
    echo "   Dev:     $(git log -1 --oneline dev/main)"
    echo ""
    read -p "   Continue anyway? (type 'yes'): " continue_anyway
    if [ "$continue_anyway" != "yes" ]; then
        echo "❌ Deployment cancelled - sync dev → staging first"
        exit 1
    fi
fi

# Push to production (bypasses pre-push hook by using refspec)
echo ""
echo "🚀 Deploying to production..."
git push production staging/main:main

echo ""
echo "✅ Production deployed! Vercel will auto-deploy to lecrm.vercel.app"
echo ""
echo "📊 Next steps:"
echo "   1. Verify deployment: https://lecrm.vercel.app"
echo "   2. Check for new SQL migrations that need to be applied to production Supabase"
echo "   3. Monitor for any issues"

