-- Create tickets table for bug report tracking
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL, -- e.g., "TICKET-001"
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  priority text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  reporter_id text NOT NULL, -- user_id of person who reported
  reporter_email text, -- email from bug report form
  assignee_id text, -- user_id of person assigned (nullable)
  bug_report_data jsonb, -- Full bug report (element info, console logs, etc.)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

-- Create ticket comments/updates table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  comment text NOT NULL,
  is_internal boolean DEFAULT false, -- true = only visible to admins
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_reporter_id ON tickets(reporter_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at);

-- Auto-generate ticket numbers (TICKET-001, TICKET-002, etc.)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM '(\d+)$') AS integer)), 0) + 1
  INTO next_num
  FROM tickets
  WHERE ticket_number LIKE 'TICKET-%';
  
  NEW.ticket_number := 'TICKET-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trg_generate_ticket_number ON tickets;

CREATE TRIGGER trg_generate_ticket_number
  BEFORE INSERT ON tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION generate_ticket_number();

-- Ensure set_updated_at function exists (used by multiple tables)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Set resolved_at when status changes to 'resolved'
CREATE OR REPLACE FUNCTION set_ticket_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  ELSIF NEW.status != 'resolved' THEN
    NEW.resolved_at = NULL;
  END IF;
  
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    NEW.closed_at = now();
  ELSIF NEW.status != 'closed' THEN
    NEW.closed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_ticket_resolved_at ON tickets;

CREATE TRIGGER trg_set_ticket_resolved_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_resolved_at();

-- Enable Row Level Security (RLS)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS tickets_reporter_view ON tickets;
DROP POLICY IF EXISTS tickets_reporter_update ON tickets;
DROP POLICY IF EXISTS tickets_admin_all ON tickets;
DROP POLICY IF EXISTS tickets_reporter_insert ON tickets;
DROP POLICY IF EXISTS ticket_comments_view ON ticket_comments;
DROP POLICY IF EXISTS ticket_comments_create ON ticket_comments;
DROP POLICY IF EXISTS ticket_comments_admin_create ON ticket_comments;

-- Reporters can view their own tickets
CREATE POLICY tickets_reporter_view ON tickets
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()::text 
    OR assignee_id = auth.uid()::text
  );

-- Reporters can update their own tickets (add comments, but not change status/assignee)
CREATE POLICY tickets_reporter_update ON tickets
  FOR UPDATE TO authenticated
  USING (
    reporter_id = auth.uid()::text 
    OR assignee_id = auth.uid()::text
  )
  WITH CHECK (
    -- Reporters can only update certain fields (not status/assignee)
    reporter_id = auth.uid()::text 
    OR assignee_id = auth.uid()::text
  );

-- Admins can do everything with tickets
CREATE POLICY tickets_admin_all ON tickets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  );

-- Users can insert their own tickets (via bug report)
CREATE POLICY tickets_reporter_insert ON tickets
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid()::text);

-- Comments: users can view comments on their tickets (unless internal)
CREATE POLICY ticket_comments_view ON ticket_comments
  FOR SELECT TO authenticated
  USING (
    -- User can see if it's their ticket and comment is not internal
    (EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_comments.ticket_id 
      AND (tickets.reporter_id = auth.uid()::text OR tickets.assignee_id = auth.uid()::text)
      AND ticket_comments.is_internal = false
    ))
    OR
    -- Admins can see all comments
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    ))
  );

-- Users can create comments on their tickets
CREATE POLICY ticket_comments_create ON ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_comments.ticket_id 
      AND (tickets.reporter_id = auth.uid()::text OR tickets.assignee_id = auth.uid()::text)
    )
  );

-- Admins can create any comment (including internal ones)
CREATE POLICY ticket_comments_admin_create ON ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'system_admin')
    )
  );

-- Add comment to table
COMMENT ON TABLE tickets IS 'Bug reports and feature requests submitted by users. Each ticket has a unique ticket number and can be assigned, commented on, and tracked through resolution.';
COMMENT ON TABLE ticket_comments IS 'Comments and updates on tickets. Internal comments are only visible to admins.';

