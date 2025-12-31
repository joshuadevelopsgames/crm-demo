-- Get the raw, unformatted function source code
-- This will show us exactly what's in the function body

SELECT 
  prosrc as raw_function_source_code
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

-- Also check the exact byte-by-byte content
SELECT 
  length(prosrc) as source_length,
  position('snoozed_until' in prosrc) as snoozed_position,
  position('OLD.snoozed' in prosrc) as old_snoozed_position,
  position('NEW.snoozed' in prosrc) as new_snoozed_position,
  substring(prosrc from position('IF (' in prosrc) for 500) as if_statement_section
FROM pg_proc
WHERE proname = 'trigger_update_notifications_on_account_change';

