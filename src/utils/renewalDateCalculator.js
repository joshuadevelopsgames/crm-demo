/**
 * Calculate renewal date from estimates
 * 
 * Logic:
 * - Find all "won" estimates for an account
 * - Get the latest contract_end date from those estimates
 * - That becomes the renewal_date
 * - If no won estimates with contract_end, return null
 */

import { isWonStatus } from './reportCalculations.js';

/**
 * Calculate renewal date for an account based on its won estimates
 * @param {Array} estimates - All estimates for the account
 * @returns {string|null} - The latest contract_end date as date-only string (YYYY-MM-DD), or null
 */
export function calculateRenewalDate(estimates = []) {
  if (!estimates || estimates.length === 0) {
    return null;
  }

  // Filter to only won estimates with valid contract_end dates
  // Use isWonStatus to match all won statuses (Contract Signed, Work Complete, etc.)
  
  const wonEstimatesWithEndDate = estimates
    .filter(est => {
      // Use isWonStatus to match all won statuses
      if (!isWonStatus(est.status)) return false;
      
      // Must have contract_end date (as string YYYY-MM-DD or Date object)
      if (!est.contract_end) return false;
      
      return true;
    })
    .map(est => {
      // Extract date string from contract_end (could be string or Date object)
      let dateStr = est.contract_end;
      if (dateStr instanceof Date) {
        // If it's a Date object, extract date components directly
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string') {
        // If it's already a string, extract YYYY-MM-DD part
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          dateStr = match[0];
        }
      }
      return {
        ...est,
        contract_end_date_str: dateStr
      };
    });

  if (wonEstimatesWithEndDate.length === 0) {
    return null;
  }

  // Find the latest contract_end date (compare as strings YYYY-MM-DD)
  const latestEndDateStr = wonEstimatesWithEndDate.reduce((latest, est) => {
    return est.contract_end_date_str > latest ? est.contract_end_date_str : latest;
  }, wonEstimatesWithEndDate[0].contract_end_date_str);
  
  // #region agent log
  // Only log when we actually find a renewal date (successful case)
  fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'renewalDateCalculator.js:48',message:'Renewal date calculated successfully',data:{renewalDate:latestEndDateStr,estimatesCount:estimates.length,wonWithEndCount:wonEstimatesWithEndDate.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  return latestEndDateStr; // Return date-only string (YYYY-MM-DD)
}

/**
 * Calculate renewal date and return as ISO string
 * @param {Array} estimates - All estimates for the account
 * @returns {string|null} - Date-only string (YYYY-MM-DD) of renewal date, or null
 */
export function calculateRenewalDateISO(estimates = []) {
  // calculateRenewalDate now returns date-only strings, so just return it
  return calculateRenewalDate(estimates);
}

/**
 * Get days until renewal
 * @param {string} renewalDate - Renewal date as date-only string (YYYY-MM-DD)
 * @returns {number|null} - Days until renewal (positive = future, negative = past), or null if no date
 */
export function getDaysUntilRenewal(renewalDate) {
  if (!renewalDate) return null;
  
  // Parse date string (YYYY-MM-DD) directly without timezone conversion
  const dateMatch = renewalDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;
  
  const [, year, month, day] = dateMatch;
  const renewal = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  if (isNaN(renewal.getTime())) return null;
  
  // Always use actual current date for renewal calculations (not test mode)
  // Renewal dates are about real business operations, not test data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  renewal.setHours(0, 0, 0, 0);
  
  const diffTime = renewal - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if renewal is within a certain number of days
 * @param {Date|string} renewalDate - Renewal date
 * @param {number} days - Number of days threshold (default: 180 for 6 months)
 * @returns {boolean} - True if renewal is within the threshold
 */
export function isRenewalWithinDays(renewalDate, days = 180) {
  const daysUntil = getDaysUntilRenewal(renewalDate);
  if (daysUntil === null) return false;
  
  // Within threshold and in the future (or today)
  return daysUntil >= 0 && daysUntil <= days;
}

