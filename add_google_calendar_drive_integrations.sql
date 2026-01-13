-- Add Google Calendar and Drive integration support
-- Following the same pattern as gmail_integrations

-- Calendar Integration Table
CREATE TABLE IF NOT EXISTS google_calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  calendar_id text DEFAULT 'primary', -- Which calendar to use
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_id ON google_calendar_integrations(user_id);

-- Calendar Events Table - Links Google Calendar events to CRM entities
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id text UNIQUE, -- Google Calendar event ID
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  attendees jsonb, -- Array of email addresses
  -- Link to CRM entities
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  estimate_id text REFERENCES estimates(id) ON DELETE SET NULL,
  -- Sync metadata
  synced_at timestamptz,
  sync_direction text DEFAULT 'bidirectional', -- 'crm_to_calendar', 'calendar_to_crm', 'bidirectional'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_account_id ON calendar_events(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact_id ON calendar_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_estimate_id ON calendar_events(estimate_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event_id ON calendar_events(google_event_id);

-- Drive Integration Table
CREATE TABLE IF NOT EXISTS google_drive_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_integrations_user_id ON google_drive_integrations(user_id);

-- Drive Files Table - Links Google Drive files to CRM entities
CREATE TABLE IF NOT EXISTS drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_file_id text NOT NULL, -- Google Drive file ID
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text, -- 'document', 'spreadsheet', 'presentation', 'pdf', 'folder', etc.
  mime_type text,
  file_size bigint,
  web_view_link text, -- URL to view file in Drive
  web_content_link text, -- URL to download file
  thumbnail_link text,
  -- Link to CRM entities
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  estimate_id text REFERENCES estimates(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  -- Metadata
  folder_id text, -- Google Drive folder ID if in folder
  shared boolean DEFAULT false,
  created_by_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_files_account_id ON drive_files(account_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_contact_id ON drive_files(contact_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_task_id ON drive_files(task_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_estimate_id ON drive_files(estimate_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_ticket_id ON drive_files(ticket_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_user_id ON drive_files(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_google_file_id ON drive_files(google_file_id);

-- Drive Folders Table - For organizing files by account
CREATE TABLE IF NOT EXISTS drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_folder_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_name text NOT NULL,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  parent_folder_id text, -- For nested folders
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_folders_account_id ON drive_folders(account_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_user_id ON drive_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_google_folder_id ON drive_folders(google_folder_id);

-- Add comments
COMMENT ON TABLE google_calendar_integrations IS 'Stores Google Calendar OAuth tokens for each user';
COMMENT ON TABLE calendar_events IS 'Links Google Calendar events to CRM entities (accounts, contacts, tasks, estimates)';
COMMENT ON TABLE google_drive_integrations IS 'Stores Google Drive OAuth tokens for each user';
COMMENT ON TABLE drive_files IS 'Links Google Drive files to CRM entities (accounts, contacts, tasks, estimates, tickets)';
COMMENT ON TABLE drive_folders IS 'Tracks Google Drive folders organized by account';
