-- Add phone_number column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- Add comment to document the field
COMMENT ON COLUMN profiles.phone_number IS 'User phone number for contact information';

