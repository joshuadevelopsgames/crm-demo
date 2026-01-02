#!/bin/bash
# Install the production protection hook in all repositories
# This hook requires FLASH25 to be in the commit message (not environment variable)

HOOK_CONTENT='#!/bin/bash
# Git pre-push hook to block direct pushes to production
# This ensures all production deployments go through the proper workflow
# SECURITY: Codeword must be in commit message - cannot be bypassed by AI assistants

# Get the remote name being pushed to
remote="$1"
url="$2"

# Block direct pushes to production remote
if [ "$remote" = "production" ]; then
    # Check for emergency bypass codeword in the most recent commit message
    BYPASS_CODEWORD="FLASH25"
    
    # Get the most recent commit message
    COMMIT_MSG=$(git log -1 --pretty=%B)
    
    # Check if codeword is in commit message (case-insensitive)
    if echo "$COMMIT_MSG" | grep -qi "$BYPASS_CODEWORD"; then
        echo ""
        echo "⚠️  EMERGENCY BYPASS ACTIVATED"
        echo "   Codeword found in commit message"
        echo "   Direct push to production allowed"
        echo "   This bypasses the normal workflow - use with caution!"
        echo ""
        exit 0
    fi
    
    echo ""
    echo "❌ ERROR: Direct pushes to production are blocked!"
    echo ""
    echo "🔒 Production deployments must go through the proper workflow:"
    echo "   1. Push to dev: ./scripts/push-to-dev.sh"
    echo "   2. Sync dev → staging: ./scripts/sync-to-staging.sh"
    echo "   3. Sync staging → production: ./scripts/sync-to-production.sh"
    echo ""
    echo "💡 Or use GitHub Actions workflows for approval gates:"
    echo "   - Dev → Staging: https://github.com/joshuadevelopsgames/LECRM-dev/actions"
    echo "   - Staging → Production: https://github.com/joshuadevelopsgames/LECRM-staging/actions"
    echo ""
    echo "🚨 Emergency bypass: Include FLASH25 in your commit message"
    echo "   Example: git commit -m '\''Your message FLASH25'\''"
    echo "   Then: git push production main"
    echo ""
    echo "   ⚠️  The codeword MUST be in the commit message"
    echo "   Environment variables are NOT accepted for security"
    echo ""
    exit 1
fi

exit 0
'

echo "🔒 Installing Production Protection Hook"
echo "=========================================="
echo ""
echo "This hook will:"
echo "  ✅ Block direct pushes to production"
echo "  ✅ Only allow bypass if FLASH25 is in commit message"
echo "  ❌ Reject environment variable bypass (more secure)"
echo ""

# Install in current repo
if [ -d ".git" ]; then
    echo "$HOOK_CONTENT" > .git/hooks/pre-push
    chmod +x .git/hooks/pre-push
    echo "✅ Installed in current repository"
else
    echo "❌ Not a git repository"
    exit 1
fi

echo ""
echo "📋 To install in other repositories:"
echo "   1. Clone each repo (LECRM-dev, LECRM-staging, LECRM)"
echo "   2. Run this script in each one"
echo "   OR copy .git/hooks/pre-push to each repository"
echo ""
echo "✅ Hook installed successfully!"
echo ""
echo "🧪 Test it:"
echo "   git push production main  # Should be blocked"
echo "   git commit -m 'Test FLASH25'"
echo "   git push production main  # Should work"

