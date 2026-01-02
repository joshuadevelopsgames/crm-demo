#!/bin/bash
# Safely syncs dev → staging
# This ensures staging gets the exact code from dev

set -e

echo "🔄 Syncing dev → staging..."
echo ""

# Fetch latest from dev
echo "📥 Fetching latest from dev repo..."
git fetch dev main

# Check if staging is behind dev
LOCAL=$(git rev-parse staging/main 2>/dev/null || echo "")
REMOTE=$(git rev-parse dev/main 2>/dev/null || echo "")

if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
    echo "⚠️  Could not determine sync status, proceeding anyway..."
elif [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Staging is already up to date with dev"
    echo ""
    read -p "Force sync anyway? (y/n): " force_sync
    if [ "$force_sync" != "y" ] && [ "$force_sync" != "Y" ]; then
        echo "❌ Sync cancelled"
        exit 0
    fi
fi

# Show what will be synced
echo ""
echo "📊 Changes to sync:"
if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    git log staging/main..dev/main --oneline || git log dev/main --oneline -10
else
    echo "   (showing last 10 commits from dev)"
    git log dev/main --oneline -10
fi

echo ""
read -p "⚠️  Sync dev → staging? (type 'yes' to confirm): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Sync cancelled"
    exit 1
fi

# Push to staging
echo ""
echo "🚀 Pushing to staging..."
git push staging dev/main:main

echo ""
echo "✅ Staging updated! Vercel will auto-deploy to lecrm-stg.vercel.app"
echo ""
echo "📊 Next steps:"
echo "   1. Test at: https://lecrm-stg.vercel.app"
echo "   2. Check for new SQL migrations that need to be applied to staging Supabase"
echo "   3. When ready, sync to production: ./scripts/sync-to-production.sh"

