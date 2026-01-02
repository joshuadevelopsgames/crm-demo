-- Quick check to see what estimate statuses exist and how many should be 'won'
-- Run this in Supabase SQL Editor

-- 1. See all unique status values and their counts
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as without_contract_end
FROM estimates
GROUP BY status
ORDER BY count DESC;

-- 2. Check how many estimates should be 'won' based on parser logic
SELECT 
  'Should Be Won' as category,
  COUNT(*) as count
FROM estimates
WHERE status != 'won'
  AND (
    LOWER(TRIM(status)) = 'contract signed' OR
    LOWER(TRIM(status)) = 'work complete' OR
    LOWER(TRIM(status)) = 'billing complete' OR
    LOWER(TRIM(status)) = 'email contract award' OR
    LOWER(TRIM(status)) = 'work in progress' OR
    LOWER(TRIM(status)) = 'contract in progress' OR
    LOWER(TRIM(status)) = 'verbal contract award' OR
    LOWER(TRIM(status)) = 'contract + billing complete' OR
    LOWER(TRIM(status)) LIKE '%contract signed%' OR
    LOWER(TRIM(status)) LIKE '%work complete%' OR
    LOWER(TRIM(status)) LIKE '%billing complete%' OR
    LOWER(TRIM(status)) LIKE '%email contract award%' OR
    LOWER(TRIM(status)) LIKE '%work in progress%' OR
    LOWER(TRIM(status)) LIKE '%contract in progress%' OR
    LOWER(TRIM(status)) LIKE '%verbal contract award%' OR
    LOWER(TRIM(status)) LIKE '%contract + billing complete%'
  );

-- 3. Check how many are currently marked as 'won'
SELECT 
  'Currently Won' as category,
  COUNT(*) as total_won,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as won_without_contract_end
FROM estimates
WHERE status = 'won';

-- 4. Sample of estimates that should be won but aren't
SELECT 
  id,
  lmn_estimate_id,
  status,
  account_id,
  contract_end,
  total_price,
  total_price_with_tax
FROM estimates
WHERE status != 'won'
  AND (
    LOWER(TRIM(status)) = 'contract signed' OR
    LOWER(TRIM(status)) = 'work complete' OR
    LOWER(TRIM(status)) = 'billing complete' OR
    LOWER(TRIM(status)) = 'email contract award' OR
    LOWER(TRIM(status)) = 'work in progress' OR
    LOWER(TRIM(status)) = 'contract in progress' OR
    LOWER(TRIM(status)) = 'verbal contract award' OR
    LOWER(TRIM(status)) = 'contract + billing complete' OR
    LOWER(TRIM(status)) LIKE '%contract signed%' OR
    LOWER(TRIM(status)) LIKE '%work complete%' OR
    LOWER(TRIM(status)) LIKE '%billing complete%' OR
    LOWER(TRIM(status)) LIKE '%email contract award%' OR
    LOWER(TRIM(status)) LIKE '%work in progress%' OR
    LOWER(TRIM(status)) LIKE '%contract in progress%' OR
    LOWER(TRIM(status)) LIKE '%verbal contract award%' OR
    LOWER(TRIM(status)) LIKE '%contract + billing complete%'
  )
LIMIT 10;

