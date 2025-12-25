-- Add recurring task fields to tasks table
-- This allows tasks to repeat on a schedule (daily, weekly, monthly, etc.)

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern text, -- 'daily', 'weekly', 'monthly', 'yearly', 'custom'
ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1, -- Every N days/weeks/months
ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[], -- For weekly: [1,3,5] = Mon, Wed, Fri (0=Sunday, 6=Saturday)
ADD COLUMN IF NOT EXISTS recurrence_day_of_month integer, -- For monthly: day of month (1-31)
ADD COLUMN IF NOT EXISTS recurrence_end_date date, -- When to stop recurring (null = never)
ADD COLUMN IF NOT EXISTS recurrence_count integer, -- Number of occurrences (null = unlimited)
ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE, -- Link to original recurring task
ADD COLUMN IF NOT EXISTS next_recurrence_date date; -- When next instance should be created

-- Create indexes for recurring task queries
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_next_recurrence_date ON tasks(next_recurrence_date);

-- Add comment to explain the fields
COMMENT ON COLUMN tasks.is_recurring IS 'Whether this task repeats on a schedule';
COMMENT ON COLUMN tasks.recurrence_pattern IS 'Pattern: daily, weekly, monthly, yearly, custom';
COMMENT ON COLUMN tasks.recurrence_interval IS 'Every N days/weeks/months (e.g., every 2 weeks = interval 2, pattern weekly)';
COMMENT ON COLUMN tasks.recurrence_days_of_week IS 'For weekly: array of day numbers (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN tasks.recurrence_day_of_month IS 'For monthly: day of month (1-31)';
COMMENT ON COLUMN tasks.recurrence_end_date IS 'When to stop recurring (null = never)';
COMMENT ON COLUMN tasks.recurrence_count IS 'Number of occurrences (null = unlimited)';
COMMENT ON COLUMN tasks.parent_task_id IS 'Link to original recurring task template';
COMMENT ON COLUMN tasks.next_recurrence_date IS 'When next instance should be created';

