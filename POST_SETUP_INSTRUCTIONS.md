# Post-Setup Instructions for LECRM Production

After running the main schema (`supabase-exported-schema.sql`), follow these steps:

## Step 1: Run Post-Setup SQL

1. Go to your new Supabase production project
2. Open SQL Editor
3. Copy and paste the contents of `post-setup-complete.sql`
4. Click "Run"

This will:
- ✅ Create storage buckets (task-attachments, account-attachments)
- ✅ Set up storage bucket RLS policies
- ✅ Set up system admin user profile (if user exists in Authentication)

## Step 2: Create System Admin User (Manual)

**IMPORTANT:** The SQL script needs the user to exist in Authentication first.

1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - **Email:** `jrsschroeder@gmail.com`
   - **Password:** (set a secure password)
   - **Auto Confirm User:** ✅ (checked)
4. Click **"Create user"**
5. Go back to SQL Editor and run **only the System Admin section** from `post-setup-complete.sql` (or re-run the whole file)

## Step 3: Update Vercel Environment Variables

1. Go to **Vercel Dashboard** → Your Production Project (`lecrm`)
2. Go to **Settings → Environment Variables**
3. Update these variables with your **new production Supabase project** credentials:

   | Variable | Value |
   |----------|-------|
   | `SUPABASE_URL` | Your new production Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your new production service role key |
   | `VITE_SUPABASE_URL` | Same as SUPABASE_URL |
   | `VITE_SUPABASE_ANON_KEY` | Your new production anon key |

4. **Redeploy** the project:
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**

## Step 4: Verify Everything Works

### Check Tables
1. Go to **Supabase Dashboard → Table Editor**
2. Verify all tables exist:
   - accounts, contacts, profiles, user_permissions
   - tasks, task_comments, task_attachments, account_attachments
   - estimates, jobsites, interactions
   - notifications, notification_snoozes
   - sequences, sequence_enrollments
   - scorecard_templates, scorecard_responses

### Check Storage Buckets
1. Go to **Supabase Dashboard → Storage**
2. Verify buckets exist:
   - `task-attachments` (private, 10MB limit)
   - `account-attachments` (private, 10MB limit)

### Test Login
1. Go to your production app URL
2. Login with `jrsschroeder@gmail.com`
3. Verify you have admin access
4. Test file uploads (task attachments and account attachments)

## Troubleshooting

### Storage Buckets Not Created
If the SQL method didn't work, create them manually:
1. Go to **Supabase Dashboard → Storage**
2. Click **"New bucket"**
3. For each bucket:
   - Name: `task-attachments` or `account-attachments`
   - Public: **OFF** (private)
   - File size limit: `10485760` (10MB)
   - Click **"Create bucket"**

### System Admin Not Working
1. Verify user exists in **Authentication → Users**
2. Re-run the System Admin section from `post-setup-complete.sql`
3. Check the verification query output to see the role

### Vercel Not Connecting
1. Double-check environment variables are set correctly
2. Make sure you redeployed after updating variables
3. Check Vercel build logs for errors
4. Verify Supabase project URL and keys are correct

## Quick Reference

**Get Supabase Credentials:**
- Go to **Supabase Dashboard → Settings → API**
- Copy:
  - Project URL → `SUPABASE_URL` and `VITE_SUPABASE_URL`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
  - `anon` key → `VITE_SUPABASE_ANON_KEY`

**Files to Run (in order):**
1. `supabase-exported-schema.sql` (main schema)
2. `post-setup-complete.sql` (storage buckets, policies, admin setup)

**Manual Steps:**
1. Create user in Authentication Dashboard
2. Update Vercel environment variables
3. Redeploy Vercel project

