-- Add archive support to tickets table
-- This migration adds an archived_at field to track when tickets are archived

-- Add archived_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN archived_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_tickets_archived_at ON tickets(archived_at);
    RAISE NOTICE 'Added archived_at column to tickets table';
  ELSE
    RAISE NOTICE 'archived_at column already exists';
  END IF;
END $$;

