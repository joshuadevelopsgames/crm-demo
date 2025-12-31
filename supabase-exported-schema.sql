-- ============================================
-- LECRM Database Schema (Exported from Supabase)
-- This is a clean, executable version of the exported schema
-- Run this in your new Supabase production project
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLES (in dependency order)
-- ============================================

-- Accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id text NOT NULL,
  lmn_crm_id text UNIQUE,
  name text,
  account_type text,
  status text DEFAULT 'active'::text,
  classification text,
  revenue_segment text,
  annual_revenue numeric,
  organization_score numeric,
  tags text[],
  address_1 text,
  address_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  source text,
  created_date timestamp with time zone,
  last_interaction_date timestamp with time zone,
  renewal_date timestamp with time zone,
  snoozed_until timestamp with time zone,
  archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  icp_required boolean DEFAULT true,
  icp_status text DEFAULT 'required'::text,
  notes text,
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);

-- Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id text NOT NULL,
  lmn_contact_id text UNIQUE,
  account_id text,
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
  created_date timestamp with time zone,
  archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL
);

-- Profiles table (for user management)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['system_admin'::text, 'admin'::text, 'user'::text])),
  phone_number text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_id text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Sequences table
CREATE TABLE IF NOT EXISTS public.sequences (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  account_type text DEFAULT 'general'::text,
  is_active boolean DEFAULT true,
  steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sequences_pkey PRIMARY KEY (id)
);

-- Sequence enrollments table
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id text NOT NULL,
  account_id text,
  sequence_id text NOT NULL,
  status text DEFAULT 'active'::text,
  current_step integer DEFAULT 1,
  started_date date,
  next_action_date date,
  completed_steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sequence_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT sequence_enrollments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  CONSTRAINT sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to text,
  due_date date,
  due_time time without time zone,
  priority text DEFAULT 'normal'::text,
  status text DEFAULT 'todo'::text,
  category text DEFAULT 'other'::text,
  related_account_id text,
  related_contact_id text,
  estimated_time integer DEFAULT 30,
  labels text[] DEFAULT '{}'::text[],
  subtasks jsonb DEFAULT '[]'::jsonb,
  "order" integer DEFAULT 0,
  completed_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  recurrence_interval integer DEFAULT 1,
  recurrence_days_of_week integer[],
  recurrence_day_of_month integer,
  recurrence_end_date date,
  recurrence_count integer,
  parent_task_id uuid,
  next_recurrence_date date,
  blocked_by_task_id uuid,
  sequence_enrollment_id text,
  sequence_step_number integer,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_related_account_id_fkey FOREIGN KEY (related_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  CONSTRAINT tasks_related_contact_id_fkey FOREIGN KEY (related_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL,
  CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL,
  CONSTRAINT tasks_blocked_by_task_id_fkey FOREIGN KEY (blocked_by_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL
);

-- Task comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id text NOT NULL,
  user_email text,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_comments_pkey PRIMARY KEY (id),
  CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);

-- Task attachments table
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id text NOT NULL,
  user_email text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  storage_path text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);

-- Account attachments table
CREATE TABLE IF NOT EXISTS public.account_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  user_email text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  storage_path text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT account_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT account_attachments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE
);

-- Estimates table
CREATE TABLE IF NOT EXISTS public.estimates (
  id text NOT NULL,
  lmn_estimate_id text UNIQUE,
  estimate_number text,
  estimate_type text,
  estimate_date timestamp with time zone,
  estimate_close_date timestamp with time zone,
  contract_start timestamp with time zone,
  contract_end timestamp with time zone,
  project_name text,
  version text,
  account_id text,
  contact_id text,
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
  proposal_first_shared timestamp with time zone,
  proposal_last_shared timestamp with time zone,
  proposal_last_updated timestamp with time zone,
  division text,
  referral text,
  referral_note text,
  confidence_level text,
  archived boolean DEFAULT false,
  exclude_stats boolean DEFAULT false,
  material_cost numeric,
  material_price numeric,
  labor_cost numeric,
  labor_price numeric,
  labor_hours numeric,
  equipment_cost numeric,
  equipment_price numeric,
  other_costs numeric,
  other_price numeric,
  sub_costs numeric,
  sub_price numeric,
  total_price numeric,
  total_price_with_tax numeric,
  total_cost numeric,
  total_overhead numeric,
  breakeven numeric,
  total_profit numeric,
  predicted_sales numeric,
  source text,
  created_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estimates_pkey PRIMARY KEY (id),
  CONSTRAINT estimates_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  CONSTRAINT estimates_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL
);

-- Jobsites table
CREATE TABLE IF NOT EXISTS public.jobsites (
  id text NOT NULL,
  lmn_jobsite_id text UNIQUE,
  account_id text,
  lmn_contact_id text,
  contact_id text,
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
  created_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT jobsites_pkey PRIMARY KEY (id),
  CONSTRAINT jobsites_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  CONSTRAINT jobsites_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL
);

-- Interactions table
CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id text,
  contact_id text,
  type text NOT NULL,
  subject text,
  content text,
  direction text,
  sentiment text,
  interaction_date timestamp with time zone NOT NULL,
  logged_by text,
  tags text[],
  gmail_thread_id text,
  gmail_message_id text,
  gmail_link text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interactions_pkey PRIMARY KEY (id),
  CONSTRAINT interactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  CONSTRAINT interactions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_task_id text,
  related_account_id text,
  is_read boolean DEFAULT false,
  scheduled_for timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_related_account_id_fkey FOREIGN KEY (related_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL
);

-- Notification snoozes table
CREATE TABLE IF NOT EXISTS public.notification_snoozes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  related_account_id text,
  snoozed_until timestamp with time zone NOT NULL,
  snoozed_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_snoozes_pkey PRIMARY KEY (id),
  CONSTRAINT notification_snoozes_related_account_id_fkey FOREIGN KEY (related_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL
);

-- Scorecard templates table
CREATE TABLE IF NOT EXISTS public.scorecard_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text,
  CONSTRAINT scorecard_templates_pkey PRIMARY KEY (id)
);

-- Scorecard responses table
CREATE TABLE IF NOT EXISTS public.scorecard_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  completed_date timestamp with time zone,
  scorecard_type text DEFAULT 'manual'::text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  template_version_id text,
  CONSTRAINT scorecard_responses_pkey PRIMARY KEY (id),
  CONSTRAINT scorecard_responses_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES (for performance)
-- ============================================

-- Accounts indexes
CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON public.accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_revenue_segment ON public.accounts(revenue_segment);
CREATE INDEX IF NOT EXISTS idx_accounts_last_interaction_date ON public.accounts(last_interaction_date);
CREATE INDEX IF NOT EXISTS idx_accounts_archived ON public.accounts(archived);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_archived ON public.contacts(archived);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_related_account_id ON public.tasks(related_account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_contact_id ON public.tasks(related_contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_blocked_by_task_id ON public.tasks(blocked_by_task_id);

-- Task attachments indexes
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_user_id ON public.task_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON public.task_attachments(created_at);

-- Account attachments indexes
CREATE INDEX IF NOT EXISTS idx_account_attachments_account_id ON public.account_attachments(account_id);
CREATE INDEX IF NOT EXISTS idx_account_attachments_user_id ON public.account_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_account_attachments_created_at ON public.account_attachments(created_at);

-- Interactions indexes
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON public.interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON public.interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_interaction_date ON public.interactions(interaction_date);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_related_account_id ON public.notifications(related_account_id);

-- Estimates indexes
CREATE INDEX IF NOT EXISTS idx_estimates_account_id ON public.estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_contact_id ON public.estimates(contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);

-- Sequence enrollments indexes
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_account_id ON public.sequence_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON public.sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON public.sequence_enrollments(status);

-- ============================================
-- TRIGGERS (for updated_at timestamps)
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobsites_updated_at BEFORE UPDATE ON public.jobsites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON public.interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_snoozes_updated_at BEFORE UPDATE ON public.notification_snoozes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at BEFORE UPDATE ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequence_enrollments_updated_at BEFORE UPDATE ON public.sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scorecard_templates_updated_at BEFORE UPDATE ON public.scorecard_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scorecard_responses_updated_at BEFORE UPDATE ON public.scorecard_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobsites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_snoozes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_responses ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (allow all for authenticated users)
-- You may want to customize these based on your security requirements

CREATE POLICY "Allow all operations for authenticated users" ON public.accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.user_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.task_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.task_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.account_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.estimates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.jobsites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.notification_snoozes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.sequence_enrollments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.scorecard_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.scorecard_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

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

