-- Add support for ticket notifications
-- This migration adds a related_ticket_id field to the notifications table

-- Add related_ticket_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'related_ticket_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_related_ticket_id ON notifications(related_ticket_id);
    RAISE NOTICE 'Added related_ticket_id column to notifications table';
  ELSE
    RAISE NOTICE 'related_ticket_id column already exists';
  END IF;
END $$;

