-- Add created_by_email field to tasks table
-- This tracks who created each task, so unassigned tasks are only visible to their creator

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS created_by_email text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_email ON tasks(created_by_email);

-- Add comment
COMMENT ON COLUMN tasks.created_by_email IS 'Email of the user who created this task. Unassigned tasks are only visible to their creator.';
