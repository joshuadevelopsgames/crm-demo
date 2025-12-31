-- ============================================================================
-- PRODUCTION SUPABASE MIGRATION - COMPLETE SCRIPT
-- ============================================================================
-- Run this entire script in Supabase SQL Editor
-- All scripts are idempotent (safe to run multiple times)
-- ============================================================================

-- ============================================================================
-- SECTION 1: NOTIFICATION SYSTEM MIGRATION
-- ============================================================================

-- Step 1.1: Create user_notification_states table
CREATE TABLE IF NOT EXISTS user_notification_states (
  user_id text PRIMARY KEY,
  notifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notification_states_user_id 
  ON user_notification_states(user_id);

CREATE INDEX IF NOT EXISTS idx_user_notification_states_notifications_gin 
  ON user_notification_states USING GIN (notifications);

CREATE OR REPLACE FUNCTION set_user_notification_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_notification_states_updated_at ON user_notification_states;
CREATE TRIGGER trg_user_notification_states_updated_at
  BEFORE UPDATE ON user_notification_states 
  FOR EACH ROW EXECUTE FUNCTION set_user_notification_states_updated_at();

ALTER TABLE user_notification_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_notification_states_authenticated_all ON user_notification_states;
CREATE POLICY user_notification_states_authenticated_all ON user_notification_states
  FOR ALL TO authenticated 
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

COMMENT ON TABLE user_notification_states IS 'Stores bulk notifications (neglected_account, renewal_reminder) as JSONB arrays per user. Task notifications remain in notifications table.';

-- Step 1.2: Add unique constraint for task notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) THEN
    DELETE FROM notifications n1
    WHERE n1.id IN (
      SELECT n2.id
      FROM notifications n2
      WHERE EXISTS (
        SELECT 1
        FROM notifications n3
        WHERE n3.user_id = n2.user_id
          AND n3.type = n2.type
          AND n3.related_task_id = n2.related_task_id
          AND n3.id != n2.id
          AND n3.created_at > n2.created_at
      )
      AND n2.type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder')
    );
    
    DROP INDEX IF EXISTS unique_user_task_notification;
    CREATE UNIQUE INDEX unique_user_task_notification 
    ON notifications (user_id, type, related_task_id)
    WHERE type IN ('task_assigned', 'task_overdue', 'task_due_today', 'task_reminder')
      AND related_task_id IS NOT NULL;
    
    RAISE NOTICE 'Created unique index for task notifications';
  END IF;
END $$;

-- Step 1.3: Add notification update triggers
CREATE OR REPLACE FUNCTION update_notification_state_for_account(account_id_param text)
RETURNS void AS $$
DECLARE
  user_record RECORD;
  account_record RECORD;
  should_have_neglected_notif boolean := false;
  should_have_renewal_notif boolean := false;
  notification_obj jsonb;
  current_notifications jsonb;
  updated_notifications jsonb;
  threshold_days int;
  days_since_interaction int;
  today_date date := CURRENT_DATE;
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notification_states'
  ) THEN
    RETURN;
  END IF;
  
  SELECT * INTO account_record FROM accounts WHERE id = account_id_param;
  IF NOT FOUND THEN RETURN; END IF;
  
  IF account_record.archived = true OR account_record.icp_status = 'na' THEN
    FOR user_record IN SELECT id FROM auth.users LOOP
      UPDATE user_notification_states
      SET notifications = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(notifications) elem
        WHERE elem->>'related_account_id' != account_id_param
      ),
      updated_at = now()
      WHERE user_id = user_record.id::text;
    END LOOP;
    RETURN;
  END IF;
  
  IF account_record.last_interaction_date IS NULL THEN
    should_have_neglected_notif := true;
  ELSE
    threshold_days := CASE 
      WHEN account_record.revenue_segment IN ('A', 'B') THEN 30 
      ELSE 90 
    END;
    days_since_interaction := (today_date - account_record.last_interaction_date::date);
    should_have_neglected_notif := days_since_interaction > threshold_days;
  END IF;
  
  should_have_renewal_notif := account_record.status = 'at_risk';
  
  FOR user_record IN SELECT id FROM auth.users LOOP
    SELECT notifications INTO current_notifications
    FROM user_notification_states
    WHERE user_id = user_record.id::text;
    
    IF current_notifications IS NULL THEN
      current_notifications := '[]'::jsonb;
    END IF;
    
    updated_notifications := (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(current_notifications) elem
      WHERE elem->>'related_account_id' != account_id_param
    );
    
    IF updated_notifications IS NULL THEN
      updated_notifications := '[]'::jsonb;
    END IF;
    
    IF should_have_neglected_notif THEN
      IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_snoozes'
      ) OR NOT EXISTS (
        SELECT 1 FROM notification_snoozes 
        WHERE notification_type = 'neglected_account' 
        AND related_account_id = account_id_param
        AND snoozed_until > now()
      ) THEN
        notification_obj := jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'neglected_account',
          'title', 'Neglected Account: ' || COALESCE(account_record.name, 'Unknown'),
          'message', COALESCE(
            'No contact in ' || days_since_interaction || ' days',
            'No interactions logged'
          ),
          'related_account_id', account_id_param,
          'related_task_id', null,
          'is_read', false,
          'created_at', now()::text,
          'scheduled_for', now()::text
        );
        updated_notifications := updated_notifications || notification_obj;
      END IF;
    END IF;
    
    IF should_have_renewal_notif THEN
      IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_snoozes'
      ) OR NOT EXISTS (
        SELECT 1 FROM notification_snoozes 
        WHERE notification_type = 'renewal_reminder' 
        AND related_account_id = account_id_param
        AND snoozed_until > now()
      ) THEN
        notification_obj := jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'renewal_reminder',
          'title', 'Renewal Reminder: ' || COALESCE(account_record.name, 'Unknown'),
          'message', 'Account is at risk - renewal coming up',
          'related_account_id', account_id_param,
          'related_task_id', null,
          'is_read', false,
          'created_at', now()::text,
          'scheduled_for', now()::text
        );
        updated_notifications := updated_notifications || notification_obj;
      END IF;
    END IF;
    
    INSERT INTO user_notification_states (user_id, notifications, updated_at)
    VALUES (user_record.id::text, updated_notifications, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      notifications = EXCLUDED.notifications,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_update_notifications_on_account_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.last_interaction_date IS DISTINCT FROM NEW.last_interaction_date)
     OR (OLD.archived IS DISTINCT FROM NEW.archived)
     OR (OLD.snoozed_until IS DISTINCT FROM NEW.snoozed_until)
     OR (OLD.revenue_segment IS DISTINCT FROM NEW.revenue_segment)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.icp_status IS DISTINCT FROM NEW.icp_status) THEN
    PERFORM update_notification_state_for_account(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts'
  ) THEN
    DROP TRIGGER IF EXISTS trg_accounts_update_notifications ON accounts;
    CREATE TRIGGER trg_accounts_update_notifications
      AFTER UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_notifications_on_account_change();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION trigger_update_notifications_on_interaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE accounts 
  SET last_interaction_date = NEW.interaction_date
  WHERE id = NEW.account_id 
  AND (last_interaction_date IS NULL OR last_interaction_date < NEW.interaction_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'interactions'
  ) THEN
    DROP TRIGGER IF EXISTS trg_interactions_update_notifications ON interactions;
    CREATE TRIGGER trg_interactions_update_notifications
      AFTER INSERT ON interactions
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_notifications_on_interaction();
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: YEARLY OFFICIAL DATA TABLE (REQUIRED FOR REPORTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS yearly_official_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lmn_estimate_id TEXT NOT NULL,
  status TEXT,
  total_price NUMERIC(12, 2),
  estimate_close_date TIMESTAMPTZ,
  division TEXT,
  source_year INTEGER NOT NULL,
  source_file TEXT,
  is_official_lmn_data BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lmn_estimate_id, source_year)
);

CREATE INDEX IF NOT EXISTS idx_yearly_official_estimates_year ON yearly_official_estimates(source_year);
CREATE INDEX IF NOT EXISTS idx_yearly_official_estimates_lmn_id ON yearly_official_estimates(lmn_estimate_id);
CREATE INDEX IF NOT EXISTS idx_yearly_official_estimates_status ON yearly_official_estimates(status);

ALTER TABLE yearly_official_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read yearly official estimates" ON yearly_official_estimates;
CREATE POLICY "Allow authenticated users to read yearly official estimates"
  ON yearly_official_estimates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role to manage yearly official estimates" ON yearly_official_estimates;
CREATE POLICY "Allow service role to manage yearly official estimates"
  ON yearly_official_estimates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_yearly_official_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_yearly_official_estimates_updated_at ON yearly_official_estimates;
CREATE TRIGGER update_yearly_official_estimates_updated_at
  BEFORE UPDATE ON yearly_official_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_yearly_official_estimates_updated_at();

-- ============================================================================
-- SECTION 3: ACCOUNT FEATURES
-- ============================================================================

-- Add notes to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notes text;

-- Create account_attachments table
CREATE TABLE IF NOT EXISTS account_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  storage_path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_attachments_account_id ON account_attachments(account_id);
CREATE INDEX IF NOT EXISTS idx_account_attachments_user_id ON account_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_account_attachments_created_at ON account_attachments(created_at);

ALTER TABLE account_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON account_attachments;
CREATE POLICY "Allow all operations for authenticated users" ON account_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SECTION 4: ESTIMATE FEATURES
-- ============================================================================

-- Add CRM tags to estimates
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS crm_tags text;

COMMENT ON COLUMN estimates.crm_tags IS 'CRM tags/labels for categorizing estimates (e.g., account names, project types, salesperson names)';

-- ============================================================================
-- SECTION 5: STORAGE BUCKET POLICIES (if bucket exists)
-- ============================================================================

-- Note: The 'account-attachments' bucket must be created via Supabase Dashboard first
-- Dashboard → Storage → New bucket → Name: account-attachments → Private → Create
-- Then run these policies:

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM storage.buckets WHERE name = 'account-attachments'
  ) THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow authenticated users to upload account attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to read account attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to delete account attachments" ON storage.objects;
    
    -- Create policies
    CREATE POLICY "Allow authenticated users to upload account attachments"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'account-attachments' AND
      (storage.foldername(name))[1] IS NOT NULL
    );
    
    CREATE POLICY "Allow authenticated users to read account attachments"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'account-attachments');
    
    CREATE POLICY "Allow authenticated users to delete account attachments"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'account-attachments');
    
    RAISE NOTICE 'Storage bucket policies created for account-attachments';
  ELSE
    RAISE NOTICE 'Storage bucket account-attachments does not exist. Create it via Dashboard first.';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables exist
DO $$
BEGIN
  RAISE NOTICE '=== Migration Verification ===';
  RAISE NOTICE 'user_notification_states exists: %', 
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_notification_states');
  RAISE NOTICE 'yearly_official_estimates exists: %', 
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'yearly_official_estimates');
  RAISE NOTICE 'account_attachments exists: %', 
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'account_attachments');
  RAISE NOTICE 'accounts.notes column exists: %', 
    EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'notes');
  RAISE NOTICE 'estimates.crm_tags column exists: %', 
    EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'crm_tags');
  RAISE NOTICE '=== Migration Complete ===';
END $$;

