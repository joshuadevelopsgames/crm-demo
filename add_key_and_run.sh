#!/bin/bash

echo "🔑 Add Service Role Key and Run Comparison"
echo ""
echo "To get your service role key:"
echo "1. Go to: https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/settings/api"
echo "2. Find 'service_role' key under 'Project API keys'"
echo "3. Click 'Reveal' and copy the key"
echo ""
read -p "Paste your SUPABASE_SERVICE_ROLE_KEY here: " SERVICE_KEY

if [ -z "$SERVICE_KEY" ]; then
  echo "❌ No key provided. Exiting."
  exit 1
fi

# Update .env file
if [ -f .env ]; then
  # Remove old SUPABASE_SERVICE_ROLE_KEY line if it exists
  sed -i.bak '/^SUPABASE_SERVICE_ROLE_KEY=/d' .env
  # Add new key
  echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> .env
  echo ""
  echo "✅ Added service role key to .env file"
  echo ""
else
  echo "❌ .env file not found. Creating it..."
  cat > .env << EOF
# Supabase credentials for estimates comparison script
SUPABASE_URL=https://vtnaqheddlvnlcgwwssc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
EOF
  echo "✅ Created .env file with your key"
  echo ""
fi

# Run the comparison script
echo "🚀 Running comparison script..."
echo ""
npm run compare:estimates

