-- Triggers to automatically manage at_risk_accounts table
-- When accounts or estimates change, sync the at-risk status

-- ============================================================================
-- Trigger: Update at-risk status when account changes
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_sync_at_risk_on_account_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if relevant fields changed
  IF (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM sync_account_at_risk_status(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on accounts table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts'
  ) THEN
    DROP TRIGGER IF EXISTS trg_accounts_sync_at_risk ON accounts;
    CREATE TRIGGER trg_accounts_sync_at_risk
      AFTER UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION trigger_sync_at_risk_on_account_change();
    
    RAISE NOTICE 'Created trigger on accounts table for at-risk sync';
  ELSE
    RAISE NOTICE 'Accounts table does not exist yet. Skipping trigger creation.';
  END IF;
END $$;

-- ============================================================================
-- Trigger: Update at-risk status when estimate changes
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_sync_at_risk_on_estimate_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync the account's at-risk status when estimate changes
  IF NEW.account_id IS NOT NULL THEN
    PERFORM sync_account_at_risk_status(NEW.account_id);
  END IF;
  
  -- Also sync if account_id changed
  IF OLD.account_id IS DISTINCT FROM NEW.account_id AND OLD.account_id IS NOT NULL THEN
    PERFORM sync_account_at_risk_status(OLD.account_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on estimates table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'estimates'
  ) THEN
    DROP TRIGGER IF EXISTS trg_estimates_sync_at_risk ON estimates;
    CREATE TRIGGER trg_estimates_sync_at_risk
      AFTER INSERT OR UPDATE OR DELETE ON estimates
      FOR EACH ROW
      EXECUTE FUNCTION trigger_sync_at_risk_on_estimate_change();
    
    RAISE NOTICE 'Created trigger on estimates table for at-risk sync';
  ELSE
    RAISE NOTICE 'Estimates table does not exist yet. Skipping trigger creation.';
  END IF;
END $$;

-- ============================================================================
-- Trigger: Update at-risk status when snooze changes
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_sync_at_risk_on_snooze_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync the account's at-risk status when snooze is added/updated/removed
  IF NEW.related_account_id IS NOT NULL AND NEW.notification_type = 'renewal_reminder' THEN
    PERFORM sync_account_at_risk_status(NEW.related_account_id);
  END IF;
  
  -- Also sync if account_id changed or on delete
  IF TG_OP = 'DELETE' THEN
    IF OLD.related_account_id IS NOT NULL AND OLD.notification_type = 'renewal_reminder' THEN
      PERFORM sync_account_at_risk_status(OLD.related_account_id);
    END IF;
  ELSIF OLD.related_account_id IS DISTINCT FROM NEW.related_account_id 
        AND OLD.related_account_id IS NOT NULL 
        AND OLD.notification_type = 'renewal_reminder' THEN
    PERFORM sync_account_at_risk_status(OLD.related_account_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notification_snoozes table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_snoozes'
  ) THEN
    DROP TRIGGER IF EXISTS trg_snoozes_sync_at_risk ON notification_snoozes;
    CREATE TRIGGER trg_snoozes_sync_at_risk
      AFTER INSERT OR UPDATE OR DELETE ON notification_snoozes
      FOR EACH ROW
      EXECUTE FUNCTION trigger_sync_at_risk_on_snooze_change();
    
    RAISE NOTICE 'Created trigger on notification_snoozes table for at-risk sync';
  ELSE
    RAISE NOTICE 'notification_snoozes table does not exist yet. Skipping trigger creation.';
  END IF;
END $$;

-- ============================================================================
-- Function: Check and re-add accounts when snoozes expire
-- ============================================================================
CREATE OR REPLACE FUNCTION check_expired_snoozes_and_restore_at_risk()
RETURNS TABLE (
  restored_count int
) AS $$
DECLARE
  snooze_record RECORD;
  restored int := 0;
BEGIN
  -- Find accounts that were snoozed but snooze has expired
  FOR snooze_record IN
    SELECT DISTINCT related_account_id
    FROM notification_snoozes
    WHERE notification_type = 'renewal_reminder'
      AND snoozed_until < now()
      AND related_account_id IS NOT NULL
  LOOP
    -- Sync the account (will re-add if still at-risk)
    PERFORM sync_account_at_risk_status(snooze_record.related_account_id);
    restored := restored + 1;
  END LOOP;
  
  restored_count := restored;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION trigger_sync_at_risk_on_account_change IS 
  'Trigger function that syncs at-risk status when account data changes.';
COMMENT ON FUNCTION trigger_sync_at_risk_on_estimate_change IS 
  'Trigger function that syncs at-risk status when estimate data changes.';
COMMENT ON FUNCTION trigger_sync_at_risk_on_snooze_change IS 
  'Trigger function that syncs at-risk status when snooze status changes.';
COMMENT ON FUNCTION check_expired_snoozes_and_restore_at_risk IS 
  'Checks for expired snoozes and re-adds accounts to at_risk_accounts if they are still at-risk.';

