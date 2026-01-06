/**
 * Report calculation utilities for End of Year Reports
 * Handles win/loss calculations, department breakdowns, and account performance metrics
 */

import { getYearFromDateString } from './dateFormatter';

/**
 * Format currency value with appropriate suffix (K for thousands, M for millions)
 * @param {number|string} value - The currency value to format
 * @returns {string} Formatted string like "$1.2M" or "$52.3K"
 */
export function formatCurrency(value) {
  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : Number(value);
  
  if (isNaN(numValue) || numValue === 0) return '$0';
  if (numValue < 0) return '-' + formatCurrency(-numValue);
  
  // Check millions first (values >= 1,000,000)
  if (numValue >= 1000000) {
    return `$${(numValue / 1000000).toFixed(1)}M`;
  } else if (numValue >= 1000) {
    return `$${(numValue / 1000).toFixed(1)}K`;
  } else {
    return `$${numValue.toFixed(0)}`;
  }
}

/**
 * Calculate overall win/loss statistics
 * @param {Array} estimates - Array of estimate objects
 * @returns {Object} Statistics object
 */
export function calculateOverallStats(estimates) {
  // Filter out pending (treat as lost per user requirement)
  // Use isWonStatus to match LMN's won status logic
  const decidedEstimates = estimates.filter(e => isWonStatus(e) || (e.status || '').toString().toLowerCase() === 'lost');
  const total = estimates.length;
  const won = estimates.filter(e => isWonStatus(e)).length;
  const lost = estimates.filter(e => (e.status || '').toString().toLowerCase() === 'lost').length;
  const pending = estimates.filter(e => !isWonStatus(e) && (e.status || '').toString().toLowerCase() !== 'lost').length;
  
  // Calculate win rate (won / (won + lost)) - only count decided estimates
  const decidedCount = won + lost;
  const winRate = decidedCount > 0 ? ((won / decidedCount) * 100) : 0;
  
  // Calculate revenue values
  // Use total_price_with_tax with fallback to total_price
  const totalValue = estimates.reduce((sum, e) => sum + (parseFloat(e.total_price_with_tax || e.total_price) || 0), 0);
  const wonValue = estimates
    .filter(e => isWonStatus(e))
    .reduce((sum, e) => sum + (parseFloat(e.total_price_with_tax || e.total_price) || 0), 0);
  const lostValue = estimates
    .filter(e => (e.status || '').toString().toLowerCase() === 'lost')
    .reduce((sum, e) => sum + (parseFloat(e.total_price_with_tax || e.total_price) || 0), 0);
  const pendingValue = estimates
    .filter(e => !isWonStatus(e) && (e.status || '').toString().toLowerCase() !== 'lost')
    .reduce((sum, e) => sum + (parseFloat(e.total_price_with_tax || e.total_price) || 0), 0);
  
  return {
    total,
    won,
    lost,
    pending,
    decidedCount,
    winRate: parseFloat(winRate.toFixed(1)),
    totalValue,
    wonValue,
    lostValue,
    pendingValue,
    // Estimates vs Won metrics
    estimatesVsWonRatio: total > 0 ? ((won / total) * 100).toFixed(1) : 0,
    revenueVsWonRatio: totalValue > 0 ? ((wonValue / totalValue) * 100).toFixed(1) : 0
  };
}

/**
 * Calculate win/loss statistics per account
 * @param {Array} estimates - Array of estimate objects
 * @param {Array} accounts - Array of account objects (for account names)
 * @returns {Array} Array of account statistics objects
 */
export function calculateAccountStats(estimates, accounts) {
  const accountMap = new Map();
  
  // Create account lookup map
  const accountLookup = new Map();
  accounts.forEach(acc => {
    accountLookup.set(acc.id, acc);
  });
  
  // Group estimates by account
  estimates.forEach(estimate => {
    const accountId = estimate.account_id;
    if (!accountId) return;
    
    if (!accountMap.has(accountId)) {
      const account = accountLookup.get(accountId);
      accountMap.set(accountId, {
        accountId,
        accountName: account?.name || 'Unknown Account',
        total: 0,
        won: 0,
        lost: 0,
        pending: 0,
        totalValue: 0,
        wonValue: 0,
        lostValue: 0,
        pendingValue: 0,
        estimates: []
      });
    }
    
    const stats = accountMap.get(accountId);
    stats.total++;
    stats.estimates.push(estimate);
    
    // Use total_price_with_tax with fallback to total_price
    const value = parseFloat(estimate.total_price_with_tax || estimate.total_price) || 0;
    stats.totalValue += value;
    
    if (isWonStatus(estimate)) {
      stats.won++;
      stats.wonValue += value;
    } else if ((estimate.status || '').toString().toLowerCase() === 'lost') {
      stats.lost++;
      stats.lostValue += value;
    } else {
      stats.pending++;
      stats.pendingValue += value;
    }
  });
  
  // Calculate win rates and convert to array
  const accountStats = Array.from(accountMap.values()).map(stats => {
    const decidedCount = stats.won + stats.lost;
    const winRate = decidedCount > 0 ? ((stats.won / decidedCount) * 100) : 0;
    
    return {
      ...stats,
      decidedCount,
      winRate: parseFloat(winRate.toFixed(1)),
      estimatesVsWonRatio: stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : 0,
      revenueVsWonRatio: stats.totalValue > 0 ? ((stats.wonValue / stats.totalValue) * 100).toFixed(1) : 0
    };
  });
  
  // Sort by total value (descending)
  return accountStats.sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Calculate win/loss statistics by department/division
 * @param {Array} estimates - Array of estimate objects
 * @returns {Array} Array of department statistics objects
 */
export function calculateDepartmentStats(estimates) {
  const deptMap = new Map();
  
  estimates.forEach(estimate => {
    const division = estimate.division || 'Uncategorized';
    
    if (!deptMap.has(division)) {
      deptMap.set(division, {
        division,
        total: 0,
        won: 0,
        lost: 0,
        totalValue: 0,
        wonValue: 0,
        lostValue: 0,
        estimates: []
      });
    }
    
    const stats = deptMap.get(division);
    stats.total++;
    stats.estimates.push(estimate);
    
    // Use total_price_with_tax with fallback to total_price
    const value = parseFloat(estimate.total_price_with_tax || estimate.total_price) || 0;
    stats.totalValue += value;
    
    if (isWonStatus(estimate)) {
      stats.won++;
      stats.wonValue += value;
    } else if ((estimate.status || '').toString().toLowerCase() === 'lost') {
      stats.lost++;
      stats.lostValue += value;
    }
  });
  
  // Calculate win rates and convert to array
  const deptStats = Array.from(deptMap.values()).map(stats => {
    const decidedCount = stats.won + stats.lost;
    const winRate = decidedCount > 0 ? ((stats.won / decidedCount) * 100) : 0;
    
    return {
      ...stats,
      decidedCount,
      winRate: parseFloat(winRate.toFixed(1)),
      estimatesVsWonRatio: stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : 0,
      revenueVsWonRatio: stats.totalValue > 0 ? ((stats.wonValue / stats.totalValue) * 100).toFixed(1) : 0
    };
  });
  
  // Sort by total value (descending)
  return deptStats.sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Calculate win/loss statistics per account within a specific department
 * @param {Array} estimates - Array of estimate objects (should be filtered to a specific department)
 * @param {Array} accounts - Array of account objects (for account names)
 * @param {string} department - Department/division name to filter by
 * @returns {Array} Array of account statistics objects for that department
 */
export function calculateDepartmentAccountStats(estimates, accounts, department) {
  // Filter estimates to only this department
  const deptEstimates = estimates.filter(e => (e.division || 'Uncategorized') === department);
  
  // Use the existing calculateAccountStats function but with filtered estimates
  return calculateAccountStats(deptEstimates, accounts);
}

/**
 * Check if an estimate status is considered "won" (sold) based on LMN's logic
 * Per spec R1, R11: pipeline_status is preferred, status field is fallback
 * Won statuses: Contract Signed, Work Complete, Billing Complete, Email Contract Award, Verbal Contract Award
 * @param {string|object} statusOrEstimate - Estimate status string OR full estimate object
 * @param {string} pipelineStatus - Estimate pipeline_status field (optional, only if first param is string)
 * @returns {boolean} True if status is considered "won"
 */
export function isWonStatus(statusOrEstimate, pipelineStatus = null) {
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
 * Filter estimates by year for Salesperson Performance reports
 * 
 * Per spec R2: Year determination uses priority order: contract_end → contract_start → estimate_date → created_date
 * Per spec R10: exclude_stats field is ignored - never used in any system logic
 * Per spec R12: Archived estimates are excluded from reports
 * 
 * @param {Array} estimates - Array of estimate objects
 * @param {number} year - Year to filter by (must be between 2000-2100)
 * @param {boolean} salesPerformanceMode - If true, uses same date priority. If false, uses same date priority (standardized per spec)
 * @param {boolean} soldOnly - If true, only include estimates with won statuses (for "Estimates Sold" calculations)
 * @returns {Array} Filtered estimates
 */
export function filterEstimatesByYear(estimates, year, salesPerformanceMode = false, soldOnly = false) {
  // First, remove duplicates by lmn_estimate_id (keep first occurrence)
  const uniqueEstimates = [];
  const seenLmnIds = new Set();
  estimates.forEach(est => {
    if (est.lmn_estimate_id) {
      if (!seenLmnIds.has(est.lmn_estimate_id)) {
        seenLmnIds.add(est.lmn_estimate_id);
        uniqueEstimates.push(est);
      }
    } else {
      // Estimates without lmn_estimate_id are included
      uniqueEstimates.push(est);
    }
  });

  return uniqueEstimates.filter(estimate => {
    // Per spec R12: Exclude archived estimates
    if (estimate.archived) return false;
    
    const status = (estimate.status || '').toString().toLowerCase().trim();
    
    // Exclude estimates with "Lost" status ONLY when soldOnly=true
    // For "Estimates Sold" reports, exclude "Lost" statuses
    // But for general reports (soldOnly=false), include all estimates (won, lost, pending)
    if (soldOnly && status.includes('lost')) {
      return false;
    }
    
    // Per spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
    let dateToUse = null;
    
    // Priority 1: contract_end
    if (estimate.contract_end) {
      dateToUse = estimate.contract_end;
    }
    // Priority 2: contract_start
    else if (estimate.contract_start) {
      dateToUse = estimate.contract_start;
    }
    // Priority 3: estimate_date
    else if (estimate.estimate_date) {
      dateToUse = estimate.estimate_date;
    }
    // Priority 4: created_date
    else if (estimate.created_date) {
      dateToUse = estimate.created_date;
    }
    
    if (!dateToUse) return false;
    
    // Extract year from date string to avoid timezone conversion issues
    // Use substring to extract first 4 characters (year) - more reliable than regex
    const dateStr = String(dateToUse);
    let estimateYear;
    if (dateStr.length >= 4) {
      estimateYear = parseInt(dateStr.substring(0, 4));
    } else {
      // Fallback: use getYearFromDateString (which has its own Date fallback)
      estimateYear = getYearFromDateString(dateStr);
      if (estimateYear === null) {
        // Last resort: Date parsing if getYearFromDateString fails
        estimateYear = new Date(dateStr).getFullYear();
      }
    }
    
    // Validate year is reasonable (between 2000 and 2100)
    if (isNaN(estimateYear) || estimateYear < 2000 || estimateYear > 2100) {
      return false;
    }
    
    // Year filter: Only include estimates for the specified year
    if (estimateYear !== year) return false;
    
    // If soldOnly is true, only include estimates with won statuses
    if (soldOnly) {
      return true; // All non-lost estimates for this year are considered "sold"
    }
    
    // If soldOnly is false, include all estimates (won, lost, pending) for this year
    return true;
  });
}

