/**
 * Enhanced At-Risk Account Calculator
 * 
 * Calculates at-risk accounts with:
 * - Renewal detection (excludes accounts with newer estimates, same dept + address, > 180 days)
 * - Duplicate estimate detection (flags multiple at-risk estimates with same dept + address)
 * 
 * Logic:
 * - Won estimates expiring <= 180 days = at risk
 * - BUT if there's a newer won estimate (same dept + address) with contract_end > 180 days, NOT at risk (already renewed)
 * - Multiple at-risk estimates with same dept + address = potential bad data (duplicate)
 */

import { startOfDay, differenceInDays } from 'date-fns';
import { isWonStatus } from './reportCalculations';

const DAYS_THRESHOLD = 180;

/**
 * Normalize address for comparison (handles variations)
 */
function normalizeAddress(address) {
  if (!address) return '';
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normalize department for comparison
 */
function normalizeDepartment(division) {
  if (!division) return '';
  return division.trim().toLowerCase();
}

/**
 * Check if account has been renewed (not at risk)
 * Renewal = newer won estimate with same dept + address, contract_end > 180 days
 * @param {Array} accountEstimates - All estimates for the account
 * @param {Object} atRiskEstimate - The at-risk estimate to check against
 * @returns {boolean} True if there's a renewal estimate
 */
function hasRenewalEstimate(accountEstimates, atRiskEstimate) {
  const atRiskDept = normalizeDepartment(atRiskEstimate.division);
  const atRiskAddress = normalizeAddress(atRiskEstimate.address);
  
  if (!atRiskDept || !atRiskAddress) return false;
  
  const today = startOfDay(new Date());
  
  // Find won estimates with same dept + address that expire > 180 days away
  return accountEstimates.some(est => {
    if (!isWonStatus(est) || !est.contract_end) return false;
    
    const estDept = normalizeDepartment(est.division);
    const estAddress = normalizeAddress(est.address);
    
    // Must match department AND address
    if (estDept !== atRiskDept || estAddress !== atRiskAddress) return false;
    
    // Must be newer (later contract_end date)
    const atRiskDate = new Date(atRiskEstimate.contract_end);
    const estDate = new Date(est.contract_end);
    if (estDate <= atRiskDate) return false;
    
    // Must expire > 180 days away
    const estRenewalDate = startOfDay(estDate);
    const daysUntil = differenceInDays(estRenewalDate, today);
    
    return daysUntil > DAYS_THRESHOLD;
  });
}

/**
 * Calculate at-risk accounts with renewal detection and duplicate flagging
 * @param {Array} accounts - All accounts
 * @param {Array} estimates - All estimates
 * @param {Array} snoozes - Notification snoozes (optional, for filtering)
 * @returns {Object} Object with atRiskAccounts array and duplicateEstimates array
 */
export function calculateAtRiskAccounts(accounts, estimates, snoozes = []) {
  const today = startOfDay(new Date());
  const atRiskAccounts = [];
  const duplicateAtRiskEstimates = new Map(); // Track duplicates for bad data detection
  
  // Group estimates by account
  const estimatesByAccount = new Map();
  estimates.forEach(est => {
    if (!est.account_id) return;
    if (!estimatesByAccount.has(est.account_id)) {
      estimatesByAccount.set(est.account_id, []);
    }
    estimatesByAccount.get(est.account_id).push(est);
  });
  
  // Create snooze lookup for fast checking
  const snoozeMap = new Map();
  snoozes.forEach(snooze => {
    if (snooze.notification_type === 'renewal_reminder' && snooze.related_account_id) {
      const key = `${snooze.related_account_id}`;
      const snoozedUntil = new Date(snooze.snoozed_until);
      if (snoozedUntil > today) {
        snoozeMap.set(key, snoozedUntil);
      }
    }
  });
  
  // Process each account
  accounts.forEach(account => {
    // Skip archived accounts
    if (account.archived) return;
    
    // Skip if snoozed
    if (snoozeMap.has(account.id)) return;
    
    const accountEstimates = estimatesByAccount.get(account.id) || [];
    
    // Find all won estimates expiring <= 180 days
    const atRiskEstimates = accountEstimates.filter(est => {
      if (!isWonStatus(est) || !est.contract_end) return false;
      
      try {
        const renewalDate = startOfDay(new Date(est.contract_end));
        if (isNaN(renewalDate.getTime())) return false;
        
        const daysUntil = differenceInDays(renewalDate, today);
        
        // Include estimates expiring within threshold (including past due)
        return daysUntil <= DAYS_THRESHOLD;
      } catch (error) {
        console.error(`Error processing estimate ${est.id} for at-risk check:`, error);
        return false;
      }
    });
    
    if (atRiskEstimates.length === 0) return;
    
    // Check for renewals (newer estimate with same dept + address, > 180 days)
    const validAtRiskEstimates = atRiskEstimates.filter(est => {
      return !hasRenewalEstimate(accountEstimates, est);
    });
    
    if (validAtRiskEstimates.length === 0) return; // All have renewals
    
    // Find soonest expiring estimate
    const soonestEstimate = validAtRiskEstimates.reduce((soonest, est) => {
      const soonestDate = new Date(soonest.contract_end);
      const estDate = new Date(est.contract_end);
      return estDate < soonestDate ? est : soonest;
    });
    
    const renewalDate = startOfDay(new Date(soonestEstimate.contract_end));
    const daysUntil = differenceInDays(renewalDate, today);
    
    // Detect duplicate at-risk estimates (bad data)
    const duplicateKey = `${normalizeDepartment(soonestEstimate.division)}|${normalizeAddress(soonestEstimate.address)}`;
    const duplicateEstimates = validAtRiskEstimates.filter(est => {
      const estKey = `${normalizeDepartment(est.division)}|${normalizeAddress(est.address)}`;
      return estKey === duplicateKey;
    });
    
    const hasDuplicates = duplicateEstimates.length > 1;
    
    if (hasDuplicates) {
      // Multiple at-risk estimates with same dept + address = potential bad data
      if (!duplicateAtRiskEstimates.has(account.id)) {
        duplicateAtRiskEstimates.set(account.id, []);
      }
      duplicateAtRiskEstimates.get(account.id).push({
        account_id: account.id,
        account_name: account.name,
        estimates: duplicateEstimates.map(est => ({
          id: est.id,
          estimate_number: est.estimate_number || est.lmn_estimate_id,
          contract_end: est.contract_end,
          division: est.division,
          address: est.address,
          project_name: est.project_name
        }))
      });
    }
    
    atRiskAccounts.push({
      account_id: account.id,
      account_name: account.name,
      renewal_date: soonestEstimate.contract_end,
      days_until_renewal: daysUntil,
      expiring_estimate_id: soonestEstimate.id,
      expiring_estimate_number: soonestEstimate.estimate_number || soonestEstimate.lmn_estimate_id,
      division: soonestEstimate.division,
      address: soonestEstimate.address,
      has_duplicates: hasDuplicates,
      duplicate_estimates: hasDuplicates ? duplicateEstimates.map(est => ({
        id: est.id,
        estimate_number: est.estimate_number || est.lmn_estimate_id,
        contract_end: est.contract_end
      })) : []
    });
  });
  
  return {
    atRiskAccounts,
    duplicateEstimates: Array.from(duplicateAtRiskEstimates.values()).flat()
  };
}

/**
 * Calculate neglected accounts
 * A/B segments: 30+ days, others: 90+ days, not snoozed, not N/A
 * @param {Array} accounts - All accounts
 * @param {Array} snoozes - Notification snoozes (optional)
 * @returns {Array} Array of neglected account objects
 */
export function calculateNeglectedAccounts(accounts, snoozes = []) {
  const today = startOfDay(new Date());
  const neglectedAccounts = [];
  
  // Create snooze lookup
  const snoozeMap = new Map();
  snoozes.forEach(snooze => {
    if (snooze.notification_type === 'neglected_account' && snooze.related_account_id) {
      const key = `${snooze.related_account_id}`;
      const snoozedUntil = new Date(snooze.snoozed_until);
      if (snoozedUntil > today) {
        snoozeMap.set(key, snoozedUntil);
      }
    }
  });
  
  accounts.forEach(account => {
    // Skip archived accounts
    if (account.archived) return false;
    
    // Skip accounts with ICP status = 'na' (permanently excluded)
    if (account.icp_status === 'na') return;
    
    // Skip if snoozed
    if (snoozeMap.has(account.id)) return;
    
    // Determine threshold based on revenue segment
    // A and B segments: 30+ days, others: 90+ days
    // Default to 'C' (90 days) if segment is missing
    const segment = account.revenue_segment || 'C';
    const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
    
    // Check if no interaction beyond threshold
    if (!account.last_interaction_date) {
      neglectedAccounts.push({
        account_id: account.id,
        account_name: account.name,
        days_since_interaction: null,
        threshold_days: thresholdDays,
        revenue_segment: segment
      });
      return;
    }
    
    const lastInteractionDate = startOfDay(new Date(account.last_interaction_date));
    const daysSince = differenceInDays(today, lastInteractionDate);
    
    if (daysSince > thresholdDays) {
      neglectedAccounts.push({
        account_id: account.id,
        account_name: account.name,
        days_since_interaction: daysSince,
        threshold_days: thresholdDays,
        revenue_segment: segment
      });
    }
  });
  
  return neglectedAccounts;
}

