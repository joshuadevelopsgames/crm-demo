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

