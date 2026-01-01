-- Create announcements table
-- Only admins can create announcements, all users can view them
-- Run this entire script in one go

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS announcements (
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

-- Step 2: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);

-- Step 3: Create update trigger function
CREATE OR REPLACE FUNCTION set_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements 
  FOR EACH ROW EXECUTE FUNCTION set_announcements_updated_at();

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS announcements_authenticated_read ON announcements;
DROP POLICY IF EXISTS announcements_admin_write ON announcements;

-- Step 7: Create RLS policy for reading (all authenticated users can read active announcements)
CREATE POLICY announcements_authenticated_read ON announcements
  FOR SELECT TO authenticated 
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Step 8: Create RLS policy for writing (only admins can create/update/delete)
-- Note: profiles.id is uuid, auth.uid() is uuid, so no cast needed
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

-- Step 9: Add comment
COMMENT ON TABLE announcements IS 'System-wide announcements that can be created by admins and viewed by all users';

-- Step 10: Verify the table was created
SELECT 
  'announcements table created successfully' as status,
  COUNT(*) as row_count
FROM announcements;

