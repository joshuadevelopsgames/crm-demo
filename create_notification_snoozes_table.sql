-- Create notification_snoozes table for universal snooze tracking
-- When any user snoozes a notification, it disappears for ALL users
CREATE TABLE IF NOT EXISTS notification_snoozes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  related_account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  snoozed_until timestamptz NOT NULL,
  snoozed_by text, -- Track who snoozed it (optional, for audit)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(notification_type, related_account_id)
);

-- Create indexes for faster lookups
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

-- RLS policy: all authenticated users can manage snoozes (universal)
CREATE POLICY notification_snoozes_authenticated_all ON notification_snoozes
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE notification_snoozes IS 'Tracks universal snoozes for notifications. When any user snoozes a notification, it disappears for ALL users until the snooze period ends. Snoozes persist across account imports/updates because account IDs are preserved during updates.';

-- Add comment to foreign key constraint
COMMENT ON CONSTRAINT notification_snoozes_related_account_id_fkey ON notification_snoozes IS 
'Snoozes are linked to accounts by ID. ON DELETE CASCADE means snoozes are only deleted if the account is deleted, NOT when the account is updated. Account IDs are preserved during imports, so snoozes persist across imports.';

