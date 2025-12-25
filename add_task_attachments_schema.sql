-- Create task_attachments table
-- Allows users to attach files to tasks

CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_email text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer, -- Size in bytes
  file_type text, -- MIME type (e.g., 'image/png', 'application/pdf')
  storage_path text, -- Path in storage bucket
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_user_id ON task_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON task_attachments(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON task_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE task_attachments IS 'File attachments on tasks';
COMMENT ON COLUMN task_attachments.task_id IS 'The task this attachment belongs to';
COMMENT ON COLUMN task_attachments.user_id IS 'ID of the user who uploaded the attachment';
COMMENT ON COLUMN task_attachments.user_email IS 'Email of the user who uploaded (for display)';
COMMENT ON COLUMN task_attachments.file_name IS 'Original filename';
COMMENT ON COLUMN task_attachments.file_url IS 'URL to access the file (Supabase Storage or external)';
COMMENT ON COLUMN task_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN task_attachments.file_type IS 'MIME type of the file';
COMMENT ON COLUMN task_attachments.storage_path IS 'Path in storage bucket (for deletion)';

