-- Add missing columns to production database
-- Run this in production Supabase SQL Editor before re-running migration

-- Add icp_required and icp_status to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_required BOOLEAN DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icp_status TEXT DEFAULT 'required';

-- Add phone_number to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- Add blocked_by_task_id to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_by_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Create index for blocked_by_task_id
CREATE INDEX IF NOT EXISTS idx_tasks_blocked_by_task_id ON tasks(blocked_by_task_id);

-- Add recurring task columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern text,
ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[],
ADD COLUMN IF NOT EXISTS recurrence_day_of_month integer,
ADD COLUMN IF NOT EXISTS recurrence_end_date date,
ADD COLUMN IF NOT EXISTS recurrence_count integer,
ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS next_recurrence_date date;

-- Create indexes for recurring tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_next_recurrence_date ON tasks(next_recurrence_date);

-- Verify columns were added
SELECT 
  'accounts' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('icp_required', 'icp_status')
UNION ALL
SELECT 
  'profiles' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'phone_number'
UNION ALL
SELECT 
  'tasks' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name = 'blocked_by_task_id';

