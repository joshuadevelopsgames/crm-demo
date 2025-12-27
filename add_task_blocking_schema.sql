-- Add task blocking/dependency fields to tasks table
-- This allows tasks to be blocked until previous tasks are completed

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS blocked_by_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sequence_enrollment_id text,
ADD COLUMN IF NOT EXISTS sequence_step_number integer;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_blocked_by_task_id ON tasks(blocked_by_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sequence_enrollment_id ON tasks(sequence_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sequence_step_number ON tasks(sequence_step_number);

-- Add comments
COMMENT ON COLUMN tasks.blocked_by_task_id IS 'Task ID that must be completed before this task can be started';
COMMENT ON COLUMN tasks.sequence_enrollment_id IS 'Sequence enrollment ID if this task was created from a sequence';
COMMENT ON COLUMN tasks.sequence_step_number IS 'Step number in the sequence if this task was created from a sequence';

