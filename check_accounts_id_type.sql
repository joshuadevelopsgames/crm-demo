-- Check the actual data type of accounts.id column
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name = 'id';

-- Expected result if correct:
-- column_name: id
-- data_type: text (or character varying)
-- column_default: NULL (not gen_random_uuid())
-- is_nullable: NO

-- If data_type shows 'uuid', you need to run the migration!

