/**
 * Calculate revenue segment based on current year revenue percentage (year-based, not rolling 12 months)
 * 
 * Segment A: >= 15% of total revenue (current year)
 * Segment B: 5-15% of total revenue (current year)
 * Segment C: 0-5% of total revenue (current year)
 * Segment D: Project only (has "Standard" type estimates but no "Service" type estimates)
 *   - "Standard" = project (one-time)
 *   - "Service" = ongoing/recurring
 *   - If account has BOTH Standard and Service, it gets A/B/C based on revenue (not D)
 * 
 * Revenue is calculated from won estimates for the current year only (year-based calculation)
 * Per spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
 * Per spec R1, R11: Status determination uses isWonStatus() to respect pipeline_status priority
 * 
 * Multi-year contracts are annualized (total price divided by number of years)
 */

import { isWonStatus } from './reportCalculations.js';

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
 * Detect potential data entry errors in contract dates
 * Flags contracts where duration is exactly 1 month over an exact year boundary
 * (e.g., 13 months, 25 months, 37 months)
 * Per spec R24-R27: Typo detection is advisory only and does not change contract_years
 * @param {number} durationMonths - Duration in months
 * @param {number} contractYears - Calculated contract years
 * @returns {boolean} - True if typo is detected
 */
export function detectContractTypo(durationMonths, contractYears) {
  // Calculate remainder months
  const remainderMonths = durationMonths % 12;
  
  // Typo detected if remainder is exactly 1 month (per spec R24)
  // This catches: 13 months (1 year + 1), 25 months (2 years + 1), 37 months (3 years + 1), etc.
  return remainderMonths === 1;
}

/**
 * Get the year an estimate applies to and its allocated value for the current year
 * Uses year-based calculation (not rolling 12 months): revenue allocated by calendar year
 * Per spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Current year (e.g., 2025)
 * @returns {Object|null} - { appliesToCurrentYear: boolean, value: number } or null if no valid date
 */
function getEstimateYearData(estimate, currentYear) {
  // Per spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  const createdDate = estimate.created_date ? new Date(estimate.created_date) : null;
  
  // Use total_price_with_tax consistently - this is the standard field for revenue calculations
  const totalPriceWithTax = parseFloat(estimate.total_price_with_tax);
  const totalPriceNoTax = parseFloat(estimate.total_price);
  
  // If total_price_with_tax is missing but total_price exists, use total_price as fallback (per spec R8, R9)
  let totalPrice;
  if (isNaN(totalPriceWithTax) || totalPriceWithTax === 0) {
    if (totalPriceNoTax && totalPriceNoTax > 0) {
      // Use total_price as fallback
      totalPrice = totalPriceNoTax;
      
      // Notify user once per session (per spec R9)
      if (typeof window !== 'undefined') {
        if (!window.__totalPriceFallbackNotified) {
          // Dynamic import to avoid circular dependencies
          import('react-hot-toast').then(({ default: toast }) => {
            toast.error('Some estimates are missing tax-inclusive prices. Using base price as fallback.');
          });
          window.__totalPriceFallbackNotified = true;
        }
      }
    } else {
      // No price data at all
      return null;
    }
  } else {
    totalPrice = totalPriceWithTax;
  }
  
  // Debug logging for year selector
  if (typeof window !== 'undefined' && window.__getCurrentYear && currentYear === 2025) {
    const debugInfo = {
      estimateId: estimate.id || estimate.lmn_estimate_id,
      currentYear,
      contractEndRaw: estimate.contract_end,
      contractEndParsed: contractEnd ? contractEnd.getFullYear() : null,
      contractStartRaw: estimate.contract_start,
      contractStartParsed: contractStart ? contractStart.getFullYear() : null,
      estimateDateRaw: estimate.estimate_date,
      estimateDateParsed: estimateDate ? estimateDate.getFullYear() : null,
      createdDateRaw: estimate.created_date,
      createdDateParsed: createdDate ? createdDate.getFullYear() : null,
      totalPrice,
      hasContractEnd: !!contractEnd && !isNaN(contractEnd.getTime()),
      hasContractStart: !!contractStart && !isNaN(contractStart.getTime()),
      hasEstimateDate: !!estimateDate && !isNaN(estimateDate.getTime()),
      hasCreatedDate: !!createdDate && !isNaN(createdDate.getTime())
    };
    // Only log first few to avoid spam
    if (!window.__estimateYearDataDebugCount) window.__estimateYearDataDebugCount = 0;
    if (window.__estimateYearDataDebugCount < 10) {
      console.log('[getEstimateYearData] Debug:', debugInfo);
      window.__estimateYearDataDebugCount++;
    }
  }
  
  // Per spec R2: Determine which date to use for year calculation
  let yearDeterminationDate = null;
  let yearDeterminationSource = null;
  
  // Priority 1: contract_end
  if (contractEnd && !isNaN(contractEnd.getTime())) {
    yearDeterminationDate = contractEnd;
    yearDeterminationSource = 'contract_end';
  }
  // Priority 2: contract_start
  else if (contractStart && !isNaN(contractStart.getTime())) {
    yearDeterminationDate = contractStart;
    yearDeterminationSource = 'contract_start';
  }
  // Priority 3: estimate_date
  else if (estimateDate && !isNaN(estimateDate.getTime())) {
    yearDeterminationDate = estimateDate;
    yearDeterminationSource = 'estimate_date';
  }
  // Priority 4: created_date
  else if (createdDate && !isNaN(createdDate.getTime())) {
    yearDeterminationDate = createdDate;
    yearDeterminationSource = 'created_date';
  }
  
  // Per spec R9: Multi-year contracts allocate to sequential calendar years starting from contract_start
  // If we have both contract_start and contract_end, use contract allocation (not determination year)
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    // Multi-year contract: annualize the revenue per spec R8
    const startYear = contractStart.getFullYear();
    const durationMonths = calculateDurationMonths(contractStart, contractEnd);
    if (durationMonths <= 0) return null;
    
    const yearsCount = getContractYears(durationMonths);
    const annualAmount = totalPrice / yearsCount;
    
    // Per spec R9: Allocate to sequential calendar years starting from contract_start
    const yearsApplied = [];
    for (let i = 0; i < yearsCount; i++) {
      yearsApplied.push(startYear + i);
    }
    const appliesToCurrentYear = yearsApplied.includes(currentYear);
    
    // Detect typo (per spec R20)
    const hasTypo = detectContractTypo(durationMonths, yearsCount);
    
    return {
      appliesToCurrentYear,
      value: appliesToCurrentYear ? annualAmount : 0,
      durationMonths,        // Include for display
      contractYears: yearsCount,  // Include for display
      hasTypo,               // Typo flag
      typoReason: hasTypo ? `Duration (${durationMonths} months) exceeds an exact ${yearsCount - 1} year boundary by one month. Possible date entry error.` : null
    };
  }
  
  // If we have a date for year determination (but no contract dates), use it
  if (yearDeterminationDate) {
    const determinationYear = yearDeterminationDate.getFullYear();
    const appliesToCurrentYear = currentYear === determinationYear;
    
    // Single-year or no contract dates: use full price
    return {
      appliesToCurrentYear,
      value: appliesToCurrentYear ? totalPrice : 0
    };
  }
  
  // Case: No dates at all - treat as applying to current year
  // This handles estimates that have no date information at all
  // We assume they apply to the current year (useful for test mode or estimates without dates)
  return {
    appliesToCurrentYear: true,
    value: totalPrice
  };
}

// Import getCurrentYear from year selector context
import { getCurrentYear } from '@/contexts/YearSelectorContext';

// Use the exported getCurrentYear function which respects test mode
function getCurrentYearForCalculation() {
  try {
    const year = getCurrentYear();
    // Debug: log the year being used
    if (typeof window !== 'undefined' && window.__getCurrentYear) {
      console.log('[getCurrentYearForCalculation] Using year:', year, 'from getCurrentYear()');
    }
    return year;
  } catch (error) {
    // Fallback if context not initialized yet
    if (typeof window !== 'undefined' && window.__getCurrentYear) {
      const year = window.__getCurrentYear();
      console.log('[getCurrentYearForCalculation] Using year:', year, 'from window.__getCurrentYear (fallback)');
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
  
  if (typeof window !== 'undefined' && window.__getCurrentYear) {
    console.log(`[calculateRevenueFromEstimates] Using year: ${currentYear} for ${estimates.length} estimates`);
  }
  
  return estimates
    .filter(est => {
      // Per spec R1, R11: Only include won estimates - use isWonStatus to respect pipeline_status priority
      if (!isWonStatus(est)) {
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
  
  // Debug logging
  if (typeof window !== 'undefined' && window.__getCurrentYear) {
    console.log(`[getAccountRevenue] Account: ${account.name}, Year: ${currentYear}, Estimates: ${estimates.length}`);
  }
  
  if (estimates && estimates.length > 0) {
    const calculatedRevenue = calculateRevenueFromEstimates(estimates);
    
    // Per spec R1, R11: Check if we have won estimates that apply to the current year
    const hasWonEstimatesForCurrentYear = estimates.some(est => {
      if (!isWonStatus(est)) {
        return false;
      }
      const yearData = getEstimateYearData(est, currentYear);
      if (yearData && yearData.appliesToCurrentYear) {
        if (typeof window !== 'undefined' && window.__getCurrentYear) {
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
      if (typeof window !== 'undefined' && window.__getCurrentYear) {
        console.log(`[getAccountRevenue] Revenue for ${account.name}: $${calculatedRevenue}`);
      }
      return calculatedRevenue;
    } else {
      if (typeof window !== 'undefined' && window.__getCurrentYear) {
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
 * Uses stored annual_revenue directly (already calculated for current year)
 * @param {Object} account - The account object
 * @param {number} totalRevenue - Total revenue across all accounts (sum of annual_revenue)
 * @param {Array} estimates - Array of estimate objects for this account (optional, only used for Segment D check)
 * @returns {string} - Revenue segment: 'A', 'B', 'C', or 'D'
 */
export function calculateRevenueSegment(account, totalRevenue, estimates = []) {
  // Check if account is project only (has "Standard" type estimates but no "Service" type estimates)
  // If account has BOTH Standard and Service, it gets A/B/C based on revenue (not D)
  if (estimates && estimates.length > 0) {
    const currentYear = getCurrentYearForCalculation();
    
    // Per spec R1, R11: Only consider won estimates from current year for type checking
    const wonEstimates = estimates.filter(est => {
      // Must be won - use isWonStatus to respect pipeline_status priority
      if (!isWonStatus(est)) {
        return false;
      }
      
      // Only consider estimates that apply to current year
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    });
    
    // Debug logging for Segment D calculation
    if (typeof window !== 'undefined' && window.__debugSegmentD) {
      console.log(`[Segment D Debug] Account: ${account.name || account.id}, Year: ${currentYear}, Total estimates: ${estimates.length}, Won estimates for year: ${wonEstimates.length}`);
      if (wonEstimates.length > 0) {
        const types = wonEstimates.map(e => e.estimate_type || 'NULL');
        console.log(`  Estimate types: ${types.join(', ')}`);
      }
    }
    
    const hasStandardEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'standard'
    );
    const hasServiceEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'service'
    );
    
    // Segment D: Project only - has "Standard" (project) estimates but NO "Service" (ongoing) estimates
    // If it has BOTH Standard and Service, it will be A/B/C based on revenue percentage
    if (hasStandardEstimates && !hasServiceEstimates) {
      if (typeof window !== 'undefined' && window.__debugSegmentD) {
        console.log(`  ✅ Segment D assigned to ${account.name || account.id}`);
      }
      return 'D';
    }
    
    if (typeof window !== 'undefined' && window.__debugSegmentD && hasStandardEstimates) {
      console.log(`  ⚠️  Account has Standard but also Service - will use revenue-based segment`);
    }
  }
  
  // Use stored annual_revenue directly (already calculated for current year from won estimates)
  // annual_revenue should be updated whenever estimates change, so we can use it directly here
  const accountRevenue = typeof account.annual_revenue === 'number' 
    ? account.annual_revenue 
    : parseFloat(account.annual_revenue) || 0;
  
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
 * Uses stored annual_revenue directly from each account
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional, not used anymore)
 * @returns {number} - Total revenue from current year (sum of all accounts' annual_revenue)
 */
export function calculateTotalRevenue(accounts, estimatesByAccountId = {}) {
  return accounts.reduce((total, account) => {
    // Use stored annual_revenue directly (already calculated for current year)
    const revenue = typeof account.annual_revenue === 'number' 
      ? account.annual_revenue 
      : parseFloat(account.annual_revenue) || 0;
    
    return total + revenue;
  }, 0);
}

/**
 * Auto-assign revenue segments for all accounts based on current year revenue percentages
 * Uses stored annual_revenue directly (already calculated for current year)
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional, only used for Segment D check)
 * @returns {Array} - Array of accounts with updated revenue_segment
 */
export function autoAssignRevenueSegments(accounts, estimatesByAccountId = {}) {
  // Calculate total revenue from current year across all accounts
  // Uses stored annual_revenue directly - no need to recalculate from estimates
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
