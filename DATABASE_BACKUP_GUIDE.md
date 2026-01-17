# Database Backup & Data Protection Guide

## Overview
This guide covers comprehensive backup strategies to ensure your Supabase database never loses data.

---

## 1. Supabase Built-in Backups (Recommended)

### Automatic Daily Backups
**Supabase automatically backs up your database daily** on paid plans:
- **Free Tier**: No automatic backups (manual only)
- **Pro Plan ($25/month)**: Daily backups, 7-day retention
- **Team Plan**: Daily backups, configurable retention

### Enable Point-in-Time Recovery (PITR)
**Best protection against data loss:**

1. **Go to Supabase Dashboard** → Your Project → Settings → Database
2. **Enable Point-in-Time Recovery** (PITR)
   - Allows recovery to any point in time (not just daily snapshots)
   - Requires Pro plan or higher
   - Costs extra but provides maximum protection

### Check Your Current Backup Status
1. Go to **Supabase Dashboard** → Your Project → Database → Backups
2. Verify backups are running successfully
3. Test a restore to ensure backups work

---

## 2. Manual Backup Strategies

### Option A: Supabase Dashboard Manual Backup
1. **Supabase Dashboard** → Database → Backups
2. Click **"Create Backup"**
3. Download the backup file
4. Store in secure location (cloud storage, multiple locations)

### Option B: pg_dump via Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Get database connection string from Supabase Dashboard
# Settings → Database → Connection string → URI

# Create backup
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --file=backup_$(date +%Y%m%d_%H%M%S).sql \
  --verbose

# Compress backup
gzip backup_*.sql
```

### Option C: Automated Backup Script
Create a script that runs daily:

```bash
#!/bin/bash
# save as: backup-database.sh

# Configuration
SUPABASE_URL="your-project-ref.supabase.co"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="your-password"
BACKUP_DIR="./backups"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Create backup
pg_dump "postgresql://$SUPABASE_USER:$SUPABASE_PASSWORD@$SUPABASE_URL:5432/$SUPABASE_DB" \
  | gzip > "$BACKUP_FILE"

# Remove old backups (keep last 30 days)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup created: $BACKUP_FILE"
```

**Set up cron job** (runs daily at 2 AM):
```bash
# Edit crontab
crontab -e

# Add this line:
0 2 * * * /path/to/backup-database.sh >> /var/log/db-backup.log 2>&1
```

---

## 3. Cloud Storage Backup (Recommended)

### Store Backups in Multiple Locations

**Option 1: AWS S3**
```bash
# After creating backup, upload to S3
aws s3 cp backup_*.sql.gz s3://your-backup-bucket/database-backups/
```

**Option 2: Google Cloud Storage**
```bash
gsutil cp backup_*.sql.gz gs://your-backup-bucket/database-backups/
```

**Option 3: Dropbox/OneDrive**
- Use rclone or similar tool to sync backups
- Provides off-site storage

---

## 4. Database Replication (High Availability)

### Supabase Read Replicas
- **Pro Plan**: Create read replicas in different regions
- Provides redundancy and faster recovery
- Go to **Database → Replicas** in Supabase Dashboard

### Logical Replication (Advanced)
Set up streaming replication to another PostgreSQL instance for real-time backup.

---

## 5. Application-Level Protection

### Enable Row-Level Security (RLS)
Protect against accidental data deletion:

```sql
-- Example: Prevent accidental deletion of accounts
CREATE POLICY prevent_account_deletion ON accounts
  FOR DELETE
  USING (false); -- Never allow direct deletion

-- Instead, use soft delete (archived flag)
UPDATE accounts SET archived = true WHERE id = 'xxx';
```

### Add Audit Logging
Track all changes:

```sql
-- Create audit log table
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text,
  operation text, -- INSERT, UPDATE, DELETE
  old_data jsonb,
  new_data jsonb,
  user_id text,
  timestamp timestamptz DEFAULT now()
);

-- Create trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_data, new_data)
  VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER accounts_audit
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## 6. Testing Your Backups

### Regular Restore Tests
**Critical:** Test that your backups actually work!

1. **Create test database**
2. **Restore from backup**
3. **Verify data integrity**
4. **Document restore procedure**

### Restore Procedure
```bash
# Restore from backup
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" < backup_20240101.sql

# Or from compressed backup
gunzip < backup_20240101.sql.gz | psql "postgresql://..."
```

---

## 7. Best Practices Checklist

### Daily
- ✅ Verify automatic backups are running
- ✅ Check backup storage space
- ✅ Monitor database size

### Weekly
- ✅ Review backup logs for errors
- ✅ Test restore from recent backup
- ✅ Verify backups are stored off-site

### Monthly
- ✅ Full backup restore test
- ✅ Review and update backup procedures
- ✅ Check backup retention policies
- ✅ Verify disaster recovery plan

### Critical Tables Priority
Focus extra protection on:
1. **accounts** - Core business data
2. **estimates** - Revenue data
3. **contacts** - Customer relationships
4. **interactions** - Communication history
5. **scorecards** - Account intelligence

---

## 8. Emergency Recovery Plan

### If Data is Lost or Corrupted

1. **Stop all writes** (if possible)
2. **Identify last known good state** (timestamp)
3. **Restore from backup**:
   - Use PITR if available (most precise)
   - Or use daily backup (may lose up to 24 hours)
4. **Verify data integrity**
5. **Resume operations**
6. **Document incident** and improve procedures

### Recovery Time Objectives (RTO)
- **RTO**: How quickly you need to recover (e.g., 1 hour)
- **RPO**: How much data loss is acceptable (e.g., 1 hour)

Plan your backup frequency based on these requirements.

---

## 9. Supabase-Specific Recommendations

### Current Setup Check
1. **Verify your Supabase plan**:
   - Free tier = No automatic backups (use manual)
   - Pro tier = Daily backups included

2. **Enable PITR** (if on Pro plan):
   - Maximum protection
   - Can recover to exact second

3. **Set up manual backups**:
   - Weekly full backups
   - Store in cloud storage
   - Test restores monthly

### Cost Considerations
- **Pro Plan ($25/month)**: Includes daily backups
- **PITR**: Additional cost but worth it for critical data
- **Storage**: Backup storage costs (usually minimal)

---

## 10. Quick Start: Immediate Actions

### Right Now (5 minutes)
1. ✅ Go to Supabase Dashboard → Database → Backups
2. ✅ Create a manual backup
3. ✅ Download and store it securely

### This Week
1. ✅ Set up automated backup script
2. ✅ Configure cloud storage sync
3. ✅ Test a restore procedure

### This Month
1. ✅ Enable PITR (if on Pro plan)
2. ✅ Set up audit logging
3. ✅ Document recovery procedures
4. ✅ Train team on backup/restore

---

## 11. Monitoring & Alerts

### Set Up Alerts
Monitor for:
- Backup failures
- Database size growth
- Unusual deletion patterns
- Connection issues

### Supabase Dashboard
- Check **Database → Backups** regularly
- Monitor **Database → Health** metrics
- Review **Logs** for errors

---

## Summary

**Minimum Protection (Free Tier)**:
- Manual weekly backups
- Store in cloud storage
- Test restores monthly

**Recommended Protection (Pro Tier)**:
- Automatic daily backups (Supabase)
- Enable PITR
- Weekly manual backups to cloud
- Monthly restore tests
- Audit logging

**Maximum Protection**:
- All of the above
- Read replicas
- Real-time replication
- Multiple backup locations
- Automated testing

**Remember**: A backup is only as good as your ability to restore it. Test regularly!
