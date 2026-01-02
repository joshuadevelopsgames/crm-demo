-- Diagnostic script to check why notifications, revenue, and at-risk accounts aren't showing
-- Run this in Supabase SQL Editor to diagnose the issues

-- 1. Check estimate statuses (this is the root cause)
SELECT 
  'Estimate Statuses' as check_type,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE contract_end IS NOT NULL) as with_contract_end,
  COUNT(*) FILTER (WHERE contract_end IS NULL) as without_contract_end
FROM estimates
GROUP BY status
ORDER BY count DESC;

-- 2. Check how many estimates are marked as 'won'
SELECT 
  'Won Estimates Check' as check_type,
  COUNT(*) FILTER (WHERE status = 'won') as won_count,
  COUNT(*) FILTER (WHERE status = 'won' AND contract_end IS NOT NULL) as won_with_contract_end,
  COUNT(*) FILTER (WHERE status != 'won') as not_won_count,
  COUNT(*) as total_estimates
FROM estimates;

-- 3. Check which status values should be 'won' (based on parser logic)
SELECT 
  'Statuses That Should Be Won' as check_type,
  status,
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
  )
GROUP BY status
ORDER BY count DESC;

-- 4. Check accounts with renewal dates (needed for at-risk accounts)
SELECT 
  'Accounts With Renewal Dates' as check_type,
  COUNT(DISTINCT a.id) as accounts_with_renewal_dates,
  COUNT(DISTINCT a.id) FILTER (WHERE a.calculated_renewal_date IS NOT NULL) as accounts_with_calculated_renewal,
  COUNT(DISTINCT a.id) as total_accounts
FROM accounts a
LEFT JOIN estimates e ON e.account_id = a.id
WHERE e.status = 'won' AND e.contract_end IS NOT NULL;

-- 5. Check at-risk accounts (renewal within 180 days or past due)
SELECT 
  'At-Risk Accounts Check' as check_type,
  COUNT(*) FILTER (WHERE 
    calculated_renewal_date IS NOT NULL 
    AND calculated_renewal_date <= CURRENT_DATE + INTERVAL '180 days'
    AND archived = false
  ) as at_risk_count,
  COUNT(*) FILTER (WHERE archived = false) as active_accounts
FROM accounts;

-- 6. Check revenue segments (needed for revenue display)
SELECT 
  'Revenue Segments' as check_type,
  revenue_segment,
  COUNT(*) as count
FROM accounts
WHERE archived = false
GROUP BY revenue_segment
ORDER BY count DESC;

-- 7. Check notifications in the database
SELECT 
  'Notifications Check' as check_type,
  type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count
FROM notifications
GROUP BY type
ORDER BY count DESC;

-- 8. Check bulk notifications (user_notification_states)
SELECT 
  'Bulk Notifications Check' as check_type,
  COUNT(*) as users_with_notifications,
  SUM((notification_states->>'neglected')::int) as total_neglected,
  SUM((notification_states->>'renewal')::int) as total_renewal
FROM user_notification_states;

-- 9. Sample of accounts that should be at-risk but aren't
SELECT 
  'Sample At-Risk Accounts' as check_type,
  a.id,
  a.name,
  a.calculated_renewal_date,
  a.status,
  a.revenue_segment,
  COUNT(e.id) FILTER (WHERE e.status = 'won') as won_estimates_count,
  MAX(e.contract_end) FILTER (WHERE e.status = 'won') as latest_contract_end
FROM accounts a
LEFT JOIN estimates e ON e.account_id = a.id
WHERE a.archived = false
  AND EXISTS (
    SELECT 1 FROM estimates e2 
    WHERE e2.account_id = a.id 
    AND e2.status = 'won' 
    AND e2.contract_end IS NOT NULL
  )
GROUP BY a.id, a.name, a.calculated_renewal_date, a.status, a.revenue_segment
HAVING MAX(e.contract_end) FILTER (WHERE e.status = 'won') <= CURRENT_DATE + INTERVAL '180 days'
LIMIT 10;

