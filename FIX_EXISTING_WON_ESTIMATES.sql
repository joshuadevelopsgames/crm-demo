-- Fix existing estimates that should be marked as "won" but aren't
-- This updates estimates that were imported before the parser was fixed
-- Run this in Supabase SQL Editor

-- First, check what status values exist
SELECT status, COUNT(*) as count
FROM estimates
GROUP BY status
ORDER BY count DESC;

-- Update estimates based on their current status values
-- These match the status values from your Estimates List.xlsx file

UPDATE estimates
SET status = 'won'
WHERE status != 'won' 
  AND (
    -- Exact matches
    LOWER(TRIM(status)) = 'contract signed' OR
    LOWER(TRIM(status)) = 'work complete' OR
    LOWER(TRIM(status)) = 'billing complete' OR
    LOWER(TRIM(status)) = 'email contract award' OR
    LOWER(TRIM(status)) = 'work in progress' OR
    LOWER(TRIM(status)) = 'contract in progress' OR
    LOWER(TRIM(status)) = 'verbal contract award' OR
    LOWER(TRIM(status)) = 'contract + billing complete' OR
    -- Partial matches
    LOWER(TRIM(status)) LIKE '%contract signed%' OR
    LOWER(TRIM(status)) LIKE '%work complete%' OR
    LOWER(TRIM(status)) LIKE '%billing complete%' OR
    LOWER(TRIM(status)) LIKE '%email contract award%' OR
    LOWER(TRIM(status)) LIKE '%work in progress%' OR
    LOWER(TRIM(status)) LIKE '%contract in progress%' OR
    LOWER(TRIM(status)) LIKE '%verbal contract award%' OR
    LOWER(TRIM(status)) LIKE '%contract + billing complete%'
  );

-- Verify the update
SELECT 
  'Before update' as check_type,
  COUNT(*) FILTER (WHERE status = 'won') as won_count,
  COUNT(*) FILTER (WHERE status != 'won') as not_won_count
FROM estimates;

-- Show sample of updated estimates
SELECT 
  id,
  lmn_estimate_id,
  status,
  account_id,
  contract_end,
  total_price,
  total_price_with_tax
FROM estimates
WHERE status = 'won'
LIMIT 10;

-- Check how many won estimates have contract_end dates (needed for at-risk accounts)
SELECT 
  COUNT(*) as total_won,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as won_without_contract_end
FROM estimates
WHERE status = 'won';

