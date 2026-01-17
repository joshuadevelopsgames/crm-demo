#!/bin/bash
# Database Backup Script for Supabase
# Run this daily via cron or scheduled task

set -e  # Exit on error

# Configuration - UPDATE THESE VALUES
SUPABASE_URL="${SUPABASE_URL:-your-project-ref.supabase.co}"
SUPABASE_DB="${SUPABASE_DB:-postgres}"
SUPABASE_USER="${SUPABASE_USER:-postgres}"
SUPABASE_PASSWORD="${SUPABASE_PASSWORD:-your-password}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"  # Optional: S3 bucket for cloud backup
GCS_BUCKET="${GCS_BUCKET:-}"  # Optional: Google Cloud Storage bucket

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
COMPRESSED_FILE="$BACKUP_FILE.gz"

echo -e "${GREEN}Starting database backup...${NC}"
echo "Timestamp: $TIMESTAMP"
echo "Backup file: $BACKUP_FILE"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

# Create backup
echo "Creating database backup..."
pg_dump "postgresql://$SUPABASE_USER:$SUPABASE_PASSWORD@$SUPABASE_URL:5432/$SUPABASE_DB" \
  --verbose \
  --no-owner \
  --no-acl \
  --file="$BACKUP_FILE" 2>&1 | tee "$BACKUP_DIR/backup_$TIMESTAMP.log"

# Check if backup was successful
if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file was not created or is empty!${NC}"
    exit 1
fi

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="$COMPRESSED_FILE"

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}✓ Backup created successfully: $BACKUP_FILE (Size: $BACKUP_SIZE)${NC}"

# Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
    echo "Uploading to S3..."
    aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/database-backups/" || {
        echo -e "${YELLOW}Warning: S3 upload failed${NC}"
    }
fi

# Upload to Google Cloud Storage (if configured)
if [ -n "$GCS_BUCKET" ] && command -v gsutil &> /dev/null; then
    echo "Uploading to Google Cloud Storage..."
    gsutil cp "$BACKUP_FILE" "gs://$GCS_BUCKET/database-backups/" || {
        echo -e "${YELLOW}Warning: GCS upload failed${NC}"
    }
fi

# Remove old backups (keep last N days)
echo "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "backup_*.log" -mtime +$RETENTION_DAYS -delete

# List remaining backups
echo -e "\n${GREEN}Remaining backups:${NC}"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"

echo -e "\n${GREEN}Backup completed successfully!${NC}"
