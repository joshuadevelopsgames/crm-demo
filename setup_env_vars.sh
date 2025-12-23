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
echo "✅ Environment variables set!"
echo ""
echo "You can now run:"
echo "  npm run compare:estimates"
echo ""
echo "⚠️  Note: These variables are only set for this terminal session."
echo "   To make them permanent, add them to your ~/.zshrc or ~/.bash_profile"
echo ""
echo "Would you like to add them to your ~/.zshrc file? (y/n)"
read -p "> " ADD_TO_PROFILE

if [ "$ADD_TO_PROFILE" = "y" ] || [ "$ADD_TO_PROFILE" = "Y" ]; then
  PROFILE_FILE="$HOME/.zshrc"
  if [ ! -f "$PROFILE_FILE" ]; then
    PROFILE_FILE="$HOME/.bash_profile"
  fi
  
  echo "" >> "$PROFILE_FILE"
  echo "# Supabase environment variables for LECRM" >> "$PROFILE_FILE"
  echo "export SUPABASE_URL=\"$SUPABASE_URL\"" >> "$PROFILE_FILE"
  echo "export SUPABASE_SERVICE_ROLE_KEY=\"$SERVICE_KEY\"" >> "$PROFILE_FILE"
  
  echo ""
  echo "✅ Added to $PROFILE_FILE"
  echo "   Run 'source $PROFILE_FILE' or restart your terminal to use them."
fi

