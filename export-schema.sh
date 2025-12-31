#!/bin/bash

# Export Supabase Schema Script
# This script exports your complete database schema from Supabase

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}📋 Supabase Schema Export Script${NC}"
echo ""

# Check if environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    echo ""
    echo "Please set them first:"
    echo "  export SUPABASE_URL='https://your-project.supabase.co'"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    echo ""
    echo "Or load from .env file:"
    echo "  source .env"
    echo ""
    exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|\.supabase\.co||')
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_DB_PASSWORD not set${NC}"
    echo ""
    echo "To get your database password:"
    echo "  1. Go to Supabase Dashboard → Settings → Database"
    echo "  2. Copy your database password"
    echo "  3. Run: export SUPABASE_DB_PASSWORD='your-password'"
    echo ""
    echo "Or you can use the Supabase Dashboard method instead (see instructions)."
    echo ""
    exit 1
fi

# Database connection details
DB_HOST="${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.${PROJECT_REF}"

OUTPUT_FILE="supabase-schema-export-$(date +%Y%m%d-%H%M%S).sql"

echo -e "${GREEN}📤 Exporting schema...${NC}"
echo "  Project: $PROJECT_REF"
echo "  Output: $OUTPUT_FILE"
echo ""

# Export schema only (no data)
PGPASSWORD="$DB_PASSWORD" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --file="$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Schema exported successfully to: $OUTPUT_FILE${NC}"
    echo ""
    echo "To import this schema to a new Supabase project:"
    echo "  1. Create a new Supabase project"
    echo "  2. Go to SQL Editor"
    echo "  3. Copy and paste the contents of $OUTPUT_FILE"
    echo "  4. Run the SQL"
else
    echo -e "${RED}❌ Export failed${NC}"
    echo ""
    echo "Make sure you have:"
    echo "  - pg_dump installed (PostgreSQL client tools)"
    echo "  - Correct database password"
    echo "  - Network access to Supabase"
    exit 1
fi

