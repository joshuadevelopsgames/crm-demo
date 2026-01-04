-- Add selected_year column to profiles table for year selector feature
-- This replaces test_mode_enabled and allows users to select any year for site-wide data viewing

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS selected_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

COMMENT ON COLUMN profiles.selected_year IS 'User-selected year for site-wide data viewing. Revenue calculations, segments, and reports use this year. Persists across sessions.';

-- Set default for existing users to current year
UPDATE profiles
SET selected_year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE selected_year IS NULL;

