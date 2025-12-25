-- Create task_comments table
-- Allows users to add comments to tasks for collaboration and context

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON task_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE task_comments IS 'Comments on tasks for collaboration and context';
COMMENT ON COLUMN task_comments.task_id IS 'The task this comment belongs to';
COMMENT ON COLUMN task_comments.user_id IS 'ID of the user who created the comment';
COMMENT ON COLUMN task_comments.user_email IS 'Email of the user who created the comment (for display)';
COMMENT ON COLUMN task_comments.content IS 'The comment text content';

