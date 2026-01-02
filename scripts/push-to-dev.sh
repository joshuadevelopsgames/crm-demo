#!/bin/bash
# Safe wrapper for pushing to dev repository
# This is your daily backup - use this frequently!

set -e

echo "💾 Pushing to dev repository..."
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo "   Consider committing first: git add . && git commit -m 'Your message'"
    echo ""
    read -p "Continue anyway? (y/n): " continue_anyway
    if [ "$continue_anyway" != "y" ] && [ "$continue_anyway" != "Y" ]; then
        echo "❌ Push cancelled"
        exit 1
    fi
fi

# Push to dev
git push dev main

echo ""
echo "✅ Pushed to dev! This is your backup."
echo "📊 View at: https://github.com/joshuadevelopsgames/LECRM-dev"

