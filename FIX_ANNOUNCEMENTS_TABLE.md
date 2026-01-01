# Fix Missing announcements Table

## 🐛 Error
```
GET https://lecrm.vercel.app/api/data/announcements 500 (Internal Server Error)
```

The `announcements` table doesn't exist in your Supabase database.

## ✅ Solution: Create the Table

### Step 1: Go to Supabase SQL Editor

1. **Open:** https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. **Navigate to:** SQL Editor (left sidebar)
3. **Click:** "New query"

### Step 2: Run This SQL Script

Copy and paste this entire script into the SQL Editor:

```sql
-- Create announcements table
-- Only admins can create announcements, all users can view them
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements 
  FOR EACH ROW EXECUTE FUNCTION set_announcements_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS announcements_authenticated_read ON announcements;
DROP POLICY IF EXISTS announcements_admin_write ON announcements;

-- RLS policy: all authenticated users can read active announcements
CREATE POLICY announcements_authenticated_read ON announcements
  FOR SELECT TO authenticated 
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RLS policy: only admins can create/update/delete announcements
-- Check if user has admin or system_admin role in profiles table
CREATE POLICY announcements_admin_write ON announcements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  );

-- Add comment
COMMENT ON TABLE announcements IS 'System-wide announcements that can be created by admins and viewed by all users';
```

### Step 3: Execute

1. **Click:** "Run" button (or press `Cmd+Enter` / `Ctrl+Enter`)
2. **Wait for:** Success message
3. **Verify:** You should see "Success. No rows returned"

### Step 4: Verify the Table Exists

Run this query to verify:

```sql
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'announcements'
ORDER BY ordinal_position;
```

**Expected result:** You should see columns:
- `id` (uuid)
- `title` (text)
- `content` (text)
- `priority` (text)
- `created_by` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `expires_at` (timestamptz)
- `is_active` (boolean)

### Step 5: Test in Your App

1. **Refresh** your app
2. **Check** the browser console - the 500 error should be gone
3. **Announcements** should load (even if empty, no error)

---

## 📋 What This Table Does

The `announcements` table stores system-wide announcements that:
- Can be created by admins only
- Are visible to all authenticated users
- Can have priority levels (low/normal/high/urgent)
- Can have expiration dates
- Are displayed as banners in the app

---

## 🔍 Troubleshooting

### If you get "table already exists"
- The table is already there, you can skip this fix
- The error might be from a different issue (check API logs)

### If you get permission errors
- Make sure you're logged into Supabase as the project owner
- Check that you're in the correct project (nyyukbaodgzyvcccpojn)

### If the error persists after creating the table
1. **Wait 1-2 minutes** for Supabase to update its schema cache
2. **Refresh** your app
3. **Check** Vercel deployment logs for any API errors
4. **Verify** `SUPABASE_ANON_KEY` is set in Vercel (needed for token verification)

---

## ✅ After Fixing

Once the table is created:
- ✅ Announcements API will work
- ✅ Admins can create announcements
- ✅ Users can see announcements as banners
- ✅ No more 500 errors

