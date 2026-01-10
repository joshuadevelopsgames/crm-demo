/**
 * Calculate revenue segment based on selected year revenue percentage (year-based, not rolling 12 months)
 * Per Segmentation Spec: docs/sections/segmentation.md
 * 
 * Segment A: > 15% of total revenue (selected year) - per spec R6
 * Segment B: 5-15% of total revenue (selected year) - per spec R7
 * Segment C: < 5% of total revenue (selected year) - per spec R8
 * Segment D: No Service estimates (Standard only or no estimates) - per spec R2, R9
 *   - "Standard" = project (one-time)
 *   - "Service" = ongoing/recurring
 *   - A/B/C can have Standard revenue, but D cannot have Service estimates - per spec R3
 * Segment E: Lead (no sold estimates) - ICP above 80%
 * Segment F: Lead (no sold estimates) - ICP below 80%
 * 
 * Revenue is calculated from won estimates for the selected year only (year-based calculation)
 * Per spec R1: All segment information is based on total revenue for the selected year
 * Per spec R5: Total revenue is calculated per year (not across all years). For 2024, we calculate
 *   totalRevenue[2024] = sum of all accounts' revenue_by_year[2024]. For 2025, we calculate
 *   totalRevenue[2025] = sum of all accounts' revenue_by_year[2025]. These are independent.
 * Per spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
 * Per spec R1, R11: Status determination uses isWonStatus() to respect pipeline_status priority
 * 
 * Multi-year contracts are annualized (total price divided by number of years)
 */

import { isWonStatus } from './reportCalculations.js';
// Inline getYearFromDateString to avoid serverless import issues
function getYearFromDateString(dateStr) {
  if (!dateStr) return null;
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return parseInt(dateMatch[1]);
  }
  // Fallback: try parsing as Date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.getFullYear();
  }
  return null;
}

/**
 * Calculate contract duration in months between two dates
 * @param {Date} startDate - Contract start date
 * @param {Date} endDate - Contract end date
 * @returns {number} - Duration in months
 */
export function calculateDurationMonths(startDate, endDate) {
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
export function getContractYears(durationMonths) {
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
 * Get the year an estimate applies to and its allocated value for the selected year
 * Uses year-based calculation (not rolling 12 months): revenue allocated by calendar year
 * Per spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Selected year (e.g., 2025) from YearSelectorContext
 * @returns {Object|null} - { appliesToCurrentYear: boolean, value: number } or null if no valid date
 */
export function getEstimateYearData(estimate, currentYear) {
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
      contractEndParsed: getYearFromDateString(estimate.contract_end),
      contractStartRaw: estimate.contract_start,
      contractStartParsed: getYearFromDateString(estimate.contract_start),
      estimateDateRaw: estimate.estimate_date,
      estimateDateParsed: getYearFromDateString(estimate.estimate_date),
      createdDateRaw: estimate.created_date,
      createdDateParsed: getYearFromDateString(estimate.created_date),
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
  // Extract year from string (avoid timezone issues)
  let determinationYear = null;
  let yearDeterminationSource = null;
  
  // Priority 1: contract_end
  if (estimate.contract_end) {
    determinationYear = getYearFromDateString(estimate.contract_end);
    if (determinationYear !== null) {
      yearDeterminationSource = 'contract_end';
    }
  }
  // Priority 2: contract_start
  if (determinationYear === null && estimate.contract_start) {
    determinationYear = getYearFromDateString(estimate.contract_start);
    if (determinationYear !== null) {
      yearDeterminationSource = 'contract_start';
    }
  }
  // Priority 3: estimate_date
  if (determinationYear === null && estimate.estimate_date) {
    determinationYear = getYearFromDateString(estimate.estimate_date);
    if (determinationYear !== null) {
      yearDeterminationSource = 'estimate_date';
    }
  }
  // Priority 4: created_date
  if (determinationYear === null && estimate.created_date) {
    determinationYear = getYearFromDateString(estimate.created_date);
    if (determinationYear !== null) {
      yearDeterminationSource = 'created_date';
    }
  }
  
  // Per spec R9: Multi-year contracts allocate to sequential calendar years starting from contract_start
  // If we have both contract_start and contract_end, use contract allocation (not determination year)
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    // Multi-year contract: annualize the revenue per spec R8
    const startYear = getYearFromDateString(estimate.contract_start);
    if (startYear === null) return null;
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
  
  // If we have a year for determination (but no contract dates), use it
  if (determinationYear !== null) {
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

// Get current year from YearSelectorContext - REQUIRED, no fallback
// Per Year Selection System spec R6: All revenue calculations MUST use getCurrentYear() from YearSelectorContext
// Per user requirement: Never fall back to current year, only ever go by selected year
function getCurrentYearForCalculation() {
  // In browser context, use the global getCurrentYear function from YearSelectorContext
  // This respects the user's selected year
  if (typeof window !== 'undefined' && window.__getCurrentYear) {
    return window.__getCurrentYear();
  }
  // No fallback - selected year is required
  // If this is called in a context where window.__getCurrentYear is not available,
  // it means the YearSelectorContext is not initialized, which is an error
  throw new Error('getCurrentYearForCalculation: YearSelectorContext not initialized. Selected year is required.');
}

/**
 * Get the year to use for segment calculations
 * Segments are calculated based on current year, with special rule:
 * - January and February: use previous year's segments
 * - March and later: use current year's segments
 * 
 * IMPORTANT: This function is called dynamically each time segments are needed.
 * When March 1st arrives, this function will automatically return the current year
 * instead of the previous year, causing segments to switch automatically.
 * 
 * To ensure segments are available for the current year when March arrives:
 * - Segments are calculated for ALL years during import/recalculation
 * - The current year's segments will already be in segment_by_year
 * - No manual action is needed - the switch happens automatically
 * 
 * @returns {number} - Year to use for segment calculations
 */
export function getSegmentYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1 for 1-12
  
  // January (1) or February (2): use previous year
  if (currentMonth === 1 || currentMonth === 2) {
    return currentYear - 1;
  }
  
  // March (3) and later: use current year
  return currentYear;
}

/**
 * Calculate revenue from won estimates for a specific account and year
 * 
 * This function calculates revenue on-the-fly from won estimates, not from stored revenue_by_year.
 * Per spec R1, R11: Only won estimates are included in revenue calculations.
 * Per spec R2: Year determination uses priority order: contract_end → contract_start → estimate_date → created_date
 * Per spec R8-R9: Multi-year contracts are annualized and allocated to sequential calendar years
 * 
 * @param {Object} account - Account object
 * @param {Array} estimates - Array of estimate objects for this account
 * @param {number} selectedYear - Selected year (optional, defaults to current year from context)
 * @returns {number} - Revenue for selected year from won estimates, or 0 if no won estimates
 */
export function calculateRevenueFromWonEstimates(account, estimates = [], selectedYear = null) {
  const year = selectedYear || getCurrentYearForCalculation();
  
  if (!estimates || estimates.length === 0) {
    return 0;
  }
  
  // Filter for won estimates only (per spec R1, R11)
  const wonEstimates = estimates.filter(est => isWonStatus(est));
  
  if (wonEstimates.length === 0) {
    return 0;
  }
  
  // Calculate revenue from won estimates for the selected year
  const revenue = wonEstimates.reduce((sum, est) => {
    const yearData = getEstimateYearData(est, year);
    if (!yearData || !yearData.appliesToCurrentYear) return sum;
    return sum + (isNaN(yearData.value) ? 0 : yearData.value);
  }, 0);
  
  return revenue;
}

/**
 * Get revenue for selected year from account's revenue_by_year field
 * 
 * IMPORTANT: Revenue is calculated during import only and stored in revenue_by_year.
 * This function reads from stored data, it does NOT calculate revenue from estimates.
 * 
 * Per spec R12a: Revenue display reads from stored revenue_by_year[selectedYear] field.
 * 
 * @param {Object} account - Account object
 * @param {number} selectedYear - Selected year (optional, defaults to current year from context)
 * @returns {number} - Revenue for selected year, or 0 if not available
 */
export function getRevenueForYear(account, selectedYear = null) {
  const year = selectedYear || getCurrentYearForCalculation();
  
  if (account.revenue_by_year && typeof account.revenue_by_year === 'object') {
    const yearRevenue = account.revenue_by_year[year.toString()];
    return typeof yearRevenue === 'number' ? yearRevenue : parseFloat(yearRevenue) || 0;
  }
  
  // No revenue_by_year data available
  return 0;
}

/**
 * Calculate revenue segment for a specific year
 * Helper function used by both calculateRevenueSegment and calculateSegmentsForAllYears
 * 
 * IMPORTANT: totalRevenue parameter must be the total revenue for THIS SPECIFIC YEAR ONLY,
 * not total revenue across all years. Per spec R5: totalRevenue[year] = sum of all accounts'
 * revenue_by_year[year] for that year only.
 * 
 * @param {Object} account - The account object
 * @param {number} year - The year to calculate segment for
 * @param {number} totalRevenue - Total revenue for THIS SPECIFIC YEAR ONLY (not across all years)
 * @param {Array} estimates - Array of estimate objects for this account (optional, only used for Segment D check)
 * @returns {string} - Revenue segment: 'A', 'B', 'C', 'D', 'E', or 'F'
 */
export function calculateRevenueSegmentForYear(account, year, totalRevenue, estimates = []) {
  // Check for leads (Segments E and F) - highest priority
  // Lead = no won estimates for the selected year
  const wonEstimates = estimates.filter(est => {
    if (!isWonStatus(est)) return false;
    const yearData = getEstimateYearData(est, year);
    return yearData && yearData.appliesToCurrentYear;
  });
  
  // If no won estimates, this is a lead - check ICP score
  if (wonEstimates.length === 0) {
    const organizationScore = account?.organization_score;
    // Check if organization_score exists and is a valid number
    if (organizationScore !== null && organizationScore !== undefined) {
      const icpScore = typeof organizationScore === 'number' 
        ? organizationScore 
        : parseFloat(organizationScore);
      
      if (!isNaN(icpScore)) {
        // Segment E: Lead with ICP >= 80%
        if (icpScore >= 80) {
          return 'E';
        }
        // Segment F: Lead with ICP < 80%
        return 'F';
      }
    }
    // If no ICP score available, default to Segment F (lead, no ICP score)
    return 'F';
  }
  
  // Existing clients (have won estimates) - proceed with A/B/C/D logic
  // Segment D check (uses estimates for this specific year)
  if (estimates && estimates.length > 0) {
    const hasStandardEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'standard'
    );
    const hasServiceEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'service'
    );
    
    if (hasStandardEstimates && !hasServiceEstimates) {
      return 'D';
    }
  }
  
  // Calculate account revenue from won estimates for this specific year (on-the-fly)
  const accountRevenue = calculateRevenueFromWonEstimates(account, estimates, year);
  
  if (accountRevenue <= 0 || !totalRevenue || totalRevenue <= 0) {
    return 'C';
  }
  
  const revenuePercentage = (accountRevenue / totalRevenue) * 100;
  
  if (revenuePercentage > 15) return 'A';
  if (revenuePercentage >= 5 && revenuePercentage <= 15) return 'B';
  return 'C';
}

/**
 * Calculate revenue segment for a single account
 * Uses revenue_by_year[selectedYear] for account revenue
 * 
 * IMPORTANT: totalRevenue parameter must be the total revenue for the selected year ONLY,
 * not total revenue across all years. Per spec R5: totalRevenue[selectedYear] = sum of all
 * accounts' revenue_by_year[selectedYear] for that year only.
 * 
 * @param {Object} account - The account object
 * @param {number} totalRevenue - Total revenue for selected year ONLY (not across all years)
 * @param {Array} estimates - Array of estimate objects for this account (optional, only used for Segment D check)
 * @returns {string} - Revenue segment: 'A', 'B', 'C', 'D', 'E', or 'F'
 */
export function calculateRevenueSegment(account, totalRevenue, estimates = []) {
  // Use segment year (current year, or previous year if Jan/Feb)
  const segmentYear = getSegmentYear();
  return calculateRevenueSegmentForYear(account, segmentYear, totalRevenue, estimates);
}

/**
 * Calculate total revenue across all accounts for the selected year only
 * Calculates from won estimates (on-the-fly), not from stored revenue_by_year
 * 
 * IMPORTANT: This calculates total revenue for ONE specific year only (the selected year).
 * Total revenue is calculated separately for each year. The total revenue for 2024 is 
 * independent of the total revenue for 2025.
 * 
 * Per spec R1, R5: All segment information is based on total revenue for the selected year only
 * (not total revenue across all years).
 * 
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array
 * @param {number} selectedYear - Selected year (optional, defaults to current year from context)
 * @returns {number} - Total revenue for selected year only (sum of all accounts' won estimates for that year)
 */
export function calculateTotalRevenue(accounts, estimatesByAccountId = {}, selectedYear = null) {
  // Per spec R1, R5: All segment information is based on total revenue for the selected year only
  // (not total revenue across all years)
  const year = selectedYear || getCurrentYearForCalculation();
  
  // Calculate total revenue from won estimates for all accounts for the selected year
  return accounts.reduce((total, account) => {
    const accountEstimates = estimatesByAccountId[account.id] || [];
    const accountRevenue = calculateRevenueFromWonEstimates(account, accountEstimates, year);
    return total + accountRevenue;
  }, 0);
}

/**
 * Calculate revenue segments for all years (not just selected year)
 * Returns object: { "2024": "A", "2025": "B", ... }
 * 
 * IMPORTANT: Total revenue is calculated separately for each year. For 2024, we calculate
 * totalRevenue[2024] = sum of all accounts' revenue_by_year[2024]. For 2025, we calculate
 * totalRevenue[2025] = sum of all accounts' revenue_by_year[2025]. These are independent
 * calculations. When calculating segments for 2024, we only use the total revenue for 2024,
 * not the sum across all years.
 * 
 * Per spec R5: Total revenue is calculated per year (not across all years).
 * 
 * @param {Object} account - The account object
 * @param {Array} allAccounts - Array of all accounts (for total revenue calculation per year)
 * @param {Array} estimates - Array of estimate objects for this account
 * @returns {Object} - Object with year as key and segment as value
 */
export function calculateSegmentsForAllYears(account, allAccounts, estimates = []) {
  const segmentsByYear = {};
  
  // Get all years from revenue_by_year
  if (!account.revenue_by_year || typeof account.revenue_by_year !== 'object') {
    return {}; // No revenue data, return empty
  }
  
  const years = Object.keys(account.revenue_by_year).map(y => parseInt(y));
  
  // Calculate segment for each year
  years.forEach(year => {
    // Calculate total revenue for THIS SPECIFIC YEAR ONLY (not across all years)
    // Per spec R5: totalRevenue[year] = sum of all accounts' revenue_by_year[year] for that year only
    const totalRevenueForYear = allAccounts.reduce((total, acc) => {
      if (acc.revenue_by_year && acc.revenue_by_year[year.toString()]) {
        const yearRevenue = typeof acc.revenue_by_year[year.toString()] === 'number'
          ? acc.revenue_by_year[year.toString()]
          : parseFloat(acc.revenue_by_year[year.toString()]) || 0;
        return total + yearRevenue;
      }
      return total;
    }, 0);
    
    // Calculate segment for this specific year using this year's total revenue only
    const segment = calculateRevenueSegmentForYear(account, year, totalRevenueForYear, estimates);
    segmentsByYear[year.toString()] = segment;
  });
  
  return segmentsByYear;
}

/**
 * Get total estimates count for selected year from account's total_estimates_by_year field
 * 
 * IMPORTANT: Total estimates are calculated during import only and stored in total_estimates_by_year.
 * This function reads from stored data, it does NOT calculate counts from estimates.
 * 
 * Per Estimates spec R20-R23: Total estimates display reads from stored total_estimates_by_year[selectedYear] field.
 * 
 * @param {Object} account - Account object
 * @param {number} selectedYear - Selected year (optional, defaults to current year from context)
 * @returns {number} - Total estimates count for selected year, or 0 if not available
 */
export function getTotalEstimatesForYear(account, selectedYear = null) {
  const year = selectedYear || getCurrentYearForCalculation();
  
  if (account.total_estimates_by_year && typeof account.total_estimates_by_year === 'object') {
    const yearCount = account.total_estimates_by_year[year.toString()];
    return typeof yearCount === 'number' ? yearCount : parseInt(yearCount) || 0;
  }
  
  // No total_estimates_by_year data available
  return 0;
}

/**
 * Calculate segment for selected year from won estimates (on-the-fly calculation)
 * 
 * Calculates segment by:
 * 1. Calculating total revenue = sum of all won estimates from all accounts for selected year
 * 2. Calculating account revenue = sum of won estimates for this account for selected year
 * 3. Calculating percentage = (account revenue / total revenue) * 100
 * 4. Assigning segment based on percentage thresholds (A/B/C) or Segment D check
 * 
 * @param {Object} account - Account object
 * @param {Array} allAccounts - Array of all account objects (for total revenue calculation)
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array
 * @param {number} selectedYear - Selected year (optional, defaults to current year from context)
 * @returns {string} - Segment for selected year: 'A', 'B', 'C', or 'D'
 */
export function getSegmentForYear(account, selectedYear = null, allAccounts = [], estimatesByAccountId = {}) {
  // Always use segment year (current year, or previous year if Jan/Feb) for segment calculations
  // selectedYear parameter is ignored - segments are always based on current year logic
  const segmentYear = getSegmentYear();
  
  // If we don't have the required data for on-the-fly calculation, fall back to stored data
  if (!allAccounts || allAccounts.length === 0 || !estimatesByAccountId) {
    if (account.segment_by_year && typeof account.segment_by_year === 'object') {
      const yearSegment = account.segment_by_year[segmentYear.toString()];
      if (yearSegment && ['A', 'B', 'C', 'D', 'E', 'F'].includes(yearSegment)) {
        return yearSegment;
      }
    }
    return account.revenue_segment || 'C';
  }
  
  // Calculate total revenue from all won estimates for all accounts for the segment year
  const totalRevenue = calculateTotalRevenue(allAccounts, estimatesByAccountId, segmentYear);
  
  // Get this account's estimates
  const accountEstimates = estimatesByAccountId[account.id] || [];
  
  // Calculate segment using the helper function
  return calculateRevenueSegmentForYear(
    account,
    segmentYear,
    totalRevenue,
    accountEstimates
  );
}

/**
 * Auto-assign revenue segments for all accounts based on revenue percentages
 * Now calculates segments for ALL years and stores in segment_by_year
 * 
 * IMPORTANT: Segments are displayed based on getSegmentYear() which:
 * - January/February: uses previous year's segments
 * - March and later: uses current year's segments
 * 
 * This function calculates segments for ALL years, so when March arrives,
 * the current year's segments will already be in the database and will
 * automatically be used by getSegmentYear().
 * 
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (optional, only used for Segment D check)
 * @returns {Array} - Array of accounts with updated segment_by_year and revenue_segment
 */
export function autoAssignRevenueSegments(accounts, estimatesByAccountId = {}) {
  // Calculate segments for all years for each account
  return accounts.map(account => {
    const estimates = estimatesByAccountId[account.id] || [];
    const segmentsByYear = calculateSegmentsForAllYears(account, accounts, estimates);
    
    // Set revenue_segment to segment year's segment (current year, or previous year if Jan/Feb)
    // This ensures backward compatibility while respecting the segment year logic
    const segmentYear = getSegmentYear();
    const segmentYearSegment = segmentsByYear[segmentYear.toString()] || 'C';
    
    return {
      ...account,
      segment_by_year: Object.keys(segmentsByYear).length > 0 ? segmentsByYear : null,
      revenue_segment: segmentYearSegment // Use segmentYear instead of selectedYear for backward compatibility
    };
  });
}
