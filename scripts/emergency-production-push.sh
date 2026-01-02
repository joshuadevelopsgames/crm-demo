#!/bin/bash
# Emergency script to push directly to production with codeword
# Use only in true emergencies when the normal workflow cannot be used

set -e

echo "🚨 EMERGENCY PRODUCTION PUSH"
echo "============================"
echo ""
echo "⚠️  WARNING: This bypasses the normal deployment workflow!"
echo "   Only use this in true emergencies."
echo ""
echo "Normal workflow:"
echo "  1. ./scripts/push-to-dev.sh"
echo "  2. ./scripts/sync-to-staging.sh"
echo "  3. ./scripts/sync-to-production.sh"
echo ""

read -p "Are you sure you need to bypass the workflow? (type 'EMERGENCY'): " confirm
if [ "$confirm" != "EMERGENCY" ]; then
    echo "❌ Emergency push cancelled"
    exit 1
fi

echo ""
echo "Enter the emergency codeword:"
read -s codeword
echo ""

if [ "$codeword" != "DEPLOY_EMERGENCY_2024" ]; then
    echo "❌ Invalid codeword. Emergency push cancelled."
    exit 1
fi

echo ""
echo "⚠️  Final confirmation: This will push directly to PRODUCTION"
read -p "Type 'DEPLOY NOW' to proceed: " final_confirm
if [ "$final_confirm" != "DEPLOY NOW" ]; then
    echo "❌ Emergency push cancelled"
    exit 1
fi

echo ""
echo "🚀 Pushing to production with emergency bypass..."
PRODUCTION_BYPASS="DEPLOY_EMERGENCY_2024" git push production main

echo ""
echo "✅ Emergency push complete!"
echo "⚠️  Remember: This bypassed the normal workflow - document why this was necessary"

