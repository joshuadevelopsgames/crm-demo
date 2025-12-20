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
