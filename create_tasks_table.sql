-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to text,
  due_date date,
  due_time time,
  priority text DEFAULT 'normal',
  status text DEFAULT 'todo',
  category text DEFAULT 'other',
  related_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  related_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  estimated_time integer DEFAULT 30,
  labels text[] DEFAULT '{}',
  subtasks jsonb DEFAULT '[]',
  order integer DEFAULT 0,
  completed_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_related_account_id ON tasks(related_account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_contact_id ON tasks(related_contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Enable Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
-- For now, allowing all authenticated users to read/write
CREATE POLICY "Allow all operations for authenticated users" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);

