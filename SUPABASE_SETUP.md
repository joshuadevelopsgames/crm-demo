# Supabase Integration Setup

## Step 1: Get Your Supabase Credentials

1. **Go to your Supabase project dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Get your Project URL:**
   - Go to **Settings** → **API**
   - Copy the **Project URL** (looks like: `https://xxxxx.supabase.co`)

3. **Get your API Keys:**
   - In the same **Settings** → **API** page:
   - Copy the **anon/public** key (for client-side, optional)
   - Copy the **service_role** key (for server-side, required)
     - ⚠️ **Important:** The service_role key has admin access. Keep it secret!

---

## Step 2: Add Environment Variables to Vercel

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project

2. **Go to Settings → Environment Variables**

3. **Add these variables:**

   **For Production:**
   - `SUPABASE_URL` = Your Project URL (e.g., `https://xxxxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service_role key
   - `VITE_SUPABASE_URL` = Same Project URL (for client-side, optional)
   - `VITE_SUPABASE_ANON_KEY` = Your anon/public key (for client-side, optional)

   **For Preview/Development:**
   - Add the same variables to Preview and Development environments

4. **Click "Save"**

---

## Step 3: Create Database Tables

Run this SQL in your Supabase SQL Editor:

1. **Go to Supabase Dashboard** → **SQL Editor**
2. **Click "New Query"**
3. **Paste the SQL below:**
4. **Click "Run"**

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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_lmn_crm_id ON accounts(lmn_crm_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lmn_contact_id ON contacts(lmn_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_lmn_estimate_id ON estimates(lmn_estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_account_id ON estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_lmn_jobsite_id ON jobsites(lmn_jobsite_id);
CREATE INDEX IF NOT EXISTS idx_jobsites_account_id ON jobsites(account_id);

-- Enable Row Level Security (RLS) - allows public read/write for now
-- You can restrict this later based on authentication
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobsites ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for now)
-- You can restrict these later based on your auth requirements
CREATE POLICY "Allow all operations on accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on estimates" ON estimates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on jobsites" ON jobsites FOR ALL USING (true) WITH CHECK (true);
```

---

## Step 4: Install Supabase Client

Run this command:

```bash
npm install @supabase/supabase-js
```

---

## Step 5: Deploy

After adding environment variables and creating tables:

1. **Redeploy your Vercel project** (or push to trigger auto-deploy)
2. **Test the import** - Data should now persist in Supabase!

---

## Verify It's Working

1. **Import some data** in your app
2. **Go to Supabase Dashboard** → **Table Editor**
3. **Check the tables** - You should see your imported data!

---

---

## ✅ Integration Complete!

I've already updated all API endpoints to use Supabase. Here's what's done:

- ✅ `/api/data/accounts` - Uses Supabase
- ✅ `/api/data/contacts` - Uses Supabase
- ✅ `/api/data/estimates` - Uses Supabase
- ✅ `/api/data/jobsites` - Uses Supabase

---

## Quick Setup Checklist

1. ✅ **Supabase client installed** (`@supabase/supabase-js`)
2. ⏳ **Create database tables** (run SQL from Step 3 above)
3. ⏳ **Add environment variables to Vercel** (Step 2)
4. ⏳ **Deploy** (push code or redeploy)

---

## After Setup

Once you've:
- Created the tables in Supabase
- Added environment variables to Vercel
- Deployed

Your data will be **permanently stored** in Supabase and will persist across:
- ✅ Page reloads
- ✅ Browser restarts
- ✅ Vercel deployments
- ✅ Server restarts

**Everything is ready - just need to create the tables and add the env vars!**





