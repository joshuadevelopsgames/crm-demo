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

import { checkPriceFieldFallback } from './priceFieldFallbackNotification';

// Inline functions to avoid serverless import issues
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

// Inline isWonStatus to avoid serverless import issues
// Per spec R1, R11: pipeline_status is preferred, status field is fallback
function isWonStatus(statusOrEstimate, pipelineStatus = null) {
  let status, pipeline;
  
  // Support both: isWonStatus(estimate) or isWonStatus(status, pipelineStatus)
  if (typeof statusOrEstimate === 'object' && statusOrEstimate !== null) {
    // First param is an estimate object
    status = statusOrEstimate.status;
    pipeline = statusOrEstimate.pipeline_status;
  } else {
    // First param is a status string
    status = statusOrEstimate;
    pipeline = pipelineStatus;
  }
  
  // Per spec R11: Check pipeline_status first (preferred)
  if (pipeline) {
    const pipelineLower = pipeline.toString().toLowerCase().trim();
    if (pipelineLower === 'sold' || pipelineLower.includes('sold')) {
      return true;
    }
  }
  
  // Per spec R11: Check status field (fallback)
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  const wonStatuses = [
    'contract signed',
    'work complete',
    'billing complete',
    'email contract award',
    'verbal contract award',
    'contract in progress',
    'contract + billing complete',
    'sold', // LMN uses "Sold" as a won status
    'won' // Also support our simplified 'won' status
  ];
  return wonStatuses.includes(statusLower);
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
  const totalMonths = yearDiff * 12 + monthDiff;
  
  // If day difference is negative, we haven't quite reached the full month yet
  // But for contract purposes, we typically count full months, so we don't adjust
  // This matches the behavior of date-fns differenceInMonths
  
  return totalMonths;
}

/**
 * Get the number of years for a contract based on start and end dates
 * Uses a "fuzzy" 30-day grace period to handle contracts that end slightly after
 * an exact N-year anniversary (e.g., 1 year + 14 days = 1 year contract)
 * 
 * @param {Date|string} startDate - Contract start date
 * @param {Date|string} endDate - Contract end date
 * @returns {number} - Number of contract years (rounded down, with grace period)
 */
export function getContractYears(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Normalize to start of day for accurate day calculations
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const durationMonths = calculateDurationMonths(start, end);
  const baseYears = Math.floor(durationMonths / 12);
  const remainderMonths = durationMonths % 12;
  
  // Check if we're within the 30-day grace period for the next year
  if (remainderMonths === 0) {
    // Exactly N years - check if we're within 30 days after anniversary
    const anniversaryDate = new Date(start);
    anniversaryDate.setFullYear(start.getFullYear() + baseYears);
    anniversaryDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((end - anniversaryDate) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 0 && daysDiff <= 30) {
      return baseYears; // Within grace period, still counts as baseYears
    }
    // More than 30 days after anniversary, count as baseYears + 1
    return baseYears + 1;
  }
  
  // Check grace period for remainderMonths === 1 case
  if (remainderMonths === 1) {
    // Check if we're within 30 days after the lower year's anniversary
    if (baseYears > 0) {
      const lowerYearAnniversary = new Date(start);
      lowerYearAnniversary.setFullYear(start.getFullYear() + baseYears);
      lowerYearAnniversary.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((end - lowerYearAnniversary) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff <= 30) {
        return baseYears; // Within grace period of lower year, counts as baseYears
      }
    }
    
    // Also check the calculated year's anniversary
    const calculatedYearAnniversary = new Date(start);
    calculatedYearAnniversary.setFullYear(start.getFullYear() + baseYears + 1);
    calculatedYearAnniversary.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((end - calculatedYearAnniversary) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 0 && daysDiff <= 30) {
      return baseYears + 1; // Within grace period, counts as baseYears + 1
    }
  }
  
  // Default: round up if remainderMonths > 0
  return remainderMonths > 0 ? baseYears + 1 : baseYears;
}

/**
 * Check if a contract end date is within a 30-day grace period after an N-year anniversary
 * @param {Date|string} startDate - Contract start date
 * @param {Date|string} endDate - Contract end date
 * @param {number} years - Number of years to check
 * @returns {boolean} - True if end date is within 30 days after the anniversary
 */
export function isWithinGracePeriod(startDate, endDate, years) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0); // Normalize to start of day
  end.setHours(0, 0, 0, 0);   // Normalize to start of day
  
  const anniversaryDate = new Date(start);
  anniversaryDate.setFullYear(start.getFullYear() + years);
  anniversaryDate.setHours(0, 0, 0, 0); // Normalize to start of day
  
  const daysDiff = Math.floor((end - anniversaryDate) / (1000 * 60 * 60 * 24));
  return daysDiff >= 0 && daysDiff <= 30; // 0 to 30 days after anniversary
}

/**
 * Detect potential contract date typos
 * Returns true if duration is exactly N years + 1 month (likely a typo)
 * BUT excludes cases within the 30-day grace period
 * 
 * @param {number} durationMonths - Contract duration in months
 * @param {number} contractYears - Number of contract years (from getContractYears)
 * @param {Date|string} startDate - Contract start date (optional, for grace period check)
 * @param {Date|string} endDate - Contract end date (optional, for grace period check)
 * @returns {boolean} - True if likely a typo (N years + 1 month, not in grace period)
 */
export function detectContractTypo(durationMonths, contractYears, startDate = null, endDate = null) {
  const remainderMonths = durationMonths % 12;
  
  // If remainder is 1 month, check grace period before flagging as typo
  if (startDate && endDate && !isNaN(new Date(startDate).getTime()) && !isNaN(new Date(endDate).getTime()) && remainderMonths === 1) {
    // Check grace period for the year being exceeded
    if (contractYears > 1 && isWithinGracePeriod(startDate, endDate, contractYears - 1)) {
      return false; // Within grace period of the lower year, not a typo
    }
    // Also check calculated years for safety
    if (isWithinGracePeriod(startDate, endDate, contractYears)) {
      return false; // Within grace period, not a typo
    }
  }
  
  // Default typo detection: remainder of 1 month is suspicious
  return remainderMonths === 1;
}

/**
 * Get estimate year data - determines which year(s) an estimate applies to
 * Returns object with year, appliesToCurrentYear flag, and value (annualized for multi-year contracts)
 * 
 * Priority for year determination (per spec R2):
 * 1. contract_end
 * 2. contract_start
 * 3. estimate_date
 * 4. created_date
 * 
 * For multi-year contracts, annualizes the total price (divides by number of years)
 */
/**
 * Get price from estimate, preferring total_price over total_price_with_tax
 * Only falls back to total_price_with_tax if total_price is null or undefined (not if it's 0)
 * total_price will always have a value (even if 0), so fallback should never occur in normal operation
 * 
 * @param {Object} estimate - Estimate object
 * @returns {number} - Price value (0 if both are missing/null)
 */
export function getEstimatePrice(estimate) {
  if (!estimate) return 0;
  
  // Check for fallback and show toast notification if needed (once per session)
  checkPriceFieldFallback(estimate);
  
  // total_price will always have a value (even if 0), so only fallback if null/undefined
  if (estimate.total_price !== null && estimate.total_price !== undefined) {
    return typeof estimate.total_price === 'number' 
      ? estimate.total_price 
      : parseFloat(estimate.total_price) || 0;
  }
  
  // Fallback to total_price_with_tax only if total_price is null/undefined
  if (estimate.total_price_with_tax !== null && estimate.total_price_with_tax !== undefined) {
    return typeof estimate.total_price_with_tax === 'number'
      ? estimate.total_price_with_tax
      : parseFloat(estimate.total_price_with_tax) || 0;
  }
  
  return 0;
}

export function getEstimateYearData(estimate, currentYear) {
  if (!estimate) return null;
  
  // Check for fallback and show toast notification if needed (once per session)
  checkPriceFieldFallback(estimate);
  
  const totalPrice = getEstimatePrice(estimate);
  if (totalPrice === 0) return null;
  
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  
  // Handle multi-year contracts with annualization
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = getYearFromDateString(estimate.contract_start);
    if (startYear === null) return null;
    
    const durationMonths = calculateDurationMonths(contractStart, contractEnd);
    if (durationMonths <= 0) return null;
    
    const yearsCount = getContractYears(contractStart, contractEnd);
    if (yearsCount <= 0) return null;
    
    const yearsApplied = [];
    for (let i = 0; i < yearsCount; i++) {
      yearsApplied.push(startYear + i);
    }
    
    const appliesToCurrentYear = yearsApplied.includes(currentYear);
    const annualAmount = totalPrice / yearsCount;
    
    return {
      year: startYear,
      appliesToCurrentYear,
      value: appliesToCurrentYear ? annualAmount : 0,
      source: 'contract_allocation'
    };
  }
  
  // Single-year contracts - use date priority
  let determinationYear = null;
  let source = null;
  
  // Priority 1: contract_end
  if (estimate.contract_end) {
    determinationYear = getYearFromDateString(estimate.contract_end);
    source = 'contract_end';
  }
  // Priority 2: contract_start
  else if (estimate.contract_start) {
    determinationYear = getYearFromDateString(estimate.contract_start);
    source = 'contract_start';
  }
  // Priority 3: estimate_date
  else if (estimate.estimate_date) {
    determinationYear = getYearFromDateString(estimate.estimate_date);
    source = 'estimate_date';
  }
  // Priority 4: created_date
  else if (estimate.created_date) {
    determinationYear = getYearFromDateString(estimate.created_date);
    source = 'created_date';
  }
  
  if (determinationYear === null) return null;
  
  return {
    year: determinationYear,
    appliesToCurrentYear: determinationYear === currentYear,
    value: determinationYear === currentYear ? totalPrice : 0,
    source
  };
}

/**
 * Calculate revenue from won estimates for a specific year
 * Handles multi-year contracts by annualizing (dividing total price by contract years)
 * 
 * @param {Object} account - Account object
 * @param {Array} estimates - Array of estimate objects
 * @param {number} year - Year to calculate revenue for
 * @returns {number} - Revenue amount for the specified year
 */
export function calculateRevenueFromWonEstimates(account, estimates, year) {
  if (!estimates || estimates.length === 0) {
    // If no estimates provided, try to use stored revenue_by_year
    if (account && account.revenue_by_year && typeof account.revenue_by_year === 'object') {
      const yearRevenue = account.revenue_by_year[year.toString()];
      if (typeof yearRevenue === 'number') {
        return yearRevenue;
      }
      if (yearRevenue) {
        const parsed = parseFloat(yearRevenue);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return 0;
  }
  
  let totalRevenue = 0;
  
  estimates.forEach(est => {
    // Only count won estimates
    if (!isWonStatus(est)) return;
    
    // Get year data for this estimate
    const yearData = getEstimateYearData(est, year);
    if (!yearData || !yearData.appliesToCurrentYear) return;
    
    // Check for fallback and show toast notification if needed (once per session)
    checkPriceFieldFallback(est);
    
    // Get price (prefer total_price, fallback to total_price_with_tax only if total_price is null/undefined)
    const price = getEstimatePrice(est);
    
    if (price <= 0) return;
    
    // Check if this is a multi-year contract
    const contractYears = getContractYears(est.contract_start, est.contract_end);
    
    if (contractYears > 0) {
      // Annualize: divide total price by number of years
      const annualRevenue = price / contractYears;
      totalRevenue += annualRevenue;
    } else {
      // Single year or no contract dates - use full price
      totalRevenue += price;
    }
  });
  
  return totalRevenue;
}

/**
 * Calculate total revenue across all accounts for a specific year
 * Uses stored revenue_by_year values for performance
 * 
 * @param {Array} accounts - Array of account objects
 * @param {Object} estimatesByAccountId - Map of account_id to estimates (optional, for fallback)
 * @param {number} year - Year to calculate total revenue for
 * @returns {number} - Total revenue for all accounts for the specified year
 */
export function calculateTotalRevenue(accounts, estimatesByAccountId = {}, year) {
  if (!accounts || accounts.length === 0) return 0;
  
  let total = 0;
  
  accounts.forEach(account => {
    // Prefer stored revenue_by_year (calculated during import)
    if (account.revenue_by_year && typeof account.revenue_by_year === 'object') {
      const yearRevenue = account.revenue_by_year[year.toString()];
      if (typeof yearRevenue === 'number') {
        total += yearRevenue;
        return;
      }
      if (yearRevenue) {
        const parsed = parseFloat(yearRevenue);
        if (!isNaN(parsed)) {
          total += parsed;
          return;
        }
      }
    }
    
    // Fallback: calculate from estimates if stored value not available
    const accountEstimates = estimatesByAccountId[account.id] || [];
    if (accountEstimates.length > 0) {
      const accountRevenue = calculateRevenueFromWonEstimates(account, accountEstimates, year);
      total += accountRevenue;
    }
  });
  
  return total;
}

/**
 * Get segment year (current year, or previous year if Jan/Feb)
 * Segments use previous year's data in January/February, current year's data from March onward
 * @returns {number} - Year to use for segment calculations
 */
export function getSegmentYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1 for 1-12
  
  // January/February: use previous year's segments
  // March and later: use current year's segments
  if (currentMonth === 1 || currentMonth === 2) {
    return currentYear - 1;
  }
  
  return currentYear;
}

/**
 * Helper function to calculate Segment E/F for leads based on ICP score
 * @param {Object} account - Account object
 * @returns {string} - 'E' if ICP >= 80, 'F' otherwise
 */
function calculateLeadSegment(account) {
  const organizationScore = account?.organization_score;
  
  // Strict validation: must be a valid number > 0
  let icpScore = null;
  
  if (organizationScore !== null && organizationScore !== undefined && organizationScore !== '' && organizationScore !== '-') {
    if (typeof organizationScore === 'number') {
      if (!isNaN(organizationScore) && organizationScore > 0) {
        icpScore = organizationScore;
      }
    } else {
      const strValue = String(organizationScore).trim();
      if (strValue !== '-' && strValue !== 'null' && strValue !== 'undefined' && strValue !== 'N/A' && strValue !== 'n/a') {
        const parsed = parseFloat(strValue);
        if (!isNaN(parsed) && parsed > 0) {
          icpScore = parsed;
        }
      }
    }
  }
  
  // Only assign Segment E if we have a valid ICP score >= 80
  if (icpScore !== null && icpScore >= 80 && !isNaN(icpScore) && icpScore > 0) {
    return 'E';
  }
  
  // Default to Segment F: no ICP score, invalid ICP score, or ICP < 80%
  return 'F';
}

/**
 * Calculate revenue segment for a specific year
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
    return calculateLeadSegment(account);
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
  
  if (revenuePercentage >= 15) {
    return 'A';
  } else if (revenuePercentage >= 5) {
    return 'B';
  } else {
    return 'C';
  }
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
 * Get revenue for selected year from account's revenue_by_year field
 * 
 * IMPORTANT: Revenue is calculated during import only and stored in revenue_by_year.
 * This function reads from stored data, it does NOT calculate revenue from estimates.
 * 
 * @param {Object} account - Account object
 * @param {number} selectedYear - Selected year (optional, defaults to current year from context)
 * @returns {number} - Revenue for selected year, or 0 if not available
 */
export function getRevenueForYear(account, selectedYear) {
  if (!account || !account.revenue_by_year || typeof account.revenue_by_year !== 'object') {
    return 0;
  }
  
  const yearStr = selectedYear ? selectedYear.toString() : new Date().getFullYear().toString();
  const revenue = account.revenue_by_year[yearStr];
  
  if (typeof revenue === 'number') {
    return revenue;
  }
  
  if (revenue) {
    const parsed = parseFloat(revenue);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  return 0;
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
export function getTotalEstimatesForYear(account, selectedYear) {
  if (!account || !account.total_estimates_by_year || typeof account.total_estimates_by_year !== 'object') {
    return 0;
  }
  
  const yearStr = selectedYear ? selectedYear.toString() : new Date().getFullYear().toString();
  const count = account.total_estimates_by_year[yearStr];
  
  if (typeof count === 'number') {
    return count;
  }
  
  if (count) {
    const parsed = parseInt(count);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  return 0;
}

/**
 * Get segment for selected year
 * 
 * IMPORTANT: 
 * - For clients (accounts with won estimates): Always read from stored segment_by_year (A/B/C/D only change on import)
 * - For leads (accounts with no won estimates): Calculate E/F on-the-fly based on current ICP score
 * 
 * @param {Object} account - Account object
 * @param {number} selectedYear - Selected year (optional, defaults to current year from context)
 * @param {Array} allAccounts - Array of all account objects (for determining if account is a lead)
 * @param {Object} estimatesByAccountId - Map of account_id to estimates array (for determining if account is a lead)
 * @returns {string} - Segment for selected year: 'A', 'B', 'C', 'D', 'E', or 'F'
 */
export function getSegmentForYear(account, selectedYear = null, allAccounts = [], estimatesByAccountId = {}) {
  // Always use segment year (current year, or previous year if Jan/Feb)
  const segmentYear = getSegmentYear();
  
  // CRITICAL: Always validate stored Segment E before using it
  // Check stored segments first to catch bad data
  if (account.segment_by_year && typeof account.segment_by_year === 'object') {
    const yearSegment = account.segment_by_year[segmentYear.toString()];
    if (yearSegment === 'E') {
      // Always validate stored E - if no valid ICP score, return F
      const leadSegment = calculateLeadSegment(account);
      if (leadSegment === 'F') {
        return 'F'; // Stored E is invalid, return F
      }
      // Only return E if calculateLeadSegment confirms it's valid
      return 'E';
    }
  }
  
  // Also check revenue_segment fallback
  const storedSegment = account.revenue_segment || 'C';
  if (storedSegment === 'E') {
    // Always validate stored E
    const leadSegment = calculateLeadSegment(account);
    if (leadSegment === 'F') {
      return 'F'; // Stored E is invalid, return F
    }
    return 'E';
  }
  
  // Check if account is a lead (no won estimates) or client (has won estimates)
  const accountEstimates = estimatesByAccountId?.[account.id] || [];
  const wonEstimates = accountEstimates.filter(est => {
    if (!isWonStatus(est)) return false;
    const yearData = getEstimateYearData(est, segmentYear);
    return yearData && yearData.appliesToCurrentYear;
  });
  
  const isLead = wonEstimates.length === 0;
  
  if (isLead) {
    // For leads: Calculate E/F on-the-fly based on current ICP score
    // ICP scores can change anytime (when scorecard is filled out)
    return calculateLeadSegment(account);
  }
  
  // For clients: Read from stored segment_by_year (segments only change on import)
  if (account.segment_by_year && typeof account.segment_by_year === 'object') {
    const yearSegment = account.segment_by_year[segmentYear.toString()];
    if (yearSegment && ['A', 'B', 'C', 'D'].includes(yearSegment)) {
      return yearSegment;
    }
    // If stored segment is F, return it (F is valid for clients that became leads)
    if (yearSegment === 'F') {
      return 'F';
    }
  }
  
  // Fallback to revenue_segment (backward compatibility)
  if (storedSegment && storedSegment !== 'E') {
    return storedSegment;
  }
  
  return 'C'; // Default fallback
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
