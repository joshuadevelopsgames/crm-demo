#!/bin/bash
# Shows the status of all three environments
# Helps you understand what's deployed where

echo "📊 Environment Status Check"
echo "============================"
echo ""

# Fetch all remotes
echo "📥 Fetching latest from all remotes..."
git fetch dev main 2>/dev/null || true
git fetch staging main 2>/dev/null || true
git fetch production main 2>/dev/null || true

echo ""
echo "Current Status:"
echo "---------------"

# Get commit hashes and info
LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "N/A")
DEV=$(git rev-parse dev/main 2>/dev/null || echo "N/A")
STAGING=$(git rev-parse staging/main 2>/dev/null || echo "N/A")
PRODUCTION=$(git rev-parse production/main 2>/dev/null || echo "N/A")

echo ""
echo "Local:     $(git log -1 --oneline HEAD 2>/dev/null || echo 'N/A')"
if [ "$DEV" != "N/A" ]; then
    echo "Dev:       $(git log -1 --oneline dev/main 2>/dev/null || echo 'N/A')"
else
    echo "Dev:       N/A (remote not accessible)"
fi
if [ "$STAGING" != "N/A" ]; then
    echo "Staging:   $(git log -1 --oneline staging/main 2>/dev/null || echo 'N/A')"
else
    echo "Staging:   N/A (remote not accessible)"
fi
if [ "$PRODUCTION" != "N/A" ]; then
    echo "Production: $(git log -1 --oneline production/main 2>/dev/null || echo 'N/A')"
else
    echo "Production: N/A (remote not accessible)"
fi

echo ""
echo "Sync Status:"
echo "------------"

# Check sync status
if [ "$DEV" != "N/A" ] && [ "$STAGING" != "N/A" ] && [ "$PRODUCTION" != "N/A" ]; then
    if [ "$DEV" = "$STAGING" ] && [ "$STAGING" = "$PRODUCTION" ]; then
        echo "✅ All environments are in sync!"
    elif [ "$DEV" != "$STAGING" ]; then
        echo "⚠️  Dev and Staging are out of sync"
        echo "   Run: ./scripts/sync-to-staging.sh"
    elif [ "$STAGING" != "$PRODUCTION" ]; then
        echo "⚠️  Staging and Production are out of sync"
        echo "   Run: ./scripts/sync-to-production.sh"
    fi
else
    echo "⚠️  Could not determine sync status (some remotes may not be accessible)"
fi

echo ""
echo "Quick Actions:"
echo "-------------"
echo "  Push to dev:        ./scripts/push-to-dev.sh"
echo "  Sync to staging:    ./scripts/sync-to-staging.sh"
echo "  Sync to production: ./scripts/sync-to-production.sh"
echo ""
echo "GitHub Actions:"
echo "  Dev → Staging:     https://github.com/joshuadevelopsgames/LECRM-dev/actions"
echo "  Staging → Prod:    https://github.com/joshuadevelopsgames/LECRM-staging/actions"

