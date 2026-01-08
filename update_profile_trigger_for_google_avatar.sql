-- Update profile trigger to handle Google OAuth avatar (picture field)
-- Run this in Supabase SQL Editor

-- Update the trigger function to handle Google OAuth picture field
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    -- Google OAuth provides 'avatar_url' or 'picture' in user_metadata
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    ),
    -- Set admin role for system admin email, otherwise default to 'user'
    CASE 
      WHEN NEW.email = 'jrsschroeder@gmail.com' THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    avatar_url = COALESCE(
      profiles.avatar_url,  -- Keep existing if present
      EXCLUDED.avatar_url,  -- Use new value if profile doesn't have one
      NULL
    ),
    role = CASE 
      WHEN EXCLUDED.email = 'jrsschroeder@gmail.com' THEN 'admin'
      ELSE COALESCE(profiles.role, 'user')
    END;
    -- NOTE: full_name and phone_number are NOT updated here to preserve user's manual edits
    -- The trigger only runs on NEW user creation (AFTER INSERT), not on subsequent logins
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing profiles with Google avatars if they have user_metadata with picture/avatar_url
UPDATE profiles p
SET avatar_url = COALESCE(
  p.avatar_url,  -- Keep existing if present
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture',
  NULL
)
FROM auth.users u
WHERE p.id = u.id
  AND (u.raw_user_meta_data->>'avatar_url' IS NOT NULL OR u.raw_user_meta_data->>'picture' IS NOT NULL)
  AND p.avatar_url IS NULL;

