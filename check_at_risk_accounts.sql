-- Check at-risk accounts and their renewal dates
-- This helps identify why the count changed after import

-- Get all accounts with at_risk status
SELECT 
  id,
  name,
  status,
  lmn_crm_id,
  archived,
  renewal_date,
  created_at,
  updated_at
FROM accounts
WHERE status = 'at_risk'
ORDER BY name;

-- Count at-risk accounts
SELECT 
  COUNT(*) as at_risk_count,
  COUNT(CASE WHEN archived = true THEN 1 END) as archived_at_risk,
  COUNT(CASE WHEN archived = false THEN 1 END) as active_at_risk
FROM accounts
WHERE status = 'at_risk';

-- Get accounts with at_risk status and their won estimates with contract_end dates
SELECT 
  a.id as account_id,
  a.name as account_name,
  a.status,
  a.archived,
  COUNT(e.id) as won_estimates_count,
  MAX(e.contract_end) as latest_contract_end,
  CASE 
    WHEN MAX(e.contract_end) IS NULL THEN 'No contract_end dates'
    WHEN MAX(e.contract_end) < CURRENT_DATE THEN 'Renewal passed'
    WHEN MAX(e.contract_end) > CURRENT_DATE + INTERVAL '180 days' THEN 'Renewal > 6 months away'
    WHEN MAX(e.contract_end) >= CURRENT_DATE AND MAX(e.contract_end) <= CURRENT_DATE + INTERVAL '180 days' THEN 'Renewal within 6 months'
    ELSE 'Unknown'
  END as renewal_status,
  EXTRACT(DAY FROM (MAX(e.contract_end) - CURRENT_DATE)) as days_until_renewal
FROM accounts a
LEFT JOIN estimates e ON e.account_id = a.id AND e.status = 'won' AND e.contract_end IS NOT NULL
WHERE a.status = 'at_risk'
GROUP BY a.id, a.name, a.status, a.archived
ORDER BY days_until_renewal NULLS LAST;

-- Find accounts that should NOT be at_risk (renewal > 6 months or passed)
SELECT 
  a.id,
  a.name,
  a.status,
  MAX(e.contract_end) as latest_contract_end,
  EXTRACT(DAY FROM (MAX(e.contract_end) - CURRENT_DATE)) as days_until_renewal,
  CASE 
    WHEN MAX(e.contract_end) IS NULL THEN 'No won estimates with contract_end'
    WHEN MAX(e.contract_end) < CURRENT_DATE THEN 'Renewal date has passed'
    WHEN MAX(e.contract_end) > CURRENT_DATE + INTERVAL '180 days' THEN 'Renewal more than 6 months away'
  END as reason_not_at_risk
FROM accounts a
LEFT JOIN estimates e ON e.account_id = a.id AND e.status = 'won' AND e.contract_end IS NOT NULL
WHERE a.status = 'at_risk'
GROUP BY a.id, a.name, a.status
HAVING 
  MAX(e.contract_end) IS NULL OR
  MAX(e.contract_end) < CURRENT_DATE OR
  MAX(e.contract_end) > CURRENT_DATE + INTERVAL '180 days'
ORDER BY a.name;

-- Find accounts that SHOULD be at_risk but aren't
SELECT 
  a.id,
  a.name,
  a.status,
  MAX(e.contract_end) as latest_contract_end,
  EXTRACT(DAY FROM (MAX(e.contract_end) - CURRENT_DATE)) as days_until_renewal
FROM accounts a
INNER JOIN estimates e ON e.account_id = a.id AND e.status = 'won' AND e.contract_end IS NOT NULL
WHERE a.status != 'at_risk' 
  AND a.archived = false
  AND a.status != 'churned'
GROUP BY a.id, a.name, a.status
HAVING 
  MAX(e.contract_end) >= CURRENT_DATE 
  AND MAX(e.contract_end) <= CURRENT_DATE + INTERVAL '180 days'
ORDER BY days_until_renewal;


