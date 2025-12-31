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

