-- Fix RLS policy for user_notification_states
-- Note: Service role key bypasses RLS automatically, but this ensures authenticated users can access their data

-- Drop existing policy
DROP POLICY IF EXISTS user_notification_states_authenticated_all ON user_notification_states;

-- Create policy for authenticated users
-- Service role will bypass this automatically
CREATE POLICY user_notification_states_authenticated_all ON user_notification_states
  FOR ALL TO authenticated 
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Verify service role can bypass RLS (this is automatic, but we can test)
-- Service role queries will not be evaluated against RLS policies
COMMENT ON POLICY user_notification_states_authenticated_all ON user_notification_states IS 
  'Allows authenticated users to access their own notification state. Service role bypasses RLS automatically.';

