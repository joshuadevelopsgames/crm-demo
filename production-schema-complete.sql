-- ============================================
-- LECRM Production Database Schema
-- Complete schema export for new Supabase project
-- ============================================
-- 
-- Instructions:
-- 1. Create a new Supabase project for production
-- 2. Go to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Run it
-- 5. Create storage buckets manually (see notes at end)
-- 6. Update Vercel environment variables
-- 
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main schema tables
-- Ensure pgcrypto is available for gen_random_uuid()
-- (pgcrypto is already installed in this project)

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
-- Note: account_id is text to match application IDs, but we don't use a foreign key
-- constraint because accounts.id is UUID while the app passes text IDs
CREATE TABLE IF NOT EXISTS scorecard_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text, -- No FK constraint: accounts.id is UUID but app uses text IDs
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_lmn_crm_id ON accounts(lmn_crm_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lmn_contact_id ON contacts(lmn_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_lmn_estimate_id ON estimates(lmn_estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_account_id ON estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_lmn_jobsite_id ON jobsites(lmn_jobsite_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_account_id ON jobsites(account_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_account_id ON scorecard_responses(account_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_template_id ON scorecard_responses(template_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_completed_date ON scorecard_responses(completed_date);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS trg_estimates_updated_at ON estimates;
DROP TRIGGER IF EXISTS trg_jobsites_updated_at ON jobsites;
DROP TRIGGER IF EXISTS trg_scorecard_responses_updated_at ON scorecard_responses;

-- Create triggers
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_jobsites_updated_at
  BEFORE UPDATE ON jobsites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_scorecard_responses_updated_at
  BEFORE UPDATE ON scorecard_responses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobsites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_responses ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS accounts_authenticated_all ON accounts;
DROP POLICY IF EXISTS contacts_authenticated_all ON contacts;
DROP POLICY IF EXISTS estimates_authenticated_all ON estimates;
DROP POLICY IF EXISTS jobsites_authenticated_all ON jobsites;
DROP POLICY IF EXISTS scorecard_responses_authenticated_all ON scorecard_responses;

-- RLS policies: restrict to authenticated users
-- Note: service_role key bypasses RLS, so API endpoints will work fine
CREATE POLICY accounts_authenticated_all ON accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY contacts_authenticated_all ON contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY estimates_authenticated_all ON estimates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY jobsites_authenticated_all ON jobsites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY scorecard_responses_authenticated_all ON scorecard_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- add_profiles_table.sql
-- Create profiles table for additional user information
-- This extends Supabase's built-in auth.users table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Function to automatically create profile when user signs up
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

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update trigger for profiles
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- add_user_roles.sql
-- Add role field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Update existing profiles to have 'user' role by default
UPDATE profiles SET role = 'user' WHERE role IS NULL;

-- Set the first user (jrsschroeder@gmail.com) as admin
-- Note: This will update the profile when the user exists
-- You may need to run this after creating the user account
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jrsschroeder@gmail.com';

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Add comment to document roles
COMMENT ON COLUMN profiles.role IS 'User role: admin (full access) or user (limited access, no ICP management)';

-- create_user_permissions_table.sql
-- Create user_permissions table for granular permission control
-- Allows system admin to enable/disable individual permissions for any user
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_id text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_enabled ON user_permissions(enabled);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all authenticated users to read all permissions (needed for admin management)
CREATE POLICY user_permissions_select_all ON user_permissions
  FOR SELECT TO authenticated USING (true);

-- RLS Policy: Only admins can insert/update/delete permissions
-- System admin and admin roles can manage permissions
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

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions 
  FOR EACH ROW EXECUTE FUNCTION set_user_permissions_updated_at();

-- Add comment
COMMENT ON TABLE user_permissions IS 'Stores individual permissions for each user. System admin can enable/disable any permission for any user.';


-- create_tasks_table.sql
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_related_account_id ON tasks(related_account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_contact_id ON tasks(related_contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Enable Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
-- For now, allowing all authenticated users to read/write
CREATE POLICY "Allow all operations for authenticated users" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- add_recurring_tasks_schema.sql
-- Add recurring task fields to tasks table
-- This allows tasks to repeat on a schedule (daily, weekly, monthly, etc.)

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern text, -- 'daily', 'weekly', 'monthly', 'yearly', 'custom'
ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1, -- Every N days/weeks/months
ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[], -- For weekly: [1,3,5] = Mon, Wed, Fri (0=Sunday, 6=Saturday)
ADD COLUMN IF NOT EXISTS recurrence_day_of_month integer, -- For monthly: day of month (1-31)
ADD COLUMN IF NOT EXISTS recurrence_end_date date, -- When to stop recurring (null = never)
ADD COLUMN IF NOT EXISTS recurrence_count integer, -- Number of occurrences (null = unlimited)
ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE, -- Link to original recurring task
ADD COLUMN IF NOT EXISTS next_recurrence_date date; -- When next instance should be created

-- Create indexes for recurring task queries
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_next_recurrence_date ON tasks(next_recurrence_date);

-- Add comment to explain the fields
COMMENT ON COLUMN tasks.is_recurring IS 'Whether this task repeats on a schedule';
COMMENT ON COLUMN tasks.recurrence_pattern IS 'Pattern: daily, weekly, monthly, yearly, custom';
COMMENT ON COLUMN tasks.recurrence_interval IS 'Every N days/weeks/months (e.g., every 2 weeks = interval 2, pattern weekly)';
COMMENT ON COLUMN tasks.recurrence_days_of_week IS 'For weekly: array of day numbers (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN tasks.recurrence_day_of_month IS 'For monthly: day of month (1-31)';
COMMENT ON COLUMN tasks.recurrence_end_date IS 'When to stop recurring (null = never)';
COMMENT ON COLUMN tasks.recurrence_count IS 'Number of occurrences (null = unlimited)';
COMMENT ON COLUMN tasks.parent_task_id IS 'Link to original recurring task template';
COMMENT ON COLUMN tasks.next_recurrence_date IS 'When next instance should be created';


-- add_task_comments_schema.sql
-- Create task_comments table
-- Allows users to add comments to tasks for collaboration and context

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON task_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE task_comments IS 'Comments on tasks for collaboration and context';
COMMENT ON COLUMN task_comments.task_id IS 'The task this comment belongs to';
COMMENT ON COLUMN task_comments.user_id IS 'ID of the user who created the comment';
COMMENT ON COLUMN task_comments.user_email IS 'Email of the user who created the comment (for display)';
COMMENT ON COLUMN task_comments.content IS 'The comment text content';


-- add_task_attachments_schema.sql
-- Create task_attachments table
-- Allows users to attach files to tasks

CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer, -- Size in bytes
  file_type text, -- MIME type (e.g., 'image/png', 'application/pdf')
  storage_path text, -- Path in storage bucket
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_user_id ON task_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON task_attachments(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON task_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE task_attachments IS 'File attachments on tasks';
COMMENT ON COLUMN task_attachments.task_id IS 'The task this attachment belongs to';
COMMENT ON COLUMN task_attachments.user_id IS 'ID of the user who uploaded the attachment';
COMMENT ON COLUMN task_attachments.user_email IS 'Email of the user who uploaded (for display)';
COMMENT ON COLUMN task_attachments.file_name IS 'Original filename';
COMMENT ON COLUMN task_attachments.file_url IS 'URL to access the file (Supabase Storage or external)';
COMMENT ON COLUMN task_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN task_attachments.file_type IS 'MIME type of the file';
COMMENT ON COLUMN task_attachments.storage_path IS 'Path in storage bucket (for deletion)';


-- add_task_blocking_schema.sql
-- Add task blocking/dependency fields to tasks table
-- This allows tasks to be blocked until previous tasks are completed

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS blocked_by_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sequence_enrollment_id text,
ADD COLUMN IF NOT EXISTS sequence_step_number integer;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_blocked_by_task_id ON tasks(blocked_by_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sequence_enrollment_id ON tasks(sequence_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sequence_step_number ON tasks(sequence_step_number);

-- Add comments
COMMENT ON COLUMN tasks.blocked_by_task_id IS 'Task ID that must be completed before this task can be started';
COMMENT ON COLUMN tasks.sequence_enrollment_id IS 'Sequence enrollment ID if this task was created from a sequence';
COMMENT ON COLUMN tasks.sequence_step_number IS 'Step number in the sequence if this task was created from a sequence';


-- create_sequences_table.sql
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sequences_account_type ON sequences(account_type);
CREATE INDEX IF NOT EXISTS idx_sequences_is_active ON sequences(is_active);
CREATE INDEX IF NOT EXISTS idx_sequences_name ON sequences(name);

-- Ensure set_updated_at function exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_sequences_updated_at ON sequences;
CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON sequences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS sequences_authenticated_all ON sequences;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY sequences_authenticated_all ON sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- create_sequence_enrollments_table.sql
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_account_id ON sequence_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_action_date ON sequence_enrollments(next_action_date);

-- Ensure set_updated_at function exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_sequence_enrollments_updated_at ON sequence_enrollments;
CREATE TRIGGER trg_sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS sequence_enrollments_authenticated_all ON sequence_enrollments;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY sequence_enrollments_authenticated_all ON sequence_enrollments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy to allow service role (for API operations)
CREATE POLICY sequence_enrollments_service_role_all ON sequence_enrollments
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- create_interactions_table.sql
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_interaction_date ON interactions(interaction_date);
CREATE INDEX IF NOT EXISTS idx_interactions_gmail_message_id ON interactions(gmail_message_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER trg_interactions_updated_at
  BEFORE UPDATE ON interactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS interactions_authenticated_all ON interactions;

-- RLS policy: restrict to authenticated users
CREATE POLICY interactions_authenticated_all ON interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- create_notifications_table.sql
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_related_account_id ON notifications(related_account_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_task_id ON notifications(related_task_id);

-- Ensure set_updated_at function exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS notifications_authenticated_all ON notifications;

-- RLS policy: allow all operations for authenticated users
CREATE POLICY notifications_authenticated_all ON notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- create_notification_snoozes_table.sql
-- Create notification_snoozes table for universal snooze tracking
-- When any user snoozes a notification, it disappears for ALL users
CREATE TABLE IF NOT EXISTS notification_snoozes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  related_account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  snoozed_until timestamptz NOT NULL,
  snoozed_by text, -- Track who snoozed it (optional, for audit)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(notification_type, related_account_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_type ON notification_snoozes(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_account_id ON notification_snoozes(related_account_id);
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_snoozed_until ON notification_snoozes(snoozed_until);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_notification_snoozes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_snoozes_updated_at
  BEFORE UPDATE ON notification_snoozes 
  FOR EACH ROW EXECUTE FUNCTION set_notification_snoozes_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE notification_snoozes ENABLE ROW LEVEL SECURITY;

-- RLS policy: all authenticated users can manage snoozes (universal)
CREATE POLICY notification_snoozes_authenticated_all ON notification_snoozes
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE notification_snoozes IS 'Tracks universal snoozes for notifications. When any user snoozes a notification, it disappears for ALL users until the snooze period ends.';


-- create_scorecard_templates_table.sql
-- Create scorecard_templates table with versioning support
CREATE TABLE IF NOT EXISTS scorecard_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false, -- Marks the ICP template
  pass_threshold numeric DEFAULT 70,
  total_possible_score numeric,
  questions jsonb,
  version_number integer DEFAULT 1,
  is_current_version boolean DEFAULT true, -- Only one version per template is current
  parent_template_id uuid, -- References the original template (for version history)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_name ON scorecard_templates(name);
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_default ON scorecard_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_current ON scorecard_templates(is_current_version) WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_parent ON scorecard_templates(parent_template_id);

-- Create trigger for updated_at
CREATE TRIGGER trg_scorecard_templates_updated_at
  BEFORE UPDATE ON scorecard_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE scorecard_templates ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS scorecard_templates_authenticated_all ON scorecard_templates;

-- RLS policy: restrict to authenticated users
CREATE POLICY scorecard_templates_authenticated_all ON scorecard_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- create_scorecard_responses_table.sql
-- Create scorecard_responses table
-- Note: account_id is text to match application IDs, but we don't use a foreign key
-- constraint because accounts.id is UUID while the app passes text IDs
CREATE TABLE IF NOT EXISTS scorecard_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text, -- No FK constraint: accounts.id is UUID but app uses text IDs
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_account_id ON scorecard_responses(account_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_template_id ON scorecard_responses(template_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_completed_date ON scorecard_responses(completed_date);

-- Create trigger for updated_at
CREATE TRIGGER trg_scorecard_responses_updated_at
  BEFORE UPDATE ON scorecard_responses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE scorecard_responses ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS scorecard_responses_authenticated_all ON scorecard_responses;

-- RLS policy: restrict to authenticated users
-- Note: service_role key bypasses RLS, so API endpoints will work fine
CREATE POLICY scorecard_responses_authenticated_all ON scorecard_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);



-- add_template_version_to_responses.sql
-- Add template_version_id to scorecard_responses to track which template version was used
ALTER TABLE scorecard_responses 
  ADD COLUMN IF NOT EXISTS template_version_id text;

-- Create index for faster lookups by template version
CREATE INDEX IF NOT EXISTS idx_scorecard_responses_template_version ON scorecard_responses(template_version_id);


-- alter_scorecard_responses_account_id.sql
-- Alter scorecard_responses table to change account_id from uuid to text
-- Note: We're removing the foreign key constraint because accounts.id is UUID
-- but the application passes text IDs. The relationship is maintained logically.

-- First, drop the foreign key constraint (if it exists)
ALTER TABLE scorecard_responses 
  DROP CONSTRAINT IF EXISTS scorecard_responses_account_id_fkey;

-- Change account_id column type from uuid to text
ALTER TABLE scorecard_responses 
  ALTER COLUMN account_id TYPE text USING account_id::text;

-- Change template_id column type from uuid to text (in case templates also use text IDs)
ALTER TABLE scorecard_responses 
  ALTER COLUMN template_id TYPE text USING template_id::text;

-- Note: We're NOT re-adding the foreign key constraint because:
-- 1. accounts.id is UUID type
-- 2. The application passes text IDs (like "1", "2")
-- 3. The relationship is maintained through application logic


-- add_account_attachments_schema.sql
-- Create account_attachments table
-- Allows users to attach files to accounts

CREATE TABLE IF NOT EXISTS account_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer, -- Size in bytes
  file_type text, -- MIME type (e.g., 'image/png', 'application/pdf')
  storage_path text, -- Path in storage bucket
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_attachments_account_id ON account_attachments(account_id);
CREATE INDEX IF NOT EXISTS idx_account_attachments_user_id ON account_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_account_attachments_created_at ON account_attachments(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE account_attachments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON account_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE account_attachments IS 'File attachments on accounts';
COMMENT ON COLUMN account_attachments.account_id IS 'The account this attachment belongs to';
COMMENT ON COLUMN account_attachments.user_id IS 'ID of the user who uploaded the attachment';
COMMENT ON COLUMN account_attachments.user_email IS 'Email of the user who uploaded (for display)';
COMMENT ON COLUMN account_attachments.file_name IS 'Original filename';
COMMENT ON COLUMN account_attachments.file_url IS 'URL to access the file (Supabase Storage or external)';
COMMENT ON COLUMN account_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN account_attachments.file_type IS 'MIME type of the file';
COMMENT ON COLUMN account_attachments.storage_path IS 'Path in storage bucket (for deletion)';


-- add_notes_to_accounts.sql
-- Add notes field to accounts table if it doesn't exist
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notes text;


-- add_icp_status_to_accounts.sql
-- Add ICP status fields to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_required BOOLEAN DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_status TEXT DEFAULT 'required';

-- Set residential accounts to N/A by default
UPDATE accounts 
SET icp_status = 'na', icp_required = false 
WHERE classification = 'residential' AND (icp_status IS NULL OR icp_status = 'required');

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_accounts_icp_status ON accounts(icp_status);

-- Add comment for documentation
COMMENT ON COLUMN accounts.icp_status IS 'ICP status: required, not_required, or na';
COMMENT ON COLUMN accounts.icp_required IS 'Whether ICP scorecard is required for this account';



-- add_snoozed_until_to_accounts.sql
-- Add snoozed_until field to accounts table
-- This allows accounts to be temporarily hidden from neglected accounts list

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- Add index for faster queries when filtering neglected accounts
CREATE INDEX IF NOT EXISTS idx_accounts_snoozed_until ON accounts(snoozed_until) 
WHERE snoozed_until IS NOT NULL;


-- add_phone_to_profiles.sql
-- Add phone_number column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- Add comment to document the field
COMMENT ON COLUMN profiles.phone_number IS 'User phone number for contact information';


-- add_admin_role_migration.sql
-- Migration: Add 'admin' role separate from 'system_admin'
-- This allows regular admins vs the special system admin (jrsschroeder@gmail.com)
-- Run this in Supabase SQL Editor

-- Step 1: Update the role constraint to allow three roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('system_admin', 'admin', 'user'));

-- Step 2: Update system admin (jrsschroeder@gmail.com) to 'system_admin' role
UPDATE profiles 
SET role = 'system_admin' 
WHERE email = 'jrsschroeder@gmail.com';

-- Step 3: Update any existing 'admin' roles to 'admin' (they stay as 'admin')
-- This is just to ensure consistency - existing admins remain as 'admin'

-- Step 4: Update the trigger function to use 'system_admin' for system admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    -- Set system_admin role for system admin email, otherwise default to 'user'
    CASE 
      WHEN NEW.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'system_admin'
      ELSE COALESCE(profiles.role, 'user')
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Verify the changes
SELECT 
  email,
  role,
  CASE 
    WHEN role = 'system_admin' THEN '✅ System Admin (Full access, cannot be deleted)'
    WHEN role = 'admin' THEN '✅ Admin (Full access, can manage users)'
    WHEN role = 'user' THEN '✅ User (Standard access)'
    ELSE '⚠️ Unknown role'
  END as role_description
FROM profiles
ORDER BY 
  CASE role
    WHEN 'system_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'user' THEN 3
  END,
  email;


-- fix_profiles_rls_for_admin.sql
-- Fix RLS policies on profiles table to allow admins to see all users
-- This is needed for the Permissions page to display all users
-- Run this in Supabase SQL Editor

-- Drop the existing restrictive policies
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_select_all_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_all_authenticated ON profiles;

-- Option 1: Allow all authenticated users to read all profiles
-- This is simpler and works well for internal/admin tools
-- If you need more security, use Option 2 below
CREATE POLICY profiles_select_all_authenticated ON profiles
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to update all profiles
-- (Admins can update any profile, regular users can update their own)
CREATE POLICY profiles_update_all_authenticated ON profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Option 2: More secure - only allow admins to see all profiles
-- Uncomment this and comment out Option 1 if you want stricter security
-- Note: This requires a function to check admin status without circular dependency
-- 
-- CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
-- RETURNS boolean AS $$
-- BEGIN
--   RETURN EXISTS (
--     SELECT 1 FROM profiles 
--     WHERE id = user_id 
--     AND role = 'admin'
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE POLICY profiles_select_own_or_admin ON profiles
--   FOR SELECT TO authenticated 
--   USING (
--     auth.uid() = id OR 
--     public.is_admin(auth.uid())
--   );
--
-- CREATE POLICY profiles_update_own_or_admin ON profiles
--   FOR UPDATE TO authenticated 
--   USING (
--     auth.uid() = id OR 
--     public.is_admin(auth.uid())
--   )
--   WITH CHECK (
--     auth.uid() = id OR 
--     public.is_admin(auth.uid())
--   );



-- ============================================
-- POST-SETUP INSTRUCTIONS
-- ============================================
-- 
-- After running this schema:
-- 
-- 1. CREATE STORAGE BUCKETS (in Supabase Dashboard → Storage):
--    - task-attachments (private, 10MB limit)
--    - account-attachments (private, 10MB limit)
-- 
-- 2. RUN STORAGE BUCKET POLICIES:
--    - Run create_task_attachments_bucket.sql
--    - Run create_account_attachments_bucket.sql
-- 
-- 3. SET UP SYSTEM ADMIN:
--    - Run SETUP_SYSTEM_ADMIN_FROM_SCRATCH.sql
--    - This creates the admin user (jrsschroeder@gmail.com)
-- 
-- 4. UPDATE VERCEL ENVIRONMENT VARIABLES:
--    - Go to Vercel Dashboard → Your Production Project
--    - Settings → Environment Variables
--    - Update SUPABASE_URL to new production project URL
--    - Update SUPABASE_SERVICE_ROLE_KEY to new production service role key
--    - Update VITE_SUPABASE_URL to new production project URL
--    - Update VITE_SUPABASE_ANON_KEY to new production anon key
--    - Redeploy the project
-- 
-- 5. VERIFY:
--    - Check that all tables exist in Table Editor
--    - Test login with admin account
--    - Verify storage buckets are accessible
-- 
-- ============================================
