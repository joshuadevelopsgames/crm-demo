/**
 * Calculate revenue segment based on annual revenue percentage
 * 
 * Segment A: >= 15% of total revenue
 * Segment B: 5-15% of total revenue
 * Segment C: 0-5% of total revenue
 * Segment D: Project only (has "Standard" type estimates but no "Service" type estimates)
 *   - "Standard" = project (one-time)
 *   - "Service" = ongoing/recurring
 */

/**
 * Calculate actual revenue from won estimates
 * @param {Array} estimates - Array of estimate objects
 * @returns {number} - Total revenue from won estimates
 */
export function calculateRevenueFromEstimates(estimates = []) {
  return estimates
    .filter(est => est.status === 'won' || est.status === 'sold')
    .reduce((sum, est) => {
      const revenue = parseFloat(est.total_price_with_tax || est.total_price || 0);
      return sum + (isNaN(revenue) ? 0 : revenue);
    }, 0);
}

/**
 * Get account revenue - prefers estimates, falls back to annual_revenue field
 * @param {Object} account - Account object
 * @param {Array} estimates - Array of estimate objects for this account (optional)
 * @returns {number} - Account revenue
 */
export function getAccountRevenue(account, estimates = []) {
  // If estimates are provided, calculate from won estimates (actual revenue)
  if (estimates && estimates.length > 0) {
    const revenueFromEstimates = calculateRevenueFromEstimates(estimates);
    if (revenueFromEstimates > 0) {
      return revenueFromEstimates;
    }
  }
  
  // Fall back to annual_revenue field
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
  if (estimates && estimates.length > 0) {
    const wonEstimates = estimates.filter(est => est.status === 'won' || est.status === 'sold');
    const hasStandardEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'standard'
    );
    const hasServiceEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'service'
    );
    
    // Segment D: Project only - has "Standard" (project) estimates but no "Service" (ongoing) estimates
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
 * Calculate total revenue across all accounts
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional)
 * @returns {number} - Total revenue
 */
export function calculateTotalRevenue(accounts, estimatesByAccountId = {}) {
  return accounts.reduce((total, account) => {
    const estimates = estimatesByAccountId[account.id] || [];
    const revenue = getAccountRevenue(account, estimates);
    return total + revenue;
  }, 0);
}

/**
 * Auto-assign revenue segments for all accounts based on revenue percentages
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional)
 * @returns {Array} - Array of accounts with updated revenue_segment
 */
export function autoAssignRevenueSegments(accounts, estimatesByAccountId = {}) {
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
