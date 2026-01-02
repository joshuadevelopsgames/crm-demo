-- Add user preferences columns to profiles table
-- These will store dark mode and test mode preferences on the server

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS test_mode_enabled boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.dark_mode IS 'User preference for dark mode. NULL means use system preference.';
COMMENT ON COLUMN profiles.test_mode_enabled IS 'User preference for test mode (2025 simulation). Only applies to eligible users.';

