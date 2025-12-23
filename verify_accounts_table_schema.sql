-- Verify that accounts table has text id column
-- Run this to check if the accounts table is correctly configured

-- Check accounts table schema
SELECT 
  table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name = 'id';

-- Expected result:
-- table_name: accounts
-- column_name: id
-- data_type: text (NOT uuid)
-- column_default: NULL (NOT gen_random_uuid())
-- is_nullable: NO

-- Also check if there are any constraints that might be causing issues
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'accounts'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check sample account data to see what format IDs are in
SELECT 
  id,
  lmn_crm_id,
  name,
  created_at
FROM accounts
LIMIT 5;

