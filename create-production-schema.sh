#!/bin/bash

# Create Production Schema Script
# This script combines all SQL migration files in the correct order
# to create a complete schema for a new Supabase production project

OUTPUT_FILE="production-schema-complete.sql"

echo "📋 Creating complete production schema..."
echo "   Output: $OUTPUT_FILE"
echo ""

# Start with header
cat > "$OUTPUT_FILE" << 'EOF'
-- ============================================
-- LECRM Production Database Schema
-- Complete schema export for new Supabase project
-- ============================================
-- 
-- Instructions:
-- 1. Create a new Supabase project for production
-- 2. Go to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Run it
-- 5. Create storage buckets manually (see notes at end)
-- 6. Update Vercel environment variables
-- 
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

EOF

# Add main schema
if [ -f "SUPABASE_SCHEMA.sql" ]; then
    echo "-- Main schema tables" >> "$OUTPUT_FILE"
    cat SUPABASE_SCHEMA.sql >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "✅ Added SUPABASE_SCHEMA.sql"
fi

# Add profiles and user management
for file in add_profiles_table.sql add_user_roles.sql create_user_permissions_table.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add tasks and related
for file in create_tasks_table.sql add_recurring_tasks_schema.sql add_task_comments_schema.sql add_task_attachments_schema.sql add_task_blocking_schema.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add sequences
for file in create_sequences_table.sql create_sequence_enrollments_table.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add interactions and notifications
for file in create_interactions_table.sql create_notifications_table.sql create_notification_snoozes_table.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add scorecards
for file in create_scorecard_templates_table.sql create_scorecard_responses_table.sql add_template_version_to_responses.sql alter_scorecard_responses_account_id.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add account attachments
for file in add_account_attachments_schema.sql add_notes_to_accounts.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add additional columns
for file in add_icp_status_to_accounts.sql add_snoozed_until_to_accounts.sql add_phone_to_profiles.sql add_admin_role_migration.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add RLS policies
for file in fix_profiles_rls_for_admin.sql; do
    if [ -f "$file" ]; then
        echo "-- $file" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "✅ Added $file"
    fi
done

# Add footer with instructions
cat >> "$OUTPUT_FILE" << 'EOF'

-- ============================================
-- POST-SETUP INSTRUCTIONS
-- ============================================
-- 
-- After running this schema:
-- 
-- 1. CREATE STORAGE BUCKETS (in Supabase Dashboard → Storage):
--    - task-attachments (private, 10MB limit)
--    - account-attachments (private, 10MB limit)
-- 
-- 2. RUN STORAGE BUCKET POLICIES:
--    - Run create_task_attachments_bucket.sql
--    - Run create_account_attachments_bucket.sql
-- 
-- 3. SET UP SYSTEM ADMIN:
--    - Run SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql
--    - This creates the admin user (jrsschroeder@gmail.com)
-- 
-- 4. UPDATE VERCEL ENVIRONMENT VARIABLES:
--    - Go to Vercel Dashboard → Your Production Project
--    - Settings → Environment Variables
--    - Update SUPABASE_URL to new production project URL
--    - Update SUPABASE_SERVICE_ROLE_KEY to new production service role key
--    - Update VITE_SUPABASE_URL to new production project URL
--    - Update VITE_SUPABASE_ANON_KEY to new production anon key
--    - Redeploy the project
-- 
-- 5. VERIFY:
--    - Check that all tables exist in Table Editor
--    - Test login with admin account
--    - Verify storage buckets are accessible
-- 
-- ============================================
EOF

echo ""
echo "✅ Complete schema created: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "  1. Create a new Supabase project for production"
echo "  2. Go to SQL Editor in the new project"
echo "  3. Copy the contents of $OUTPUT_FILE"
echo "  4. Paste and run it"
echo "  5. Follow the post-setup instructions in the file"

