-- Test script to check if accounts can be inserted manually
-- This will help identify if the issue is with the data or the table schema

-- First, check the accounts table schema
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
ORDER BY ordinal_position;

-- Try inserting a test account with the format we expect from imports
INSERT INTO accounts (
  id,
  lmn_crm_id,
  name,
  account_type,
  status,
  created_at,
  updated_at
) VALUES (
  'lmn-account-TEST123',
  'TEST123',
  'Test Account',
  'Commercial',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Check if it was inserted
SELECT * FROM accounts WHERE id = 'lmn-account-TEST123';

-- If successful, delete the test account
DELETE FROM accounts WHERE id = 'lmn-account-TEST123';

-- Check for any constraints that might be causing issues
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  tc.table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'accounts'
ORDER BY tc.constraint_type, tc.constraint_name;

