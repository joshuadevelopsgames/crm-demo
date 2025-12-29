# Supabase Quick Start - 3 Steps

## ✅ Step 1: Create Database Tables (5 minutes)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor:**
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New Query"**

3. **Paste this SQL and run it:**

```sql
-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  lmn_crm_id TEXT UNIQUE,
  name TEXT,
  account_type TEXT,
  status TEXT DEFAULT 'active',
  classification TEXT,
  revenue_segment TEXT,
  annual_revenue NUMERIC,
  organization_score NUMERIC,
  tags TEXT[],
  address_1 TEXT,
  address_2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  source TEXT,
  created_date TIMESTAMP,
  last_interaction_date TIMESTAMP,
  renewal_date TIMESTAMP,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  lmn_contact_id TEXT UNIQUE,
  account_id TEXT,
  account_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  email_1 TEXT,
  email_2 TEXT,
  phone TEXT,
  phone_1 TEXT,
  phone_2 TEXT,
  position TEXT,
  title TEXT,
  role TEXT,
  primary_contact BOOLEAN DEFAULT false,
  do_not_email BOOLEAN DEFAULT false,
  do_not_mail BOOLEAN DEFAULT false,
  do_not_call BOOLEAN DEFAULT false,
  referral_source TEXT,
  notes TEXT,
  source TEXT,
  created_date TIMESTAMP,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id TEXT PRIMARY KEY,
  lmn_estimate_id TEXT UNIQUE,
  estimate_number TEXT,
  estimate_type TEXT,
  estimate_date TIMESTAMP,
  estimate_close_date TIMESTAMP,
  contract_start TIMESTAMP,
  contract_end TIMESTAMP,
  project_name TEXT,
  version TEXT,
  account_id TEXT,
  contact_id TEXT,
  lmn_contact_id TEXT,
  contact_name TEXT,
  address TEXT,
  billing_address TEXT,
  phone_1 TEXT,
  phone_2 TEXT,
  email TEXT,
  salesperson TEXT,
  estimator TEXT,
  status TEXT,
  pipeline_status TEXT,
  proposal_first_shared TIMESTAMP,
  proposal_last_shared TIMESTAMP,
  proposal_last_updated TIMESTAMP,
  division TEXT,
  referral TEXT,
  referral_note TEXT,
  confidence_level TEXT,
  archived BOOLEAN DEFAULT false,
  exclude_stats BOOLEAN DEFAULT false,
  material_cost NUMERIC,
  material_price NUMERIC,
  labor_cost NUMERIC,
  labor_price NUMERIC,
  labor_hours NUMERIC,
  equipment_cost NUMERIC,
  equipment_price NUMERIC,
  other_costs NUMERIC,
  other_price NUMERIC,
  sub_costs NUMERIC,
  sub_price NUMERIC,
  total_price NUMERIC,
  total_price_with_tax NUMERIC,
  total_cost NUMERIC,
  total_overhead NUMERIC,
  breakeven NUMERIC,
  total_profit NUMERIC,
  predicted_sales NUMERIC,
  source TEXT,
  created_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create jobsites table
CREATE TABLE IF NOT EXISTS jobsites (
  id TEXT PRIMARY KEY,
  lmn_jobsite_id TEXT UNIQUE,
  account_id TEXT,
  lmn_contact_id TEXT,
  contact_id TEXT,
  contact_name TEXT,
  name TEXT,
  address_1 TEXT,
  address_2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  notes TEXT,
  source TEXT,
  created_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_lmn_crm_id ON accounts(lmn_crm_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lmn_contact_id ON contacts(lmn_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_lmn_estimate_id ON estimates(lmn_estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_account_id ON estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_lmn_jobsite_id ON jobsites(lmn_jobsite_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_account_id ON jobsites(account_id);

-- Enable RLS and create policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobsites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on estimates" ON estimates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on jobsites" ON jobsites FOR ALL USING (true) WITH CHECK (true);
```

4. **Click "Run"** (or press Cmd/Ctrl + Enter)

---

## ✅ Step 2: Add Environment Variables to Vercel (2 minutes)

1. **Get your Supabase credentials:**
   - Go to Supabase Dashboard → **Settings** → **API**
   - Copy **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - Copy **service_role** key (the secret one, not anon key)

2. **Add to Vercel:**
   - Go to https://vercel.com/dashboard
   - Select your project
   - **Settings** → **Environment Variables**
   - Add these **for Production, Preview, and Development**:
     - `SUPABASE_URL` = Your Project URL
     - `SUPABASE_SERVICE_ROLE_KEY` = Your service_role key
   - Click **"Save"**

---

## ✅ Step 3: Deploy (1 minute)

The code is already updated! Just deploy:

```bash
# Option 1: Push to trigger auto-deploy
git add .
git commit -m "Add Supabase integration"
git push

# Option 2: Or redeploy in Vercel dashboard
```

---

## 🧪 Test It

1. **Import some data** in your app
2. **Go to Supabase Dashboard** → **Table Editor**
3. **Check the tables** - Your data should be there!
4. **Reload your website** - Data should still be there!

---

## ✅ Done!

Your data is now permanently stored in Supabase and will survive:
- ✅ Page reloads
- ✅ Browser restarts  
- ✅ Server restarts
- ✅ Deployments

**Everything is ready to go!**












