-- Functions to manage at_risk_accounts table
-- These functions add/remove accounts based on their at-risk status and snooze state

-- ============================================================================
-- Function: Check if account should be at-risk based on estimates
-- ============================================================================
CREATE OR REPLACE FUNCTION should_account_be_at_risk(account_id_param text)
RETURNS TABLE (
  is_at_risk boolean,
  renewal_date date,
  days_until_renewal int,
  expiring_estimate_id text,
  expiring_estimate_number text
) AS $$
DECLARE
  account_record RECORD;
  estimate_record RECORD;
  soonest_renewal date;
  soonest_days int;
  soonest_estimate_id text;
  soonest_estimate_number text;
  days_threshold int := 180;
BEGIN
  -- Get account
  SELECT * INTO account_record FROM accounts WHERE id = account_id_param;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Skip archived accounts
  IF account_record.archived = true THEN
    RETURN;
  END IF;
  
  -- Find the soonest expiring won estimate with contract_end
  soonest_renewal := NULL;
  soonest_days := NULL;
  soonest_estimate_id := NULL;
  soonest_estimate_number := NULL;
  
  FOR estimate_record IN
    SELECT 
      e.id,
      e.lmn_estimate_id,
      e.estimate_number,
      e.contract_end::date as contract_end_date
    FROM estimates e
    WHERE e.account_id = account_id_param
      AND e.status = 'won'
      AND e.contract_end IS NOT NULL
    ORDER BY e.contract_end::date ASC
  LOOP
    DECLARE
      days_until int;
    BEGIN
      days_until := (estimate_record.contract_end_date - CURRENT_DATE);
      
      -- If this estimate is expiring within threshold, use it
      IF days_until <= days_threshold THEN
        IF soonest_renewal IS NULL OR days_until < soonest_days THEN
          soonest_renewal := estimate_record.contract_end_date;
          soonest_days := days_until;
          soonest_estimate_id := estimate_record.id;
          soonest_estimate_number := COALESCE(estimate_record.estimate_number, estimate_record.lmn_estimate_id);
        END IF;
      END IF;
    END;
  END LOOP;
  
  -- Return result
  IF soonest_renewal IS NOT NULL THEN
    is_at_risk := true;
    renewal_date := soonest_renewal;
    days_until_renewal := soonest_days;
    expiring_estimate_id := soonest_estimate_id;
    expiring_estimate_number := soonest_estimate_number;
    RETURN NEXT;
  ELSE
    is_at_risk := false;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Add account to at_risk_accounts table
-- ============================================================================
CREATE OR REPLACE FUNCTION add_account_to_at_risk(
  account_id_param text,
  renewal_date_param date,
  days_until_renewal_param int,
  expiring_estimate_id_param text DEFAULT NULL,
  expiring_estimate_number_param text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO at_risk_accounts (
    account_id,
    renewal_date,
    days_until_renewal,
    expiring_estimate_id,
    expiring_estimate_number,
    updated_at
  )
  VALUES (
    account_id_param,
    renewal_date_param,
    days_until_renewal_param,
    expiring_estimate_id_param,
    expiring_estimate_number_param,
    now()
  )
  ON CONFLICT (account_id) 
  DO UPDATE SET
    renewal_date = EXCLUDED.renewal_date,
    days_until_renewal = EXCLUDED.days_until_renewal,
    expiring_estimate_id = EXCLUDED.expiring_estimate_id,
    expiring_estimate_number = EXCLUDED.expiring_estimate_number,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Remove account from at_risk_accounts table
-- ============================================================================
CREATE OR REPLACE FUNCTION remove_account_from_at_risk(account_id_param text)
RETURNS void AS $$
BEGIN
  DELETE FROM at_risk_accounts WHERE account_id = account_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Sync at-risk status for an account (checks estimates and snoozes)
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_account_at_risk_status(account_id_param text)
RETURNS void AS $$
DECLARE
  at_risk_info RECORD;
  is_snoozed boolean;
BEGIN
  -- Check if account is snoozed
  SELECT EXISTS (
    SELECT 1 FROM notification_snoozes
    WHERE notification_type = 'renewal_reminder'
      AND related_account_id = account_id_param
      AND snoozed_until > now()
  ) INTO is_snoozed;
  
  -- If snoozed, remove from table
  IF is_snoozed THEN
    PERFORM remove_account_from_at_risk(account_id_param);
    RETURN;
  END IF;
  
  -- Check if account should be at-risk
  SELECT * INTO at_risk_info FROM should_account_be_at_risk(account_id_param);
  
  IF at_risk_info.is_at_risk THEN
    -- Add or update in table
    PERFORM add_account_to_at_risk(
      account_id_param,
      at_risk_info.renewal_date,
      at_risk_info.days_until_renewal,
      at_risk_info.expiring_estimate_id,
      at_risk_info.expiring_estimate_number
    );
  ELSE
    -- Remove from table
    PERFORM remove_account_from_at_risk(account_id_param);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Sync all at-risk accounts (for initial setup or bulk refresh)
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_all_at_risk_accounts()
RETURNS TABLE (
  added_count int,
  removed_count int,
  updated_count int
) AS $$
DECLARE
  account_record RECORD;
  at_risk_info RECORD;
  is_snoozed boolean;
  added int := 0;
  removed int := 0;
  updated int := 0;
  was_in_table boolean;
BEGIN
  -- Process each account
  FOR account_record IN SELECT id FROM accounts WHERE archived = false LOOP
    -- Check if currently in table
    SELECT EXISTS (
      SELECT 1 FROM at_risk_accounts WHERE account_id = account_record.id
    ) INTO was_in_table;
    
    -- Sync status
    PERFORM sync_account_at_risk_status(account_record.id);
    
    -- Check if now in table
    IF EXISTS (SELECT 1 FROM at_risk_accounts WHERE account_id = account_record.id) THEN
      IF NOT was_in_table THEN
        added := added + 1;
      ELSE
        updated := added + 1; -- Count as updated if renewal date changed
      END IF;
    ELSIF was_in_table THEN
      removed := removed + 1;
    END IF;
  END LOOP;
  
  added_count := added;
  removed_count := removed;
  updated_count := updated;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION should_account_be_at_risk IS 
  'Checks if an account should be at-risk based on its won estimates with contract_end dates. Returns the soonest expiring estimate info.';
COMMENT ON FUNCTION add_account_to_at_risk IS 
  'Adds or updates an account in the at_risk_accounts table.';
COMMENT ON FUNCTION remove_account_from_at_risk IS 
  'Removes an account from the at_risk_accounts table.';
COMMENT ON FUNCTION sync_account_at_risk_status IS 
  'Syncs an account''s at-risk status: checks estimates, respects snoozes, and updates the at_risk_accounts table accordingly.';
COMMENT ON FUNCTION sync_all_at_risk_accounts IS 
  'Syncs all accounts'' at-risk status. Use for initial setup or bulk refresh.';

