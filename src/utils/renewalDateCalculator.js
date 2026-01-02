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
  if (!estimates || estimates.length === 0) {
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

  if (wonEstimatesWithEndDate.length === 0) {
    return null;
  }

  // Find the latest contract_end date
  const latestEndDate = wonEstimatesWithEndDate.reduce((latest, est) => {
    return est.contract_end_date > latest ? est.contract_end_date : latest;
  }, wonEstimatesWithEndDate[0].contract_end_date);

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

