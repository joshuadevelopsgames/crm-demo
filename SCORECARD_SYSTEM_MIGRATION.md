# Scorecard System Migration Guide

## Overview
This migration converts the scorecard system to use a single ICP (Ideal Customer Profile) template with version tracking. All accounts use the same ICP template, and when the template is updated, a new version is created while preserving history.

## SQL Migrations to Run (in order)

### 1. Create Templates Table
Run: `create_scorecard_templates_table.sql`
- Creates the `scorecard_templates` table with versioning support
- Includes fields for version_number, is_current_version, parent_template_id

### 2. Add Template Version ID to Responses
Run: `add_template_version_to_responses.sql`
- Adds `template_version_id` column to `scorecard_responses` table
- This tracks which template version was used for each scorecard

### 3. Update Account ID Type (if not already done)
Run: `alter_scorecard_responses_account_id.sql`
- Changes `account_id` from uuid to text to match your account IDs

## After Running Migrations

1. **Create your ICP template** on the Scoring page
   - Mark it as "Default" (is_default = true)
   - This will be the template all accounts use

2. **Test scorecard creation**
   - Go to an account detail page
   - Click "Complete ICP Scorecard"
   - Fill it out and submit

3. **Test template versioning**
   - Edit the ICP template on the Scoring page
   - A new version will be created automatically
   - Previous scorecards will show which version they used

## Key Changes

- **Removed**: "Create Scorecard" button from account pages
- **Added**: Version tracking for ICP template
- **Changed**: All scorecards now use the current ICP template
- **Added**: Expandable scorecard history showing template version details

