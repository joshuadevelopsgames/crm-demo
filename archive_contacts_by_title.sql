-- Archive contacts that have title='archive' or title contains 'no longer' (case-insensitive)
-- This script finds all contacts with title matching 'archive' or containing 'no longer' and sets archived=true

-- First, show what will be archived
SELECT 
  id,
  first_name,
  last_name,
  email,
  title,
  archived as current_archived_status,
  CASE 
    WHEN LOWER(TRIM(title)) = 'archive' THEN 'Title is "archive"'
    WHEN LOWER(title) LIKE '%no longer%' THEN 'Title contains "no longer"'
    ELSE 'Other'
  END as reason,
  'Will be archived' as action
FROM contacts
WHERE (LOWER(TRIM(title)) = 'archive' OR LOWER(title) LIKE '%no longer%')
  AND archived = false
ORDER BY first_name, last_name;

-- Update contacts to set archived=true where title='archive' or contains 'no longer' (case-insensitive)
UPDATE contacts
SET 
  archived = true,
  updated_at = now()
WHERE (LOWER(TRIM(title)) = 'archive' OR LOWER(title) LIKE '%no longer%')
  AND archived = false;

-- Show results
SELECT 
  COUNT(*) FILTER (WHERE LOWER(TRIM(title)) = 'archive') as archived_with_title_archive,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%no longer%') as archived_with_no_longer,
  COUNT(*) as total_archived,
  'Contacts archived by title' as summary
FROM contacts
WHERE (LOWER(TRIM(title)) = 'archive' OR LOWER(title) LIKE '%no longer%')
  AND archived = true;

