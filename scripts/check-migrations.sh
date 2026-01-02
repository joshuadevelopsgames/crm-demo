#!/bin/bash
# Shows which SQL migrations need to be applied to each environment
# Helps track database schema changes

echo "📊 SQL Migration Status"
echo "======================="
echo ""

# Count SQL files
SQL_COUNT=$(git ls-files "*.sql" 2>/dev/null | wc -l | tr -d ' ')
echo "Total SQL migration files in repo: $SQL_COUNT"
echo ""

# List recent SQL files
echo "Recent SQL migration files:"
git ls-files "*.sql" | tail -10 | while read file; do
    echo "  - $file"
done

echo ""
echo "⚠️  Manual Migration Required:"
echo ""
echo "For each environment, you need to:"
echo "1. Check which .sql files are new/changed since last sync"
echo "2. Apply them in order (see PRODUCTION_MIGRATION_ORDER.md if it exists)"
echo "3. Run in Supabase SQL Editor for that environment"
echo ""
echo "Environment Links:"
echo "  - Dev:     https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/sql"
echo "  - Staging: https://supabase.com/dashboard/project/YOUR_STAGING_PROJECT/sql"
echo "  - Prod:    https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn/sql"
echo ""
echo "💡 Tip: After syncing code, run this script to see what migrations need attention"

