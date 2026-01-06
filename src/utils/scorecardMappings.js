/**
 * Scorecard Data Mapping Configuration
 * 
 * This file defines how to map account data to scorecard questions.
 * To add mappings for new scorecards, add entries to the mappingRules array.
 * 
 * Each rule can match questions by:
 * - question_text (exact or partial match)
 * - question_keywords (array of keywords that must appear in question text)
 * - data_field (which account/estimate/jobsite field to check)
 * - mapping_function (custom function to calculate the answer)
 */

import { isWonStatus } from './reportCalculations';
import { getYearFromDateString } from './dateFormatter';

/**
 * Mapping rules for automatically scoring accounts
 * Add new rules here for future scorecards
 */
export const mappingRules = [
  // Location/Service Area Mappings
  {
    question_keywords: ['client operations region', 'operations region'],
    data_field: 'location',
    mapping_function: (account) => {
      const city = (account.city || '').toLowerCase();
      const state = (account.state || '').toLowerCase();
      const address = (account.address_1 || '').toLowerCase();
      
      if (city.includes('calgary') || state.includes('ab') || state.includes('alberta') || 
          address.includes('calgary')) {
        return { answer: 2, answerText: 'Calgary/Surrounding' };
      }
      return { answer: 0, answerText: 'Other' };
    }
  },
  {
    question_keywords: ['located in service area', 'calgary & surrounding', 'service area'],
    data_field: 'location',
    mapping_function: (account) => {
      const city = (account.city || '').toLowerCase();
      const state = (account.state || '').toLowerCase();
      const address = (account.address_1 || '').toLowerCase();
      
      if (city.includes('calgary') || state.includes('ab') || state.includes('alberta') || 
          address.includes('calgary')) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  
  // Revenue/Budget Mappings
  {
    question_keywords: ['annual budget', 'budget'],
    data_field: 'revenue',
    mapping_function: (account, estimates) => {
      // Use contract-year allocation logic for current year revenue
      // Helper to get current year (respects year selector) - REQUIRED, no fallback
      // Per user requirement: Never fall back to current year, only ever go by selected year
      function getCurrentYearForCalculation() {
        // Use window function if available (set by TestModeProvider)
        if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
          return window.__testModeGetCurrentYear();
        }
        // Fallback to YearSelectorContext
        if (typeof window !== 'undefined' && window.__getCurrentYear) {
          return window.__getCurrentYear();
        }
        // No fallback - selected year is required
        throw new Error('scorecardMappings.getCurrentYearForCalculation: YearSelectorContext not initialized. Selected year is required.');
      }
      const currentYear = getCurrentYearForCalculation();
      
      // Import the helper functions from revenueSegmentCalculator
      // For now, we'll calculate inline to avoid circular dependencies
      const calculateDurationMonths = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const yearDiff = end.getFullYear() - start.getFullYear();
        const monthDiff = end.getMonth() - start.getMonth();
        const dayDiff = end.getDate() - start.getDate();
        let totalMonths = yearDiff * 12 + monthDiff;
        // Only add 1 month if end day is AFTER start day (not same day)
        // This prevents exact 12-month contracts from being counted as 13 months
        if (dayDiff > 0) {
          totalMonths += 1;
        }
        return totalMonths;
      };
      
      const getContractYears = (durationMonths) => {
        if (durationMonths <= 12) return 1;
        if (durationMonths <= 24) return 2;
        if (durationMonths <= 36) return 3;
        if (durationMonths % 12 === 0) {
          return durationMonths / 12;
        }
        return Math.ceil(durationMonths / 12);
      };
      
      const getEstimateYearData = (estimate, currentYear) => {
        const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
        const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
        const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
        
        // Use total_price_with_tax consistently
        const totalPrice = parseFloat(estimate.total_price_with_tax) || 0;
        if (totalPrice === 0) return null;
        
        // Case 1: Both contract_start and contract_end exist
        if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
          const startYear = getYearFromDateString(estimate.contract_start);
          if (startYear === null) return null;
          
          const durationMonths = calculateDurationMonths(contractStart, contractEnd);
          if (durationMonths <= 0) return null;
          
          const yearsCount = getContractYears(durationMonths);
          const yearsApplied = [];
          for (let i = 0; i < yearsCount; i++) {
            yearsApplied.push(startYear + i);
          }
          
          const appliesToCurrentYear = yearsApplied.includes(currentYear);
          const annualAmount = totalPrice / yearsCount;
          
          return appliesToCurrentYear ? annualAmount : 0;
        }
        
        // Case 2: Only contract_start exists
        if (contractStart && !isNaN(contractStart.getTime())) {
          const startYear = getYearFromDateString(estimate.contract_start);
          if (startYear === null) return null;
          return currentYear === startYear ? totalPrice : 0;
        }
        
        // Case 3: No contract dates, use estimate_date
        if (estimate.estimate_date) {
          const estimateYear = getYearFromDateString(estimate.estimate_date);
          if (estimateYear === null) return null;
          return currentYear === estimateYear ? totalPrice : 0;
        }
        
        return null;
      };
      
      // Per Estimates spec R1, R11: Use isWonStatus to respect pipeline_status priority
      const totalRevenue = estimates
        .filter(est => isWonStatus(est))
        .reduce((sum, est) => {
          const yearData = getEstimateYearData(est, currentYear);
          return sum + (yearData !== null ? yearData : 0);
        }, 0);
      
      // Check if under $200K (common threshold)
      if (totalRevenue > 0 && totalRevenue < 200000) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['exceeds 15% of revenue'],
    data_field: 'revenue',
    mapping_function: (account, estimates) => {
      // This would need business logic to determine if account exceeds threshold
      return { answer: 0, answerText: 'No' };
    }
  },
  
  // Property/Jobsite Mappings
  {
    question_keywords: ['multiple properties', 'multiple properties'],
    data_field: 'jobsites',
    mapping_function: (account, estimates, jobsites) => {
      if (jobsites.length > 1) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['sites between 2-24 acres', '2-24 acres'],
    data_field: 'jobsites',
    mapping_function: (account, estimates, jobsites) => {
      // Would need jobsite size data - defaulting based on jobsite count
      const hasValidSize = jobsites.length > 0;
      if (hasValidSize) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['buildings and properties size', 'properties size'],
    data_field: 'jobsites',
    mapping_function: (account, estimates, jobsites) => {
      if (jobsites.length >= 2) {
        return { answer: 5, answerText: 'Large' };
      } else if (jobsites.length === 1) {
        return { answer: 3, answerText: 'Medium' };
      }
      return { answer: 1, answerText: 'Small' };
    }
  },
  {
    question_keywords: ['close to existing properties', 'close to existing'],
    data_field: 'jobsites',
    mapping_function: (account, estimates, jobsites) => {
      // Would need location data to determine proximity
      return { answer: 0, answerText: 'No' };
    }
  },
  
  // Maintenance/Service Mappings
  {
    question_keywords: ['summer maintenance'],
    data_field: 'estimates',
    mapping_function: (account, estimates, jobsites) => {
      const hasSummer = estimates.some(est => {
        const projectName = (est.project_name || '').toLowerCase();
        return projectName.includes('summer') || projectName.includes('maintenance');
      });
      if (hasSummer) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['winter maintenance', 'winter'],
    data_field: 'estimates',
    mapping_function: (account, estimates, jobsites) => {
      const hasWinter = estimates.some(est => {
        const projectName = (est.project_name || '').toLowerCase();
        return projectName.includes('winter') || projectName.includes('snow');
      });
      if (hasWinter) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['uses summer landscape maintenance', 'summer landscape'],
    data_field: 'estimates',
    mapping_function: (account, estimates, jobsites) => {
      const hasSummer = estimates.some(est => {
        const projectName = (est.project_name || '').toLowerCase();
        return projectName.includes('summer') || projectName.includes('landscape');
      });
      if (hasSummer) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['3-year snow contract', '3 year'],
    data_field: 'estimates',
    mapping_function: (account, estimates, jobsites) => {
      // Would need contract data
      return { answer: 0, answerText: 'No' };
    }
  },
  
  // Account Attributes Mappings
  {
    question_keywords: ['has corporate events', 'corporate events'],
    data_field: 'account',
    mapping_function: (account) => {
      const tags = Array.isArray(account.tags) 
        ? account.tags.join(' ').toLowerCase()
        : (account.tags || '').toLowerCase();
      const notes = (account.notes || '').toLowerCase();
      
      if (tags.includes('event') || notes.includes('event')) {
        return { answer: 1, answerText: 'Yes' };
      }
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['industry'],
    data_field: 'account',
    mapping_function: (account) => {
      const accountType = (account.account_type || '').toLowerCase();
      if (accountType.includes('retail') || accountType.includes('industrial')) {
        return { answer: 4, answerText: 'Retail, Industrial' };
      }
      return { answer: 0, answerText: 'Other' };
    }
  },
  {
    question_keywords: ['building quality'],
    data_field: 'account',
    mapping_function: (account) => {
      // Would need property data
      return { answer: 1, answerText: 'Good' };
    }
  },
  {
    question_keywords: ['aesthetics'],
    data_field: 'account',
    mapping_function: (account) => {
      // Would need property data
      return { answer: 1, answerText: 'Good' };
    }
  },
  
  // Relationship/Contact Mappings
  {
    question_keywords: ['can someone introduce us', 'introduction'],
    data_field: 'contacts',
    mapping_function: (account) => {
      // Would need contact relationship data
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['decision maker identified', 'decision maker'],
    data_field: 'contacts',
    mapping_function: (account) => {
      // Would need contact role data
      return { answer: 0, answerText: 'No' };
    }
  },
  {
    question_keywords: ['relationship opportunity', 'relationship'],
    data_field: 'account',
    mapping_function: (account) => {
      return { answer: 0, answerText: 'No' };
    }
  },
  
  // Procurement Mappings
  {
    question_keywords: ['procurement via rfp', 'rfp'],
    data_field: 'account',
    mapping_function: (account) => {
      // Would need procurement data
      return { answer: 0, answerText: 'No' };
    }
  },
  
  // Default/Unknown Mappings
  {
    question_keywords: ['inside our bubble', 'bubble'],
    data_field: 'account',
    mapping_function: (account) => {
      return { answer: 0, answerText: 'No' };
    }
  }
];

/**
 * Find the best matching rule for a question
 * @param {Object} question - The scorecard question
 * @returns {Object|null} - The matching rule or null
 */
export function findMappingRule(question) {
  const questionText = (question.question_text || '').toLowerCase();
  
  // Try to find a rule that matches
  for (const rule of mappingRules) {
    // Check if question text matches any keywords
    if (rule.question_keywords) {
      const matches = rule.question_keywords.some(keyword => 
        questionText.includes(keyword.toLowerCase())
      );
      if (matches) {
        return rule;
      }
    }
    
    // Check exact question text match
    if (rule.question_text && questionText === rule.question_text.toLowerCase()) {
      return rule;
    }
  }
  
  return null;
}

/**
 * Apply a mapping rule to get an answer for a question
 * @param {Object} rule - The mapping rule
 * @param {Object} account - The account data
 * @param {Array} estimates - Account estimates
 * @param {Array} jobsites - Account jobsites
 * @returns {Object} - { answer: number, answerText: string }
 */
export function applyMappingRule(rule, account, estimates, jobsites) {
  if (!rule.mapping_function) {
    return { answer: 0, answerText: 'N/A' };
  }
  
  try {
    return rule.mapping_function(account, estimates, jobsites);
  } catch (error) {
    console.error(`Error applying mapping rule for ${rule.question_keywords?.[0] || 'unknown'}:`, error);
    return { answer: 0, answerText: 'N/A' };
  }
}

