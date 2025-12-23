/**
 * Calculate revenue segment based on current year revenue percentage
 * 
 * Segment A: >= 15% of total revenue (current year)
 * Segment B: 5-15% of total revenue (current year)
 * Segment C: 0-5% of total revenue (current year)
 * Segment D: Project only (has "Standard" type estimates but no "Service" type estimates)
 *   - "Standard" = project (one-time)
 *   - "Service" = ongoing/recurring
 *   - If account has BOTH Standard and Service, it gets A/B/C based on revenue (not D)
 * 
 * Revenue is calculated from won estimates for the current year only
 * Multi-year contracts are annualized (total price divided by number of years)
 */

/**
 * Get the year an estimate applies to and its value for the current year
 * For multi-year contracts, assign the full amount to the start year (not annualized)
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Current year (e.g., 2024)
 * @returns {Object|null} - { appliesToCurrentYear: boolean, value: number } or null if no valid date
 */
function getEstimateYearData(estimate, currentYear) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  
  const totalPrice = parseFloat(estimate.total_price_with_tax) || parseFloat(estimate.total_price) || 0;
  if (totalPrice === 0) return null;
  
  // Case 1: Both contract_start and contract_end exist
  // Assign full amount to the start year (e.g., Oct 1, 2024 to Sept 30, 2025 = 2024)
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = contractStart.getFullYear();
    const endYear = contractEnd.getFullYear();
    
    if (endYear < startYear) return null;
    
    // Full amount assigned to start year (not annualized)
    const appliesToCurrentYear = currentYear === startYear;
    
    return {
      appliesToCurrentYear,
      value: totalPrice // Full amount, not annualized
    };
  }
  
  // Case 2: Only contract_start exists
  if (contractStart && !isNaN(contractStart.getTime())) {
    const startYear = contractStart.getFullYear();
    const appliesToCurrentYear = currentYear === startYear;
    
    return {
      appliesToCurrentYear,
      value: totalPrice
    };
  }
  
  // Case 3: No contract dates, use estimate_date
  if (estimateDate && !isNaN(estimateDate.getTime())) {
    const estimateYear = estimateDate.getFullYear();
    const appliesToCurrentYear = currentYear === estimateYear;
    
    return {
      appliesToCurrentYear,
      value: totalPrice
    };
  }
  
  // No valid date found
  return null;
}

/**
 * Calculate actual revenue from won estimates for the current year
 * Multi-year contracts are annualized (divided by number of years)
 * @param {Array} estimates - Array of estimate objects
 * @returns {number} - Total revenue from won estimates in current year (annualized for multi-year contracts)
 */
export function calculateRevenueFromEstimates(estimates = []) {
  const currentYear = new Date().getFullYear();
  
  return estimates
    .filter(est => {
      // Only include won estimates
      if (est.status !== 'won') {
        return false;
      }
      
      // Check if estimate applies to current year
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    })
    .reduce((sum, est) => {
      const yearData = getEstimateYearData(est, currentYear);
      if (!yearData) return sum;
      return sum + (isNaN(yearData.value) ? 0 : yearData.value);
    }, 0);
}

/**
 * Get account revenue - total revenue from current year
 * @param {Object} account - Account object
 * @param {Array} estimates - Array of estimate objects for this account (optional)
 * @returns {number} - Account total revenue from current year (annualized for multi-year contracts)
 */
export function getAccountRevenue(account, estimates = []) {
  // If estimates are provided, always use the calculated revenue (even if 0)
  // This ensures we use actual current year totals, not outdated annual_revenue
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
    const currentYear = new Date().getFullYear();
    
    // Only consider won estimates from current year for type checking
    const wonEstimates = estimates.filter(est => {
      // Must be won
      if (est.status !== 'won') {
        return false;
      }
      
      // Only consider estimates that apply to current year
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
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
 * Calculate total revenue across all accounts (current year total)
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional)
 * @returns {number} - Total revenue from current year (sum of all accounts, annualized for multi-year contracts)
 */
export function calculateTotalRevenue(accounts, estimatesByAccountId = {}) {
  return accounts.reduce((total, account) => {
    const estimates = estimatesByAccountId[account.id] || [];
    const revenue = getAccountRevenue(account, estimates);
    return total + revenue;
  }, 0);
}

/**
 * Auto-assign revenue segments for all accounts based on current year revenue percentages
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional)
 * @returns {Array} - Array of accounts with updated revenue_segment
 */
export function autoAssignRevenueSegments(accounts, estimatesByAccountId = {}) {
  // Calculate total revenue from current year across all accounts
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
