-- Ensure pgcrypto is available for gen_random_uuid()
-- (pgcrypto is already installed in this project)

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lmn_contact_id text UNIQUE,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
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
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
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
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  lmn_contact_id text,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_lmn_crm_id ON accounts(lmn_crm_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lmn_contact_id ON contacts(lmn_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_lmn_estimate_id ON estimates(lmn_estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_account_id ON estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_lmn_jobsite_id ON jobsites(lmn_jobsite_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_account_id ON jobsites(account_id);

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

-- Create triggers
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_jobsites_updated_at
  BEFORE UPDATE ON jobsites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobsites ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS accounts_authenticated_all ON accounts;
DROP POLICY IF EXISTS contacts_authenticated_all ON contacts;
DROP POLICY IF EXISTS estimates_authenticated_all ON estimates;
DROP POLICY IF EXISTS jobsites_authenticated_all ON jobsites;

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

