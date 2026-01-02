-- Verify that notification snoozes persist across account imports/updates
-- Run this before and after an import to verify snoozes are preserved

-- 1. Count active snoozes by account before import
SELECT 
  related_account_id,
  notification_type,
  COUNT(*) as snooze_count,
  MIN(snoozed_until) as earliest_snooze,
  MAX(snoozed_until) as latest_snooze
FROM notification_snoozes
WHERE related_account_id IS NOT NULL
  AND snoozed_until > NOW()
GROUP BY related_account_id, notification_type
ORDER BY related_account_id, notification_type;

-- 2. Show all active snoozes with account names
SELECT 
  ns.id as snooze_id,
  ns.notification_type,
  ns.related_account_id,
  a.name as account_name,
  ns.snoozed_until,
  ns.snoozed_by,
  ns.created_at
FROM notification_snoozes ns
LEFT JOIN accounts a ON a.id = ns.related_account_id
WHERE ns.related_account_id IS NOT NULL
  AND ns.snoozed_until > NOW()
ORDER BY ns.related_account_id, ns.notification_type;

-- 3. Check for orphaned snoozes (snoozes without valid accounts)
SELECT 
  ns.id as snooze_id,
  ns.notification_type,
  ns.related_account_id,
  ns.snoozed_until,
  CASE 
    WHEN a.id IS NULL THEN 'ORPHANED - Account does not exist'
    ELSE 'Valid'
  END as status
FROM notification_snoozes ns
LEFT JOIN accounts a ON a.id = ns.related_account_id
WHERE ns.related_account_id IS NOT NULL
  AND ns.snoozed_until > NOW()
ORDER BY status, ns.related_account_id;

-- 4. Verify foreign key constraint is set correctly
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'notification_snoozes'
  AND kcu.column_name = 'related_account_id';

-- Expected result: delete_rule should be 'CASCADE' or 'SET NULL'
-- This means snoozes are only deleted if the account is deleted, NOT when the account is updated

