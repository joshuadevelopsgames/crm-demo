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
 * Calculate contract duration in months between two dates
 * @param {Date} startDate - Contract start date
 * @param {Date} endDate - Contract end date
 * @returns {number} - Duration in months
 */
function calculateDurationMonths(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate year and month differences
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();
  
  // Total months = years * 12 + months
  let totalMonths = yearDiff * 12 + monthDiff;
  
  // Only add 1 month if the end date is AFTER the start day (not same day)
  // This prevents exact 12-month contracts from being counted as 13 months
  // Example: Apr 15, 2025 → Apr 15, 2026 = 12 months (not 13)
  if (dayDiff > 0) {
    totalMonths += 1; // Include the end month only if end day is after start day
  }
  // If dayDiff === 0 (same day), don't add 1 - it's exactly N*12 months
  
  return totalMonths;
}

/**
 * Determine number of contract years based on duration in months
 * Rules:
 * - duration_months ≤ 12 → years_count = 1
 * - 12 < duration_months ≤ 24 → years_count = 2
 * - 24 < duration_months ≤ 36 → years_count = 3
 * - Exact multiples of 12 do NOT round up (24 months = 2 years, not 3)
 * - Otherwise: ceil(duration_months / 12)
 * @param {number} durationMonths - Duration in months
 * @returns {number} - Number of contract years
 */
function getContractYears(durationMonths) {
  if (durationMonths <= 12) return 1;
  if (durationMonths <= 24) return 2;
  if (durationMonths <= 36) return 3;
  // For longer contracts, use ceil but exact multiples of 12 don't round up
  if (durationMonths % 12 === 0) {
    return durationMonths / 12;
  }
  return Math.ceil(durationMonths / 12);
}

/**
 * Get the year an estimate applies to and its allocated value for the current year
 * Uses contract-year allocation logic: revenue allocated by contract years, not calendar year coverage
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Current year (e.g., 2024)
 * @returns {Object|null} - { appliesToCurrentYear: boolean, value: number } or null if no valid date
 */
function getEstimateYearData(estimate, currentYear) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  const createdDate = estimate.created_date ? new Date(estimate.created_date) : null;
  
  // Use total_price_with_tax consistently
  const totalPrice = parseFloat(estimate.total_price_with_tax) || 0;
  if (totalPrice === 0) return null;
  
  // Case 1: Both contract_start and contract_end exist
  // Use contract-year allocation logic
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = contractStart.getFullYear();
    
    // STEP 1: Calculate duration in months
    const durationMonths = calculateDurationMonths(contractStart, contractEnd);
    if (durationMonths <= 0) return null;
    
    // STEP 2: Determine number of contract years
    const yearsCount = getContractYears(durationMonths);
    
    // STEP 3: Determine which calendar years receive allocation
    // years_applied = [start_year, start_year+1, ..., start_year+(years_count-1)]
    const yearsApplied = [];
    for (let i = 0; i < yearsCount; i++) {
      yearsApplied.push(startYear + i);
    }
    
    // Check if current year is in years_applied
    const appliesToCurrentYear = yearsApplied.includes(currentYear);
    
    // STEP 4: Allocate revenue
    // annual_amount = total_price / years_count
    const annualAmount = totalPrice / yearsCount;
    
    return {
      appliesToCurrentYear,
      value: appliesToCurrentYear ? annualAmount : 0
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
  
  // Case 3: No contract dates, use estimate_date as fallback
  if (estimateDate && !isNaN(estimateDate.getTime())) {
    const estimateYear = estimateDate.getFullYear();
    const appliesToCurrentYear = currentYear === estimateYear;
    
    return {
      appliesToCurrentYear,
      value: totalPrice
    };
  }
  
  // Case 4: No dates at all - treat as applying to current year
  // This handles estimates that have no date information at all
  // We assume they apply to the current year (useful for test mode or estimates without dates)
  return {
    appliesToCurrentYear: true,
    value: totalPrice
  };
}

// Import getCurrentYear from test mode context
import { getCurrentYear } from '@/contexts/TestModeContext';

// Use the exported getCurrentYear function which respects test mode
function getCurrentYearForCalculation() {
  try {
    const year = getCurrentYear();
    // Debug: log the year being used when test mode is active
    if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
      console.log('[getCurrentYearForCalculation] Using year:', year, 'from getCurrentYear()');
    }
    return year;
  } catch (error) {
    // Fallback if context not initialized yet
    if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
      const year = window.__testModeGetCurrentYear();
      console.log('[getCurrentYearForCalculation] Using year:', year, 'from window.__testModeGetCurrentYear (fallback)');
      return year;
    }
    const year = new Date().getFullYear();
    console.warn('[getCurrentYearForCalculation] Using year:', year, 'from new Date() (no test mode available)');
    return year;
  }
}

/**
 * Calculate actual revenue from won estimates for the current year
 * Multi-year contracts are annualized (divided by number of years)
 * @param {Array} estimates - Array of estimate objects
 * @returns {number} - Total revenue from won estimates in current year (annualized for multi-year contracts)
 */
export function calculateRevenueFromEstimates(estimates = []) {
  const currentYear = getCurrentYearForCalculation();
  
  if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
    console.log(`[calculateRevenueFromEstimates] Using year: ${currentYear} for ${estimates.length} estimates`);
  }
  
  return estimates
    .filter(est => {
      // Only include won estimates (case-insensitive)
      if (!est.status || est.status.toLowerCase() !== 'won') {
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
  // Revenue should only come from won estimates for the current year
  // If there are no won estimates, return 0 (which will display as "-" in the UI)
  // Do NOT fall back to annual_revenue - that's a separate field for segment calculation
  
  const currentYear = getCurrentYearForCalculation();
  
  // Debug logging for test mode
  if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
    console.log(`[getAccountRevenue] Account: ${account.name}, Year: ${currentYear}, Estimates: ${estimates.length}`);
  }
  
  if (estimates && estimates.length > 0) {
    const calculatedRevenue = calculateRevenueFromEstimates(estimates);
    
    // Check if we have won estimates that apply to the current year
    const hasWonEstimatesForCurrentYear = estimates.some(est => {
      if (!est.status || est.status.toLowerCase() !== 'won') {
        return false;
      }
      const yearData = getEstimateYearData(est, currentYear);
      if (yearData && yearData.appliesToCurrentYear) {
        if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
          console.log(`[getAccountRevenue] Found won estimate for ${currentYear}:`, {
            estimateId: est.id,
            status: est.status,
            contractStart: est.contract_start,
            contractEnd: est.contract_end,
            estimateDate: est.estimate_date,
            value: yearData.value
          });
        }
        return true;
      }
      return false;
    });
    
    if (hasWonEstimatesForCurrentYear) {
      // We have won estimates that apply to current year, return calculated revenue
      // (even if 0, because that's the actual revenue from won estimates)
      if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
        console.log(`[getAccountRevenue] Revenue for ${account.name}: $${calculatedRevenue}`);
      }
      return calculatedRevenue;
    } else {
      if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
        console.log(`[getAccountRevenue] No won estimates for ${currentYear} for account ${account.name}`);
        // Log all estimates to see what we have
        estimates.forEach(est => {
          const yearData = getEstimateYearData(est, currentYear);
          console.log(`  Estimate ${est.id}: status=${est.status}, appliesTo${currentYear}=${yearData?.appliesToCurrentYear}, contractStart=${est.contract_start}, contractEnd=${est.contract_end}, estimate_date=${est.estimate_date}, created_date=${est.created_date}`);
        });
      }
    }
  }
  
  // No won estimates for current year - return 0 (will display as "-" in UI)
  // annual_revenue is a separate field used for segment calculation, not for displaying revenue
  return 0;
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
    const currentYear = getCurrentYearForCalculation();
    
    // Only consider won estimates from current year for type checking
    const wonEstimates = estimates.filter(est => {
      // Must be won (case-insensitive)
      if (!est.status || est.status.toLowerCase() !== 'won') {
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
  
  // For segment calculation, use revenue from won estimates
  // Note: annual_revenue should be calculated from won estimates automatically, not manually entered
  // If annual_revenue exists, it should match revenue from won estimates
  let accountRevenue = getAccountRevenue(account, estimates);
  
  // Legacy fallback: if no revenue from won estimates but annual_revenue exists, use it
  // This handles cases where annual_revenue was manually set before we made it calculated-only
  // In the future, annual_revenue should always be calculated from won estimates
  if (accountRevenue <= 0 && account?.annual_revenue) {
    const annualRevenue = typeof account.annual_revenue === 'number' 
      ? account.annual_revenue 
      : parseFloat(account.annual_revenue) || 0;
    if (annualRevenue > 0) {
      accountRevenue = annualRevenue;
    }
  }
  
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
    let revenue = getAccountRevenue(account, estimates);
    
    // Legacy fallback: include annual_revenue if no revenue from won estimates
    // Note: annual_revenue should be calculated from won estimates automatically
    // This handles legacy data where annual_revenue might have been manually set
    if (revenue <= 0 && account?.annual_revenue) {
      const annualRevenue = typeof account.annual_revenue === 'number' 
        ? account.annual_revenue 
        : parseFloat(account.annual_revenue) || 0;
      if (annualRevenue > 0) {
        revenue = annualRevenue;
      }
    }
    
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
