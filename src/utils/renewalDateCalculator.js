/**
 * Calculate renewal date from estimates
 * 
 * Logic:
 * - Find all "won" estimates for an account
 * - Get the latest contract_end date from those estimates
 * - That becomes the renewal_date
 * - If no won estimates with contract_end, return null
 */

/**
 * Calculate renewal date for an account based on its won estimates
 * @param {Array} estimates - All estimates for the account
 * @returns {Date|null} - The latest contract_end date from won estimates, or null
 */
export function calculateRenewalDate(estimates = []) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'renewalDateCalculator.js:16',message:'calculateRenewalDate entry',data:{estimatesCount:estimates?.length||0,estimatesSample:estimates?.slice(0,2).map(e=>({id:e.id,status:e.status,contract_end:e.contract_end}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!estimates || estimates.length === 0) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'renewalDateCalculator.js:18',message:'No estimates provided',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return null;
  }

  // Filter to only won estimates with valid contract_end dates
  const wonEstimatesWithEndDate = estimates
    .filter(est => {
      // Must be won status (case-insensitive)
      if (!est.status || est.status.toLowerCase() !== 'won') return false;
      
      // Must have contract_end date
      if (!est.contract_end) return false;
      
      // Must be a valid date
      const endDate = new Date(est.contract_end);
      return !isNaN(endDate.getTime());
    })
    .map(est => ({
      ...est,
      contract_end_date: new Date(est.contract_end)
    }));
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'renewalDateCalculator.js:33',message:'Filtered won estimates',data:{wonWithEndCount:wonEstimatesWithEndDate.length,contractEndDates:wonEstimatesWithEndDate.map(e=>e.contract_end)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (wonEstimatesWithEndDate.length === 0) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'renewalDateCalculator.js:39',message:'No won estimates with contract_end',data:{totalEstimates:estimates.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return null;
  }

  // Find the latest contract_end date
  const latestEndDate = wonEstimatesWithEndDate.reduce((latest, est) => {
    return est.contract_end_date > latest ? est.contract_end_date : latest;
  }, wonEstimatesWithEndDate[0].contract_end_date);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'renewalDateCalculator.js:48',message:'Renewal date calculated',data:{renewalDate:latestEndDate.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  return latestEndDate;
}

/**
 * Calculate renewal date and return as ISO string
 * @param {Array} estimates - All estimates for the account
 * @returns {string|null} - ISO string of renewal date, or null
 */
export function calculateRenewalDateISO(estimates = []) {
  const renewalDate = calculateRenewalDate(estimates);
  return renewalDate ? renewalDate.toISOString() : null;
}

/**
 * Get days until renewal
 * @param {Date|string} renewalDate - Renewal date
 * @returns {number|null} - Days until renewal (positive = future, negative = past), or null if no date
 */
export function getDaysUntilRenewal(renewalDate) {
  if (!renewalDate) return null;
  
  const renewal = new Date(renewalDate);
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

