#!/bin/bash

# Setup script for environment variables for compare_estimates_with_excel.js
# This script helps you set up SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

echo "🔧 Setting up environment variables for Estimates Comparison Script"
echo ""

# Your Supabase URL (already known)
SUPABASE_URL="https://vtnaqheddlvnlcgwwssc.supabase.co"

echo "📋 Your Supabase URL: $SUPABASE_URL"
echo ""
echo "To get your SUPABASE_SERVICE_ROLE_KEY:"
echo "1. Go to: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/settings/api"
echo "2. Find the 'service_role' key (under 'Project API keys')"
echo "3. Click 'Reveal' to show it"
echo "4. Copy the key"
echo ""
read -p "Paste your SUPABASE_SERVICE_ROLE_KEY here: " SERVICE_KEY

if [ -z "$SERVICE_KEY" ]; then
  echo "❌ No key provided. Exiting."
  exit 1
fi

echo ""
echo "✅ Setting environment variables for this terminal session..."
export SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"

echo ""
echo "✅ Environment variables set for this session!"
echo ""
echo "You can now run:"
echo "  npm run compare:estimates"
echo ""
echo "🔒 RECOMMENDED: Create a .env file (more secure than shell profile)"
echo ""
echo "Would you like to create a .env file in your project? (y/n)"
read -p "> " CREATE_ENV

if [ "$CREATE_ENV" = "y" ] || [ "$CREATE_ENV" = "Y" ]; then
  ENV_FILE=".env"
  
  # Check if .env already exists
  if [ -f "$ENV_FILE" ]; then
    echo ""
    echo "⚠️  .env file already exists. Append to it? (y/n)"
    read -p "> " APPEND
    if [ "$APPEND" != "y" ] && [ "$APPEND" != "Y" ]; then
      echo "Skipping .env file creation."
    else
      echo "" >> "$ENV_FILE"
      echo "# Supabase credentials for estimates comparison script" >> "$ENV_FILE"
      echo "SUPABASE_URL=$SUPABASE_URL" >> "$ENV_FILE"
      echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> "$ENV_FILE"
      echo ""
      echo "✅ Added to existing .env file"
    fi
  else
    echo "# Supabase credentials for estimates comparison script" > "$ENV_FILE"
    echo "# This file is in .gitignore and will NOT be committed to git" >> "$ENV_FILE"
    echo "" >> "$ENV_FILE"
    echo "SUPABASE_URL=$SUPABASE_URL" >> "$ENV_FILE"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> "$ENV_FILE"
    echo ""
    echo "✅ Created .env file"
    echo "   This is more secure than storing in your shell profile!"
  fi
fi

echo ""
echo "⚠️  SECURITY NOTE:"
echo "   - The service role key has FULL admin access to your database"
echo "   - Storing it in ~/.zshrc is NOT recommended (visible to all processes)"
echo "   - Using a .env file is safer (project-specific, already in .gitignore)"
echo "   - Never commit the service role key to git!"

