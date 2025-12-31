-- ============================================================================
-- PRODUCTION SUPABASE MIGRATION - COMPLETE SCRIPT
-- ============================================================================
-- Run this entire script in Supabase SQL Editor
-- All scripts are idempotent (safe to run multiple times)
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 0: CORE TABLES (Accounts, Contacts, Estimates, Jobsites, etc.)
-- ============================================================================

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  lmn_crm_id text UNIQUE,
  name text,
  account_type text,
  status text DEFAULT 'active',
  classification text,
  revenue_segment text,
  annual_revenue numeric(12,2),
  organization_score numeric,
  tags text[],
  address_1 text,
  address_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  source text,
  created_date timestamptz,
  last_interaction_date timestamptz,
  renewal_date timestamptz,
  snoozed_until timestamptz,
  archived boolean DEFAULT false,
  icp_status text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id text PRIMARY KEY,
  lmn_contact_id text UNIQUE,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  account_name text,
  first_name text,
  last_name text,
  email text,
  email_1 text,
  email_2 text,
  phone text,
  phone_1 text,
  phone_2 text,
  position text,
  title text,
  role text,
  primary_contact boolean DEFAULT false,
  do_not_email boolean DEFAULT false,
  do_not_mail boolean DEFAULT false,
  do_not_call boolean DEFAULT false,
  referral_source text,
  notes text,
  source text,
  created_date timestamptz,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lmn_estimate_id text UNIQUE,
  estimate_number text,
  estimate_type text,
  estimate_date timestamptz,
  estimate_close_date timestamptz,
  contract_start timestamptz,
  contract_end timestamptz,
  project_name text,
  version text,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  lmn_contact_id text,
  contact_name text,
  address text,
  billing_address text,
  phone_1 text,
  phone_2 text,
  email text,
  salesperson text,
  estimator text,
  status text,
  pipeline_status text,
  proposal_first_shared timestamptz,
  proposal_last_shared timestamptz,
  proposal_last_updated timestamptz,
  division text,
  referral text,
  referral_note text,
  confidence_level text,
  archived boolean DEFAULT false,
  exclude_stats boolean DEFAULT false,
  material_cost numeric(12,2),
  material_price numeric(12,2),
  labor_cost numeric(12,2),
  labor_price numeric(12,2),
  labor_hours numeric,
  equipment_cost numeric(12,2),
  equipment_price numeric(12,2),
  other_costs numeric(12,2),
  other_price numeric(12,2),
  sub_costs numeric(12,2),
  sub_price numeric(12,2),
  total_price numeric(12,2),
  total_price_with_tax numeric(12,2),
  total_cost numeric(12,2),
  total_overhead numeric(12,2),
  breakeven numeric(12,2),
  total_profit numeric(12,2),
  predicted_sales numeric(12,2),
  crm_tags text,
  source text,
  created_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create jobsites table
CREATE TABLE IF NOT EXISTS jobsites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lmn_jobsite_id text UNIQUE,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  lmn_contact_id text,
  contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name text,
  name text,
  address_1 text,
  address_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  notes text,
  source text,
  created_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create scorecard_responses table
CREATE TABLE IF NOT EXISTS scorecard_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text,
  template_id text,
  template_name text,
  responses jsonb,
  section_scores jsonb,
  total_score numeric,
  normalized_score numeric,
  is_pass boolean,
  scorecard_date date,
  completed_by text,
  completed_date timestamptz,
  scorecard_type text DEFAULT 'manual',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for core tables
CREATE INDEX IF NOT EXISTS idx_accounts_lmn_crm_id ON accounts(lmn_crm_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lmn_contact_id ON contacts(lmn_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_lmn_estimate_id ON estimates(lmn_estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_account_id ON estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_lmn_jobsite_id ON jobsites(lmn_jobsite_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_account_id ON jobsites(account_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_account_id ON scorecard_responses(account_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_template_id ON scorecard_responses(template_id);

-- Create set_updated_at function (used by multiple tables)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for core tables
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_estimates_updated_at ON estimates;
CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_jobsites_updated_at ON jobsites;
CREATE TRIGGER trg_jobsites_updated_at
  BEFORE UPDATE ON jobsites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_scorecard_responses_updated_at ON scorecard_responses;
CREATE TRIGGER trg_scorecard_responses_updated_at
  BEFORE UPDATE ON scorecard_responses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS on core tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobsites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for core tables (allow all authenticated users)
DROP POLICY IF EXISTS accounts_authenticated_all ON accounts;
CREATE POLICY accounts_authenticated_all ON accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contacts_authenticated_all ON contacts;
CREATE POLICY contacts_authenticated_all ON contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS estimates_authenticated_all ON estimates;
CREATE POLICY estimates_authenticated_all ON estimates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS jobsites_authenticated_all ON jobsites;
CREATE POLICY jobsites_authenticated_all ON jobsites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS scorecard_responses_authenticated_all ON scorecard_responses;
CREATE POLICY scorecard_responses_authenticated_all ON scorecard_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

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
-- SECTION 2: ADDITIONAL TABLES (Interactions, Profiles, Tasks, Sequences, etc.)
-- ============================================================================

-- Create interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  type text NOT NULL,
  subject text,
  content text,
  direction text,
  sentiment text,
  interaction_date timestamptz NOT NULL,
  logged_by text,
  tags text[],
  gmail_thread_id text,
  gmail_message_id text,
  gmail_link text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_interaction_date ON interactions(interaction_date);
CREATE INDEX IF NOT EXISTS idx_interactions_gmail_message_id ON interactions(gmail_message_id);

DROP TRIGGER IF EXISTS trg_interactions_updated_at ON interactions;
CREATE TRIGGER trg_interactions_updated_at
  BEFORE UPDATE ON interactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS interactions_authenticated_all ON interactions;
CREATE POLICY interactions_authenticated_all ON interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_task_id text,
  related_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  scheduled_for timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_related_account_id ON notifications(related_account_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_task_id ON notifications(related_task_id);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_authenticated_all ON notifications;
CREATE POLICY notifications_authenticated_all ON notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create notification_snoozes table
CREATE TABLE IF NOT EXISTS notification_snoozes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  related_account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  snoozed_until timestamptz NOT NULL,
  snoozed_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(notification_type, related_account_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_snoozes_type ON notification_snoozes(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_account_id ON notification_snoozes(related_account_id);
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_snoozed_until ON notification_snoozes(snoozed_until);

CREATE OR REPLACE FUNCTION set_notification_snoozes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_snoozes_updated_at ON notification_snoozes;
CREATE TRIGGER trg_notification_snoozes_updated_at
  BEFORE UPDATE ON notification_snoozes 
  FOR EACH ROW EXECUTE FUNCTION set_notification_snoozes_updated_at();

ALTER TABLE notification_snoozes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_snoozes_authenticated_all ON notification_snoozes;
CREATE POLICY notification_snoozes_authenticated_all ON notification_snoozes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to text,
  due_date date,
  due_time time,
  priority text DEFAULT 'normal',
  status text DEFAULT 'todo',
  category text DEFAULT 'other',
  related_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  related_contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  estimated_time integer DEFAULT 30,
  labels text[] DEFAULT '{}',
  subtasks jsonb DEFAULT '[]',
  "order" integer DEFAULT 0,
  completed_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_related_account_id ON tasks(related_account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_contact_id ON tasks(related_contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON tasks;
CREATE POLICY "Allow all operations for authenticated users" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  storage_path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_user_id ON task_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON task_attachments(created_at);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON task_attachments;
CREATE POLICY "Allow all operations for authenticated users" ON task_attachments
  FOR ALL USING (true) WITH CHECK (true);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);

DROP TRIGGER IF EXISTS trg_task_comments_updated_at ON task_comments;
CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON task_comments;
CREATE POLICY "Allow all operations for authenticated users" ON task_comments
  FOR ALL USING (true) WITH CHECK (true);

-- Create sequences table
CREATE TABLE IF NOT EXISTS sequences (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  account_type text DEFAULT 'general',
  is_active boolean DEFAULT true,
  steps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequences_account_type ON sequences(account_type);
CREATE INDEX IF NOT EXISTS idx_sequences_is_active ON sequences(is_active);
CREATE INDEX IF NOT EXISTS idx_sequences_name ON sequences(name);

DROP TRIGGER IF EXISTS trg_sequences_updated_at ON sequences;
CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON sequences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sequences_authenticated_all ON sequences;
CREATE POLICY sequences_authenticated_all ON sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create sequence_enrollments table
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id text PRIMARY KEY,
  account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  sequence_id text NOT NULL,
  status text DEFAULT 'active',
  current_step integer DEFAULT 1,
  started_date date,
  next_action_date date,
  completed_steps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_account_id ON sequence_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_action_date ON sequence_enrollments(next_action_date);

DROP TRIGGER IF EXISTS trg_sequence_enrollments_updated_at ON sequence_enrollments;
CREATE TRIGGER trg_sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sequence_enrollments_authenticated_all ON sequence_enrollments;
CREATE POLICY sequence_enrollments_authenticated_all ON sequence_enrollments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sequence_enrollments_service_role_all ON sequence_enrollments;
CREATE POLICY sequence_enrollments_service_role_all ON sequence_enrollments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create scorecard_templates table
CREATE TABLE IF NOT EXISTS scorecard_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  pass_threshold numeric DEFAULT 70,
  total_possible_score numeric,
  questions jsonb,
  version_number integer DEFAULT 1,
  is_current_version boolean DEFAULT true,
  parent_template_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_scorecard_templates_name ON scorecard_templates(name);
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_default ON scorecard_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_current ON scorecard_templates(is_current_version) WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_parent ON scorecard_templates(parent_template_id);

DROP TRIGGER IF EXISTS trg_scorecard_templates_updated_at ON scorecard_templates;
CREATE TRIGGER trg_scorecard_templates_updated_at
  BEFORE UPDATE ON scorecard_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scorecard_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scorecard_templates_authenticated_all ON scorecard_templates;
CREATE POLICY scorecard_templates_authenticated_all ON scorecard_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_id text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_enabled ON user_permissions(enabled);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_permissions_select_all ON user_permissions;
CREATE POLICY user_permissions_select_all ON user_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_permissions_admin_all ON user_permissions;
CREATE POLICY user_permissions_admin_all ON user_permissions
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('system_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('system_admin', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION set_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER trg_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions 
  FOR EACH ROW EXECUTE FUNCTION set_user_permissions_updated_at();

-- ============================================================================
-- SECTION 3: YEARLY OFFICIAL DATA TABLE (REQUIRED FOR REPORTS)
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

