-- Fix RLS policy for user_notification_states to allow service role access
-- Service role key should bypass RLS, but let's make the policy more explicit

-- Drop existing policy
DROP POLICY IF EXISTS user_notification_states_authenticated_all ON user_notification_states;

-- Create policy that allows:
-- 1. Service role (bypasses RLS automatically, but this makes it explicit)
-- 2. Authenticated users to see their own data
CREATE POLICY user_notification_states_authenticated_all ON user_notification_states
  FOR ALL TO authenticated 
  USING (
    -- Allow if user_id matches authenticated user
    auth.uid()::text = user_id OR 
    user_id = auth.uid()::text OR
    -- Allow service role (this is redundant since service role bypasses RLS, but explicit is better)
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.uid()::text = user_id OR 
    user_id = auth.uid()::text OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Also create a policy specifically for service role (though it should bypass RLS)
-- This is just for clarity
COMMENT ON POLICY user_notification_states_authenticated_all ON user_notification_states IS 
  'Allows authenticated users to access their own notification state. Service role bypasses RLS automatically.';

