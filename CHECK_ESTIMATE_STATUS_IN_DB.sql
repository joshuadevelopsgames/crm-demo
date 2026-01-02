-- Check what status values exist in the database and how many are marked as 'won'

-- 1. Count estimates by status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as without_contract_end
FROM estimates
GROUP BY status
ORDER BY count DESC;

-- 2. Check if any estimates have status = 'won' (exact match)
SELECT 
  COUNT(*) FILTER (WHERE status = 'won') as exact_won_count,
  COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'won') as lowercase_won_count,
  COUNT(*) FILTER (WHERE status = 'won' AND contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'won' AND contract_end IS NOT NULL) as lowercase_won_with_contract_end
FROM estimates;

-- 3. Sample estimates that should be won but aren't
SELECT 
  id,
  lmn_estimate_id,
  status,
  LOWER(TRIM(status)) as normalized_status,
  contract_end,
  total_price_with_tax,
  account_id
FROM estimates
WHERE LOWER(TRIM(status)) IN (
  'email contract award',
  'verbal contract award',
  'work complete',
  'work in progress',
  'billing complete',
  'contract signed',
  'contract in progress'
)
AND status != 'won'
LIMIT 20;

-- 4. Check accounts with estimates but no revenue
SELECT 
  a.id,
  a.name,
  a.revenue_segment,
  COUNT(e.id) as estimate_count,
  COUNT(e.id) FILTER (WHERE LOWER(TRIM(e.status)) = 'won') as won_count,
  COUNT(e.id) FILTER (WHERE LOWER(TRIM(e.status)) = 'won' AND e.contract_end IS NOT NULL) as won_with_contract_end_count
FROM accounts a
LEFT JOIN estimates e ON e.account_id = a.id
WHERE a.archived = false
GROUP BY a.id, a.name, a.revenue_segment
HAVING COUNT(e.id) FILTER (WHERE LOWER(TRIM(e.status)) = 'won') > 0
ORDER BY won_count DESC
LIMIT 20;

-- 5. Check for accounts that should be at-risk
SELECT 
  a.id,
  a.name,
  a.status,
  COUNT(e.id) FILTER (WHERE LOWER(TRIM(e.status)) = 'won' AND e.contract_end IS NOT NULL) as won_estimates_with_end_date,
  MAX(e.contract_end) FILTER (WHERE LOWER(TRIM(e.status)) = 'won') as latest_contract_end
FROM accounts a
LEFT JOIN estimates e ON e.account_id = a.id
WHERE a.archived = false
GROUP BY a.id, a.name, a.status
HAVING MAX(e.contract_end) FILTER (WHERE LOWER(TRIM(e.status)) = 'won') IS NOT NULL
  AND MAX(e.contract_end) FILTER (WHERE LOWER(TRIM(e.status)) = 'won') <= (CURRENT_DATE + INTERVAL '180 days')
ORDER BY latest_contract_end ASC
LIMIT 20;

