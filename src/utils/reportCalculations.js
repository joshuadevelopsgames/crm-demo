/**
 * Report calculation utilities for End of Year Reports
 * Handles win/loss calculations, department breakdowns, and account performance metrics
 */

import { getYearFromDateString, parseDateString } from './dateFormatter';
import { getSegmentYear, getEstimatePrice } from './revenueSegmentCalculator';
import { checkPriceFieldFallback } from './priceFieldFallbackNotification';

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
  // Use total_price with fallback to total_price_with_tax
  const totalValue = estimates.reduce((sum, e) => {
    checkPriceFieldFallback(e);
    return sum + getEstimatePrice(e);
  }, 0);
  const wonValue = estimates
    .filter(e => isWonStatus(e))
    .reduce((sum, e) => {
      checkPriceFieldFallback(e);
      return sum + (parseFloat(e.total_price || e.total_price_with_tax) || 0);
    }, 0);
  const lostValue = estimates
    .filter(e => (e.status || '').toString().toLowerCase() === 'lost')
    .reduce((sum, e) => {
      checkPriceFieldFallback(e);
      return sum + (parseFloat(e.total_price || e.total_price_with_tax) || 0);
    }, 0);
  const pendingValue = estimates
    .filter(e => !isWonStatus(e) && (e.status || '').toString().toLowerCase() !== 'lost')
    .reduce((sum, e) => {
      checkPriceFieldFallback(e);
      return sum + (parseFloat(e.total_price || e.total_price_with_tax) || 0);
    }, 0);
  
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
    
    // Use total_price with fallback to total_price_with_tax
    checkPriceFieldFallback(estimate);
    const value = getEstimatePrice(estimate);
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
    
    // Use total_price with fallback to total_price_with_tax
    checkPriceFieldFallback(estimate);
    const value = getEstimatePrice(estimate);
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
 * Filter estimates by year (and optionally month) for Salesperson Performance reports
 * 
 * Per spec R2: Year determination uses priority order: contract_end → contract_start → estimate_date → created_date
 * Per spec R10: exclude_stats field is ignored - never used in any system logic
 * Per spec R12: Archived estimates are excluded from reports
 * 
 * @param {Array} estimates - Array of estimate objects
 * @param {number} year - Year to filter by (must be between 2000-2100)
 * @param {boolean} salesPerformanceMode - If true, uses same date priority. If false, uses same date priority (standardized per spec)
 * @param {boolean} soldOnly - If true, only include estimates with won statuses (for "Estimates Sold" calculations)
 * @param {number|null} month - Optional month to filter by (1-12, or null/undefined for all months)
 * @returns {Array} Filtered estimates
 */
export function filterEstimatesByYear(estimates, year, salesPerformanceMode = false, soldOnly = false, month = null) {
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
    
    // Extract year and month from date string using parseDateString for reliable parsing
    const dateStr = String(dateToUse);
    let estimateYear;
    let estimateMonth = null;
    
    // Use parseDateString which handles multiple date formats (YYYY-MM-DD, MM/DD/YYYY, etc.)
    const parsedDate = parseDateString(dateStr);
    
    if (parsedDate) {
      estimateYear = parsedDate.year;
      estimateMonth = parsedDate.month;
    } else {
      // Fallback: try simple substring extraction for year
      if (dateStr.length >= 4) {
        estimateYear = parseInt(dateStr.substring(0, 4));
        // Try to extract month from YYYY-MM-DD format
        if (dateStr.length >= 7) {
          const monthStr = dateStr.substring(5, 7);
          const monthNum = parseInt(monthStr);
          if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            estimateMonth = monthNum;
          }
        }
      } else {
        // Last resort: use getYearFromDateString
        estimateYear = getYearFromDateString(dateStr);
      }
      
      // If still no month, try Date parsing as last resort
      if (estimateMonth === null && estimateYear) {
        try {
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() === estimateYear) {
            estimateMonth = dateObj.getMonth() + 1; // getMonth() returns 0-11
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
    
    // Validate year is reasonable (between 2000 and 2100)
    if (isNaN(estimateYear) || estimateYear < 2000 || estimateYear > 2100) {
      return false;
    }
    
    // Year filter: Only include estimates for the specified year
    if (estimateYear !== year) return false;
    
    // Month filter: If month is specified, only include estimates for that month
    if (month !== null && month !== undefined && estimateMonth !== null) {
      if (estimateMonth !== month) return false;
    }
    
    // If soldOnly is true, only include estimates with won statuses
    if (soldOnly) {
      return true; // All non-lost estimates for this year are considered "sold"
    }
    
    // If soldOnly is false, include all estimates (won, lost, pending) for this year
    return true;
  });
}

/**
 * Calculate interaction statistics per account for a given year
 * @param {Array} interactions - Array of interaction objects
 * @param {number} year - Year to filter by
 * @returns {Map} Map of account_id to interaction stats
 */
export function calculateInteractionStats(interactions, year) {
  const statsMap = new Map();
  
  // Filter interactions by year
  const yearInteractions = interactions.filter(interaction => {
    if (!interaction.interaction_date) return false;
    const interactionYear = new Date(interaction.interaction_date).getFullYear();
    return interactionYear === year;
  });
  
  // Group by account_id
  yearInteractions.forEach(interaction => {
    const accountId = interaction.account_id;
    if (!accountId) return;
    
    if (!statsMap.has(accountId)) {
      statsMap.set(accountId, {
        accountId,
        interactionCount: 0,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        lastInteractionDate: null,
        avgSentimentScore: 0
      });
    }
    
    const stats = statsMap.get(accountId);
    stats.interactionCount++;
    
    // Track sentiment
    const sentiment = (interaction.sentiment || '').toLowerCase();
    if (sentiment === 'positive') {
      stats.positiveCount++;
    } else if (sentiment === 'negative') {
      stats.negativeCount++;
    } else {
      stats.neutralCount++;
    }
    
    // Track latest interaction date
    if (interaction.interaction_date) {
      const interactionDate = new Date(interaction.interaction_date);
      if (!stats.lastInteractionDate || interactionDate > stats.lastInteractionDate) {
        stats.lastInteractionDate = interactionDate;
      }
    }
  });
  
  // Calculate average sentiment score (-1 to 1)
  statsMap.forEach(stats => {
    const total = stats.interactionCount;
    if (total > 0) {
      stats.avgSentimentScore = (stats.positiveCount - stats.negativeCount) / total;
    }
  });
  
  return statsMap;
}

/**
 * Calculate scorecard statistics per account
 * @param {Array} scorecards - Array of scorecard response objects
 * @returns {Map} Map of account_id to scorecard stats
 */
export function calculateScorecardStats(scorecards) {
  const statsMap = new Map();
  
  scorecards.forEach(scorecard => {
    const accountId = scorecard.account_id;
    if (!accountId) return;
    
    // Get latest scorecard for each account (by completed_date or scorecard_date)
    if (!statsMap.has(accountId)) {
      statsMap.set(accountId, {
        accountId,
        latestScore: null,
        normalizedScore: null,
        isPass: null,
        hasScorecard: false,
        latestScorecardDate: null
      });
    }
    
    const stats = statsMap.get(accountId);
    stats.hasScorecard = true;
    
    // Determine which date to use for comparison
    const scorecardDate = scorecard.completed_date 
      ? new Date(scorecard.completed_date)
      : (scorecard.scorecard_date ? new Date(scorecard.scorecard_date) : null);
    
    // Update if this is the latest scorecard
    if (scorecardDate && (!stats.latestScorecardDate || scorecardDate > stats.latestScorecardDate)) {
      stats.latestScorecardDate = scorecardDate;
      stats.latestScore = scorecard.total_score;
      stats.normalizedScore = scorecard.normalized_score;
      stats.isPass = scorecard.is_pass;
    } else if (!stats.latestScorecardDate && scorecard.total_score !== null) {
      // If no date, use first scorecard found
      stats.latestScore = scorecard.total_score;
      stats.normalizedScore = scorecard.normalized_score;
      stats.isPass = scorecard.is_pass;
    }
  });
  
  return statsMap;
}

/**
 * Calculate days since a given date
 * @param {Date|string|null} date - Date to calculate from
 * @returns {number|null} Days since date, or null if date is invalid
 */
export function calculateDaysSince(date) {
  if (!date) return null;
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    const now = new Date();
    const diffTime = now - dateObj;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (error) {
    return null;
  }
}

/**
 * Enhance account stats with additional account data (organization_score, revenue_segment, etc.)
 * @param {Array} accountStats - Array of account statistics from calculateAccountStats
 * @param {Array} accounts - Array of account objects
 * @param {Map} interactionStatsMap - Map from calculateInteractionStats
 * @param {Map} scorecardStatsMap - Map from calculateScorecardStats
 * @param {number} selectedYear - Selected year for segment lookup
 * @returns {Array} Enhanced account statistics
 */
export function enhanceAccountStatsWithMetadata(accountStats, accounts, interactionStatsMap, scorecardStatsMap, selectedYear) {
  const accountLookup = new Map();
  accounts.forEach(acc => {
    accountLookup.set(acc.id, acc);
  });
  
  return accountStats.map(stat => {
    const account = accountLookup.get(stat.accountId);
    const interactionStats = interactionStatsMap.get(stat.accountId);
    const scorecardStats = scorecardStatsMap.get(stat.accountId);
    
    // Get revenue segment for segment year (current year, or previous year if Jan/Feb)
    const segmentYear = getSegmentYear();
    let revenueSegment = account?.revenue_segment || null;
    if (account?.segment_by_year && typeof account.segment_by_year === 'object') {
      revenueSegment = account.segment_by_year[segmentYear.toString()] || revenueSegment;
    }
    
    return {
      ...stat,
      // Account metadata
      organizationScore: account?.organization_score || null,
      revenueSegment: revenueSegment,
      accountType: account?.account_type || null,
      accountStatus: account?.status || null,
      lastInteractionDate: account?.last_interaction_date || null,
      daysSinceLastInteraction: calculateDaysSince(account?.last_interaction_date),
      renewalDate: account?.renewal_date || null,
      tags: account?.tags || [],
      
      // Interaction stats
      interactionCount: interactionStats?.interactionCount || 0,
      avgSentimentScore: interactionStats?.avgSentimentScore || 0,
      lastInteractionDateFromInteractions: interactionStats?.lastInteractionDate || null,
      
      // Scorecard stats
      hasScorecard: scorecardStats?.hasScorecard || false,
      latestScore: scorecardStats?.latestScore || null,
      normalizedScore: scorecardStats?.normalizedScore || null,
      isPass: scorecardStats?.isPass || null,
      latestScorecardDate: scorecardStats?.latestScorecardDate || null
    };
  });
}

/**
 * Calculate department-level metadata (avg organization score, segment distribution, etc.)
 * @param {Array} deptStats - Array of department statistics from calculateDepartmentStats
 * @param {Array} estimates - Array of estimate objects
 * @param {Array} accounts - Array of account objects
 * @param {Map} interactionStatsMap - Map from calculateInteractionStats
 * @param {number} selectedYear - Selected year for segment lookup
 * @returns {Array} Enhanced department statistics
 */
export function enhanceDepartmentStatsWithMetadata(deptStats, estimates, accounts, interactionStatsMap, selectedYear) {
  const accountLookup = new Map();
  accounts.forEach(acc => {
    accountLookup.set(acc.id, acc);
  });
  
  // Get unique account IDs per department
  const deptAccountsMap = new Map();
  deptStats.forEach(dept => {
    const accountIds = new Set();
    dept.estimates.forEach(est => {
      if (est.account_id) {
        accountIds.add(est.account_id);
      }
    });
    deptAccountsMap.set(dept.division, Array.from(accountIds));
  });
  
  return deptStats.map(dept => {
    const accountIds = deptAccountsMap.get(dept.division) || [];
    const deptAccounts = accountIds.map(id => accountLookup.get(id)).filter(Boolean);
    
    // Calculate average organization score
    const scores = deptAccounts
      .map(acc => acc.organization_score)
      .filter(score => score !== null && score !== undefined);
    const avgOrganizationScore = scores.length > 0
      ? scores.reduce((sum, score) => sum + parseFloat(score), 0) / scores.length
      : null;
    
    // Calculate segment distribution
    const segmentCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    // Calculate segment distribution using segment year (current year, or previous year if Jan/Feb)
    const segmentYear = getSegmentYear();
    deptAccounts.forEach(acc => {
      let segment = acc.revenue_segment;
      if (acc.segment_by_year && typeof acc.segment_by_year === 'object') {
        segment = acc.segment_by_year[segmentYear.toString()] || segment;
      }
      if (segment && ['A', 'B', 'C', 'D', 'E', 'F'].includes(segment)) {
        segmentCounts[segment]++;
      }
    });
    
    // Calculate average days since last interaction
    const interactionDays = deptAccounts
      .map(acc => {
        const interactionStats = interactionStatsMap.get(acc.id);
        if (interactionStats?.lastInteractionDate) {
          return calculateDaysSince(interactionStats.lastInteractionDate);
        }
        if (acc.last_interaction_date) {
          return calculateDaysSince(acc.last_interaction_date);
        }
        return null;
      })
      .filter(days => days !== null);
    const avgDaysSinceInteraction = interactionDays.length > 0
      ? interactionDays.reduce((sum, days) => sum + days, 0) / interactionDays.length
      : null;
    
    // Calculate total interactions
    const totalInteractions = accountIds.reduce((sum, accountId) => {
      const interactionStats = interactionStatsMap.get(accountId);
      return sum + (interactionStats?.interactionCount || 0);
    }, 0);
    
    return {
      ...dept,
      avgOrganizationScore: avgOrganizationScore !== null ? parseFloat(avgOrganizationScore.toFixed(1)) : null,
      segmentDistribution: segmentCounts,
      avgDaysSinceInteraction: avgDaysSinceInteraction !== null ? Math.round(avgDaysSinceInteraction) : null,
      totalInteractions
    };
  });
}

