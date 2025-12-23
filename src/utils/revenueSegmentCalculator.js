/**
 * Calculate revenue segment based on rolling 12-month average revenue percentage
 * 
 * Segment A: >= 15% of total revenue (last 12 months)
 * Segment B: 5-15% of total revenue (last 12 months)
 * Segment C: 0-5% of total revenue (last 12 months)
 * Segment D: Project only (has "Standard" type estimates but no "Service" type estimates)
 *   - "Standard" = project (one-time)
 *   - "Service" = ongoing/recurring
 *   - If account has BOTH Standard and Service, it gets A/B/C based on revenue (not D)
 * 
 * Revenue is calculated from won estimates within the last 12 months (rolling average)
 */

/**
 * Check if a date is within the last 12 months
 * @param {string|Date} date - Date to check
 * @returns {boolean} - True if date is within last 12 months
 */
function isWithinLast12Months(date) {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return false;
  
  const now = new Date();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  return dateObj >= twelveMonthsAgo && dateObj <= now;
}

/**
 * Get the relevant date for an estimate (won_date if available, otherwise estimate_date)
 * @param {Object} estimate - Estimate object
 * @returns {Date|null} - Relevant date or null
 */
function getEstimateRelevantDate(estimate) {
  // For won estimates, prefer won_date, then estimate_close_date, then estimate_date
  if (estimate.won_date) {
    return new Date(estimate.won_date);
  }
  if (estimate.estimate_close_date) {
    return new Date(estimate.estimate_close_date);
  }
  if (estimate.estimate_date) {
    return new Date(estimate.estimate_date);
  }
  return null;
}

/**
 * Calculate actual revenue from won estimates within the last 12 months
 * @param {Array} estimates - Array of estimate objects
 * @returns {number} - Total revenue from won estimates in last 12 months
 */
export function calculateRevenueFromEstimates(estimates = []) {
  const now = new Date();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  return estimates
    .filter(est => {
      // Only include won estimates
      if (est.status !== 'won') {
        return false;
      }
      
      // Check if estimate is within last 12 months
      const relevantDate = getEstimateRelevantDate(est);
      if (!relevantDate || isNaN(relevantDate.getTime())) {
        return false;
      }
      
      return relevantDate >= twelveMonthsAgo && relevantDate <= now;
    })
    .reduce((sum, est) => {
      const revenue = parseFloat(est.total_price_with_tax || est.total_price || 0);
      return sum + (isNaN(revenue) ? 0 : revenue);
    }, 0);
}

/**
 * Get account revenue - total revenue from last 12 months (rolling window)
 * @param {Object} account - Account object
 * @param {Array} estimates - Array of estimate objects for this account (optional)
 * @returns {number} - Account total revenue from last 12 months
 */
export function getAccountRevenue(account, estimates = []) {
  // If estimates are provided, always use the calculated revenue (even if 0)
  // This ensures we use actual 12-month rolling totals, not outdated annual_revenue
  if (estimates && estimates.length > 0) {
    return calculateRevenueFromEstimates(estimates);
  }
  
  // Only fall back to annual_revenue if we have no estimates at all
  const annualRevenue = account?.annual_revenue || 0;
  return typeof annualRevenue === 'number' ? annualRevenue : parseFloat(annualRevenue) || 0;
}

/**
 * Calculate revenue segment for a single account
 * @param {Object} account - The account object
 * @param {number} totalRevenue - Total revenue across all accounts
 * @param {Array} estimates - Array of estimate objects for this account (optional)
 * @returns {string} - Revenue segment: 'A', 'B', 'C', or 'D'
 */
export function calculateRevenueSegment(account, totalRevenue, estimates = []) {
  // Check if account is project only (has "Standard" type estimates but no "Service" type estimates)
  // If account has BOTH Standard and Service, it gets A/B/C based on revenue (not D)
  if (estimates && estimates.length > 0) {
    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    // Only consider won estimates from last 12 months for type checking
    const wonEstimates = estimates.filter(est => {
      // Must be won
      if (est.status !== 'won') {
        return false;
      }
      
      // Only consider estimates from last 12 months
      const relevantDate = getEstimateRelevantDate(est);
      if (!relevantDate || isNaN(relevantDate.getTime())) return false;
      
      return relevantDate >= twelveMonthsAgo && relevantDate <= now;
    });
    
    const hasStandardEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'standard'
    );
    const hasServiceEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'service'
    );
    
    // Segment D: Project only - has "Standard" (project) estimates but NO "Service" (ongoing) estimates
    // If it has BOTH Standard and Service, it will be A/B/C based on revenue percentage
    if (hasStandardEstimates && !hasServiceEstimates) {
      return 'D';
    }
  }
  
  const accountRevenue = getAccountRevenue(account, estimates);
  
  if (accountRevenue <= 0 || !totalRevenue || totalRevenue <= 0) {
    return 'C'; // Default to C if no revenue data
  }

  const revenuePercentage = (accountRevenue / totalRevenue) * 100;

  // Segment A: >= 15% of total revenue
  if (revenuePercentage >= 15) {
    return 'A';
  }
  
  // Segment B: 5-15% of total revenue
  if (revenuePercentage >= 5 && revenuePercentage < 15) {
    return 'B';
  }
  
  // Segment C: 0-5% of total revenue
  return 'C';
}

/**
 * Calculate total revenue across all accounts (rolling 12-month total)
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional)
 * @returns {number} - Total revenue from last 12 months (sum of all accounts)
 */
export function calculateTotalRevenue(accounts, estimatesByAccountId = {}) {
  return accounts.reduce((total, account) => {
    const estimates = estimatesByAccountId[account.id] || [];
    const revenue = getAccountRevenue(account, estimates);
    return total + revenue;
  }, 0);
}

/**
 * Auto-assign revenue segments for all accounts based on rolling 12-month revenue percentages
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional)
 * @returns {Array} - Array of accounts with updated revenue_segment
 */
export function autoAssignRevenueSegments(accounts, estimatesByAccountId = {}) {
  // Calculate total revenue from last 12 months across all accounts
  const totalRevenue = calculateTotalRevenue(accounts, estimatesByAccountId);
  
  if (totalRevenue <= 0) {
    // If no revenue data, return accounts unchanged
    return accounts.map(account => ({
      ...account,
      revenue_segment: account.revenue_segment || 'C'
    }));
  }

  return accounts.map(account => {
    const estimates = estimatesByAccountId[account.id] || [];
    const segment = calculateRevenueSegment(account, totalRevenue, estimates);
    
    return {
      ...account,
      revenue_segment: segment
    };
  });
}
