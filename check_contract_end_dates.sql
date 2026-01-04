-- Check if contract_end dates are being saved
SELECT 
  COUNT(*) as total_won_estimates,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as won_without_contract_end,
  ROUND(100.0 * COUNT(*) FILTER (WHERE contract_end IS NOT NULL) / COUNT(*), 2) as percent_with_contract_end
FROM estimates
WHERE status = 'won';

-- Sample some won estimates with contract_end
SELECT 
  id,
  lmn_estimate_id,
  status,
  contract_end,
  account_id
FROM estimates
WHERE status = 'won' AND contract_end IS NOT NULL
LIMIT 10;
