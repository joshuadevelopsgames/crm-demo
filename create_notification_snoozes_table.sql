-- Create notification_snoozes table for per-user snooze tracking
-- This allows users to snooze universal notifications individually
CREATE TABLE IF NOT EXISTS notification_snoozes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  notification_type text NOT NULL,
  related_account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  snoozed_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type, related_account_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_user_id ON notification_snoozes(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_type ON notification_snoozes(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_account_id ON notification_snoozes(related_account_id);
CREATE INDEX IF NOT EXISTS idx_notification_snoozes_snoozed_until ON notification_snoozes(snoozed_until);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_notification_snoozes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_snoozes_updated_at
  BEFORE UPDATE ON notification_snoozes 
  FOR EACH ROW EXECUTE FUNCTION set_notification_snoozes_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE notification_snoozes ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can manage their own snoozes
CREATE POLICY notification_snoozes_user_own ON notification_snoozes
  FOR ALL TO authenticated 
  USING (auth.uid()::text = user_id) 
  WITH CHECK (auth.uid()::text = user_id);

-- Add comment
COMMENT ON TABLE notification_snoozes IS 'Tracks per-user snoozes for universal notifications. Allows users to individually snooze notifications like renewal reminders.';

