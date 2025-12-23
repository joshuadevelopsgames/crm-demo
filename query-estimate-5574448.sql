-- Query to find EST5574448 and its associated account
-- Run this in your Supabase SQL editor

SELECT 
  e.id,
  e.lmn_estimate_id,
  e.estimate_number,
  e.contact_name,
  e.account_id,
  a.name as account_name,
  a.lmn_crm_id,
  e.total_price,
  e.total_price_with_tax,
  e.estimate_date,
  e.contract_start,
  e.contract_end,
  e.status,
  e.source,
  e.created_at,
  e.updated_at
FROM estimates e
LEFT JOIN accounts a ON e.account_id = a.id
WHERE e.lmn_estimate_id = '5574448' 
   OR e.estimate_number = '5574448'
   OR e.estimate_number = 'EST5574448'
   OR e.lmn_estimate_id LIKE '%5574448%'
ORDER BY e.created_at DESC;

