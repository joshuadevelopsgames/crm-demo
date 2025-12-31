-- Create user_notification_states table for bulk notifications (JSONB approach)
-- This stores neglected_account and renewal_reminder notifications as JSONB arrays
-- Individual task notifications (task_assigned, task_overdue, etc.) remain in notifications table

CREATE TABLE IF NOT EXISTS user_notification_states (
  user_id text PRIMARY KEY,
  notifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_notification_states_user_id 
  ON user_notification_states(user_id);

-- Create GIN index on JSONB for fast queries within the array
CREATE INDEX IF NOT EXISTS idx_user_notification_states_notifications_gin 
  ON user_notification_states USING GIN (notifications);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_user_notification_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_user_notification_states_updated_at
  BEFORE UPDATE ON user_notification_states 
  FOR EACH ROW EXECUTE FUNCTION set_user_notification_states_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE user_notification_states ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS user_notification_states_authenticated_all ON user_notification_states;

-- RLS policy: users can only see their own notification state
CREATE POLICY user_notification_states_authenticated_all ON user_notification_states
  FOR ALL TO authenticated 
  USING (auth.uid()::text = user_id OR user_id = auth.uid()::text) 
  WITH CHECK (auth.uid()::text = user_id OR user_id = auth.uid()::text);

-- Add comment
COMMENT ON TABLE user_notification_states IS 'Stores bulk notifications (neglected_account, renewal_reminder) as JSONB arrays per user. Task notifications remain in notifications table.';

