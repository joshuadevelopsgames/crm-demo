/**
 * Report calculation utilities for End of Year Reports
 * Handles win/loss calculations, department breakdowns, and account performance metrics
 */

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
  const decidedEstimates = estimates.filter(e => isWonStatus(e.status) || e.status === 'lost');
  const total = estimates.length;
  const won = estimates.filter(e => isWonStatus(e.status)).length;
  const lost = estimates.filter(e => e.status === 'lost').length;
  const pending = estimates.filter(e => !isWonStatus(e.status) && e.status !== 'lost').length;
  
  // Calculate win rate (won / (won + lost)) - only count decided estimates
  const decidedCount = won + lost;
  const winRate = decidedCount > 0 ? ((won / decidedCount) * 100) : 0;
  
  // Calculate revenue values
  // Use total_price (no tax) to match LMN's behavior - they exclude tax from sales figures
  const totalValue = estimates.reduce((sum, e) => sum + (parseFloat(e.total_price || e.total_price_with_tax) || 0), 0);
  const wonValue = estimates
    .filter(e => isWonStatus(e.status))
    .reduce((sum, e) => sum + (parseFloat(e.total_price || e.total_price_with_tax) || 0), 0);
  const lostValue = estimates
    .filter(e => e.status === 'lost')
    .reduce((sum, e) => sum + (parseFloat(e.total_price || e.total_price_with_tax) || 0), 0);
  const pendingValue = estimates
    .filter(e => !isWonStatus(e.status) && e.status !== 'lost')
    .reduce((sum, e) => sum + (parseFloat(e.total_price || e.total_price_with_tax) || 0), 0);
  
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
    
    // Use total_price (no tax) to match LMN's behavior
    const value = parseFloat(estimate.total_price || estimate.total_price_with_tax) || 0;
    stats.totalValue += value;
    
    if (isWonStatus(estimate.status)) {
      stats.won++;
      stats.wonValue += value;
    } else if (estimate.status === 'lost') {
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
    const division = estimate.division || 'Unknown';
    
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
    
    // Use total_price (no tax) to match LMN's behavior
    const value = parseFloat(estimate.total_price || estimate.total_price_with_tax) || 0;
    stats.totalValue += value;
    
    if (isWonStatus(estimate.status)) {
      stats.won++;
      stats.wonValue += value;
    } else if (estimate.status === 'lost') {
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
 * Check if an estimate status is considered "won" (sold) based on LMN's logic
 * Won statuses: Contract Signed, Work Complete, Billing Complete, Email Contract Award, Verbal Contract Award
 * @param {string} status - Estimate status
 * @returns {boolean} True if status is considered "won"
 */
export function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  const wonStatuses = [
    'contract signed',
    'work complete',
    'billing complete',
    'email contract award',
    'verbal contract award',
    'won' // Also support our simplified 'won' status
  ];
  return wonStatuses.includes(statusLower);
}

/**
 * Filter estimates by year for Salesperson Performance reports
 * 
 * LMN-Compatible Filtering Rules (Validated to 97.9% accuracy):
 * - Uses estimate_close_date only (not estimate_date) to match LMN's "All sales figures based on estimates sold" logic
 * - estimate_close_date = sold_date (estimates that entered a sold state, not necessarily currently "Sold")
 * - Excludes estimates with exclude_stats=true
 * - Excludes archived estimates
 * - Excludes estimates with status containing "Lost" (even if they have a close_date)
 * - Excludes zero/negative prices
 * - Removes duplicates by lmn_estimate_id
 * - Uses total_price (no tax) for dollar amounts (not total_price_with_tax)
 * 
 * Known Limitation: ~2% drift (22 estimates) likely due to revision deduplication.
 * We can't reliably detect superseded revisions yet, so we accept this drift.
 * 
 * @param {Array} estimates - Array of estimate objects
 * @param {number} year - Year to filter by
 * @param {boolean} salesPerformanceMode - If true, only use estimate_close_date (for sales performance). If false, use close_date OR estimate_date (for general reports)
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
    // Exclude estimates marked for exclusion from stats
    if (estimate.exclude_stats) return false;
    
    // Exclude archived estimates
    if (estimate.archived) return false;
    
    // Exclude estimates with zero or negative prices
    // Use total_price (no tax) to match LMN's behavior - they exclude tax from sales figures
    const price = parseFloat(estimate.total_price || estimate.total_price_with_tax || 0);
    if (price <= 0) return false;
    
    // LMN-Compatible Rule: Exclude estimates with "Lost" status
    // Even if they have a close_date, LMN excludes "Lost" statuses from sales performance reports
    const status = (estimate.status || '').toString().toLowerCase().trim();
    if (status.includes('lost')) return false;
    
    // If soldOnly is true, only include estimates with won statuses (matches LMN's "Estimates Sold" logic)
    if (soldOnly && !isWonStatus(estimate.status)) {
      return false;
    }
    
    // Business logic for year filtering:
    let dateToUse = null;
    
    if (salesPerformanceMode) {
      // For Salesperson Performance: Only use estimate_close_date (when estimate was closed/sold)
      // This matches LMN's "All sales figures based on estimates sold" description
      if (estimate.estimate_close_date) {
        dateToUse = estimate.estimate_close_date;
      } else {
        return false; // Must have close_date for sales performance reports
      }
    } else {
      // For general reports: Use close_date if available, otherwise estimate_date
      // 1. If estimate has a close date → use that year (counts in year it closed)
      // 2. Otherwise, use estimate_date → use that year (counts in year it was made)
      if (estimate.estimate_close_date) {
        dateToUse = estimate.estimate_close_date;
      } else if (estimate.estimate_date) {
        dateToUse = estimate.estimate_date;
      }
      // If neither exists, exclude from year-based reports
    }
    
    if (!dateToUse) return false;
    
    // Extract year from date string to avoid timezone conversion issues (LMN dates are UTC)
    // Use substring to extract first 4 characters (year) - more reliable than regex
    const dateStr = String(dateToUse);
    let estimateYear;
    if (dateStr.length >= 4) {
      estimateYear = parseInt(dateStr.substring(0, 4));
    } else {
      // Fallback to Date parsing if string is too short
      estimateYear = new Date(dateStr).getFullYear();
    }
    
    // Validate year is reasonable (between 2000 and 2100)
    if (isNaN(estimateYear) || estimateYear < 2000 || estimateYear > 2100) {
      return false;
    }
    
    return estimateYear === year;
  });
}

