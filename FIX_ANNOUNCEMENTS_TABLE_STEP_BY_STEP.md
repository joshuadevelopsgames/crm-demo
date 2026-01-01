# Fix Announcements Table - Step by Step

## 🐛 Error
```
ERROR: 42P01: relation "announcements" does not exist
```

This means the table creation failed or wasn't run. Let's create it step by step.

---

## ✅ Solution: Run SQL in Steps

### Step 1: Create the Table First

Run this **first** in Supabase SQL Editor:

```sql
-- Step 1: Create the announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true
);
```

**Expected result:** "Success. No rows returned"

### Step 2: Verify Table Exists

Run this to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'announcements';
```

**Expected result:** Should return one row with `announcements`

### Step 3: Create Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON public.announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);
```

### Step 4: Create Trigger Function

```sql
CREATE OR REPLACE FUNCTION set_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 5: Create Trigger

```sql
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements 
  FOR EACH ROW EXECUTE FUNCTION set_announcements_updated_at();
```

### Step 6: Enable RLS

```sql
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
```

### Step 7: Create RLS Policies

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS announcements_authenticated_read ON public.announcements;
DROP POLICY IF EXISTS announcements_admin_write ON public.announcements;

-- Policy for reading (all authenticated users)
CREATE POLICY announcements_authenticated_read ON public.announcements
  FOR SELECT TO authenticated 
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Policy for writing (only admins)
CREATE POLICY announcements_admin_write ON public.announcements
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
```

### Step 8: Add Comment

```sql
COMMENT ON TABLE public.announcements IS 'System-wide announcements that can be created by admins and viewed by all users';
```

---

## 🔄 Alternative: Run All at Once

If you prefer to run everything at once, use the complete script from `create_announcements_table.sql` but make sure to:

1. **Copy the ENTIRE script** (don't run parts separately)
2. **Paste it all at once** into SQL Editor
3. **Click Run** (or Cmd/Ctrl + Enter)

---

## 🔍 Troubleshooting

### If Step 1 fails with "relation already exists"
- The table already exists, skip to Step 2 to verify
- Then continue with remaining steps

### If you get permission errors
- Make sure you're logged in as project owner
- Check you're in the correct project (nyyukbaodgzyvcccpojn)

### If policies fail to create
- Make sure RLS is enabled (Step 6)
- Check that the `profiles` table exists and has the `role` column

---

## ✅ Verification

After running all steps, verify with:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'announcements';

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'announcements'
ORDER BY ordinal_position;

-- Check policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'announcements';
```

You should see:
- ✅ Table exists
- ✅ 9 columns (id, title, content, priority, created_by, created_at, updated_at, expires_at, is_active)
- ✅ 2 policies (announcements_authenticated_read, announcements_admin_write)

