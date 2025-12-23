-- SQL to find and fix incorrectly linked estimates
-- This will help identify estimates that might be orphaned or incorrectly linked

-- 1. Find EST5574448 and EST5333954 (the two estimates in UI but not in Excel)
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
  e.status,
  e.source,
  e.created_at
FROM estimates e
LEFT JOIN accounts a ON e.account_id = a.id
WHERE (e.lmn_estimate_id = '5574448' OR e.estimate_number = 'EST5574448')
   OR (e.lmn_estimate_id = '5333954' OR e.estimate_number = 'EST5333954')
ORDER BY e.created_at DESC;

-- 2. Find all estimates with "Keynote" in contact_name to see if there's a pattern
SELECT 
  e.id,
  e.lmn_estimate_id,
  e.estimate_number,
  e.contact_name,
  e.account_id,
  a.name as account_name,
  e.total_price,
  e.total_price_with_tax,
  e.estimate_date
FROM estimates e
LEFT JOIN accounts a ON e.account_id = a.id
WHERE e.contact_name ILIKE '%keynote%'
ORDER BY e.estimate_date DESC;

-- 3. Find estimates linked to Triovest that might be incorrectly linked
-- (Look for contact names that don't match "Triovest")
SELECT 
  e.id,
  e.lmn_estimate_id,
  e.estimate_number,
  e.contact_name,
  e.account_id,
  a.name as account_name,
  e.total_price,
  e.total_price_with_tax,
  e.estimate_date,
  e.status
FROM estimates e
JOIN accounts a ON e.account_id = a.id
WHERE a.name = 'Triovest Realty Advisors Ltd'
  AND e.contact_name IS NOT NULL
  AND e.contact_name NOT ILIKE '%triovest%'
ORDER BY e.estimate_date DESC;

-- 4. Find all estimates linked to Triovest that have contact names NOT matching "Triovest"
-- (These might be incorrectly linked)
SELECT 
  e.id,
  e.lmn_estimate_id,
  e.estimate_number,
  e.contact_name,
  e.account_id,
  a.name as account_name,
  e.total_price,
  e.total_price_with_tax,
  e.estimate_date,
  e.status,
  e.source
FROM estimates e
JOIN accounts a ON e.account_id = a.id
WHERE a.name = 'Triovest Realty Advisors Ltd'
  AND e.contact_name IS NOT NULL
  AND e.contact_name NOT ILIKE '%triovest%'
ORDER BY e.estimate_date DESC;

-- 5. To UNLINK EST5574448 and EST5333954 from Triovest (set account_id to NULL):
-- UPDATE estimates 
-- SET account_id = NULL, updated_at = NOW()
-- WHERE ((lmn_estimate_id = '5574448' OR estimate_number = 'EST5574448')
--     OR (lmn_estimate_id = '5333954' OR estimate_number = 'EST5333954'))
--   AND account_id = '7b18f1d5-336b-44b0-8a2b-112fa330f13b';

-- 6. To DELETE EST5574448 and EST5333954 entirely (if they're truly orphaned data):
-- DELETE FROM estimates 
-- WHERE (lmn_estimate_id = '5574448' OR estimate_number = 'EST5574448')
--    OR (lmn_estimate_id = '5333954' OR estimate_number = 'EST5333954');

