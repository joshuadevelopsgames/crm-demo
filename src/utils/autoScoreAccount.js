/**
 * Automatically score an account based on the primary scorecard template
 * Maps account data to scorecard questions and calculates the score
 */

import { findMappingRule, applyMappingRule } from './scorecardMappings';
import { getCurrentYear } from '@/contexts/TestModeContext';

/**
 * Auto-score an account using the primary scorecard template
 * @param {Object} account - The account to score
 * @param {Array} estimates - All estimates (filtered by account_id)
 * @param {Array} jobsites - All jobsites (filtered by account_id)
 * @param {Object} template - The primary scorecard template
 * @returns {Object} Scorecard response data
 */
export function autoScoreAccount(account, estimates, jobsites, template) {
  if (!template || !template.questions || template.questions.length === 0) {
    return null;
  }

  // Calculate derived values from account data
  // Use current year revenue with contract-year allocation (same logic as revenueSegmentCalculator)
  // Helper to get current year (respects test mode)
  function getCurrentYearForCalculation() {
    try {
      return getCurrentYear();
    } catch (error) {
      // Fallback if context not initialized yet
      if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
        return window.__testModeGetCurrentYear();
      }
      return new Date().getFullYear();
    }
  }
  const currentYear = getCurrentYearForCalculation();
  const calculateDurationMonths = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    const dayDiff = end.getDate() - start.getDate();
    let totalMonths = yearDiff * 12 + monthDiff;
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
    const totalPrice = parseFloat(estimate.total_price_with_tax) || 0;
    if (totalPrice === 0) return null;
    if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
      const startYear = contractStart.getFullYear();
      const durationMonths = calculateDurationMonths(contractStart, contractEnd);
      if (durationMonths <= 0) return null;
      const yearsCount = getContractYears(durationMonths);
      const yearsApplied = [];
      for (let i = 0; i < yearsCount; i++) {
        yearsApplied.push(startYear + i);
      }
      const appliesToCurrentYear = yearsApplied.includes(currentYear);
      const annualAmount = totalPrice / yearsCount;
      return {
        appliesToCurrentYear,
        value: appliesToCurrentYear ? annualAmount : 0
      };
    }
    if (contractStart && !isNaN(contractStart.getTime())) {
      const startYear = contractStart.getFullYear();
      return {
        appliesToCurrentYear: currentYear === startYear,
        value: totalPrice
      };
    }
    if (estimateDate && !isNaN(estimateDate.getTime())) {
      const estimateYear = estimateDate.getFullYear();
      return {
        appliesToCurrentYear: currentYear === estimateYear,
        value: totalPrice
      };
    }
    return null;
  };
  const totalRevenue = estimates
    .filter(est => est.status === 'won')
    .reduce((sum, est) => {
      const yearData = getEstimateYearData(est, currentYear);
      if (!yearData || !yearData.appliesToCurrentYear) return sum;
      return sum + (isNaN(yearData.value) ? 0 : yearData.value);
    }, 0);
  
  const totalEstimates = estimates.length;
  const wonEstimates = estimates.filter(est => est.status === 'won').length;
  const lostEstimates = estimates.filter(est => est.status === 'lost').length;
  const jobsitesCount = jobsites.length;

  // Map account data to scorecard questions using mapping rules
  const responses = template.questions.map((question) => {
    // Try to find a mapping rule for this question
    const rule = findMappingRule(question);
    
    let answer = 0;
    let answerText = 'N/A';
    
    if (rule) {
      // Apply the mapping rule
      const result = applyMappingRule(rule, account, estimates, jobsites);
      answer = result.answer;
      answerText = result.answerText;
    } else {
      // No mapping rule found - use default behavior
      // You can add fallback logic here or log unmapped questions
      console.warn(`⚠️ No mapping rule found for question: "${question.question_text}"`);
      answer = 0;
      answerText = 'N/A';
    }

    // Legacy mapping code (kept for reference, but now using mapping rules)
    // This section can be removed once all questions are mapped via rules
    const questionText = question.question_text.toLowerCase();
    if (false) { // Disabled - using mapping rules instead
    if (questionText.includes('client operations region') || questionText.includes('operations region')) {
      // Check if account is in service area (Calgary & Surrounding)
      const city = (account.city || '').toLowerCase();
      const state = (account.state || '').toLowerCase();
      const address = (account.address_1 || '').toLowerCase();
      
      if (city.includes('calgary') || state.includes('ab') || state.includes('alberta') || 
          address.includes('calgary')) {
        answer = 2; // Calgary/Surrounding
        answerText = 'Calgary/Surrounding';
      } else {
        answer = 0;
        answerText = 'Other';
      }
    } else if (questionText.includes('can someone introduce us') || questionText.includes('introduction')) {
      // Check if there's a contact with relationship info
      answer = 0; // Default to No
      answerText = 'No';
    } else if (questionText.includes('has corporate events') || questionText.includes('corporate events')) {
      // Check account tags or notes for events
      const tags = (account.tags || []).join(' ').toLowerCase();
      const notes = (account.notes || '').toLowerCase();
      if (tags.includes('event') || notes.includes('event')) {
        answer = 1;
        answerText = 'Yes';
      } else {
        answer = 0;
        answerText = 'No';
      }
    } else if (questionText.includes('inside our bubble') || questionText.includes('bubble')) {
      // Check if account is in target market
      answer = 0; // Default to No
      answerText = 'No';
    } else if (questionText.includes('located in service area') || 
               questionText.includes('calgary & surrounding') ||
               questionText.includes('service area')) {
      // Check if account is in service area
      const city = (account.city || '').toLowerCase();
      const state = (account.state || '').toLowerCase();
      const address = (account.address_1 || '').toLowerCase();
      
      if (city.includes('calgary') || state.includes('ab') || state.includes('alberta') || 
          address.includes('calgary')) {
        answer = 1; // Yes
        answerText = 'Yes';
      } else {
        answer = 0; // No
        answerText = 'No';
      }
    } else if (questionText.includes('annual budget') || questionText.includes('budget')) {
      // Check if annual revenue is under $200K
      if (totalRevenue > 0 && totalRevenue < 200000) {
        answer = 1; // Yes
        answerText = 'Yes';
      } else {
        answer = 0; // No
        answerText = 'No';
      }
    } else if (questionText.includes('multiple properties') || questionText.includes('multiple properties')) {
      // Check if account has multiple jobsites
      if (jobsitesCount > 1) {
        answer = 1; // Yes
        answerText = 'Yes';
      } else {
        answer = 0; // No
        answerText = 'No';
      }
    } else if (questionText.includes('sites between 2-24 acres') || questionText.includes('2-24 acres')) {
      // Check jobsite sizes (if available)
      const hasValidSize = jobsites.some(j => {
        // This would need jobsite size data - defaulting based on jobsite count
        return true; // Assume valid if has jobsites
      });
      if (hasValidSize && jobsitesCount > 0) {
        answer = 1; // Yes
        answerText = 'Yes';
      } else {
        answer = 0; // No
        answerText = 'No';
      }
    } else if (questionText.includes('close to existing properties') || questionText.includes('close to existing')) {
      // Check if jobsites are near existing properties (would need location data)
      answer = 0; // Default to No
      answerText = 'No';
    } else if (questionText.includes('summer maintenance')) {
      // Check if account has summer maintenance estimates/jobsites
      const hasSummer = estimates.some(est => {
        const projectName = (est.project_name || '').toLowerCase();
        return projectName.includes('summer') || projectName.includes('maintenance');
      });
      if (hasSummer) {
        answer = 1; // Yes
        answerText = 'Yes';
      } else {
        answer = 0; // No
        answerText = 'No';
      }
    } else if (questionText.includes('winter maintenance') || questionText.includes('winter')) {
      // Check if account has winter maintenance estimates/jobsites
      const hasWinter = estimates.some(est => {
        const projectName = (est.project_name || '').toLowerCase();
        return projectName.includes('winter') || projectName.includes('snow');
      });
      if (hasWinter) {
        answer = 1; // Yes
        answerText = 'Yes';
      } else {
        answer = 0; // No
        answerText = 'No';
      }
    } else if (questionText.includes('3-year snow contract') || questionText.includes('3 year')) {
      // Check for long-term contracts
      answer = 0; // Default to No
      answerText = 'No';
    } else if (questionText.includes('uses summer landscape maintenance') || questionText.includes('summer landscape')) {
      // Check for summer maintenance
      const hasSummer = estimates.some(est => {
        const projectName = (est.project_name || '').toLowerCase();
        return projectName.includes('summer') || projectName.includes('landscape');
      });
      if (hasSummer) {
        answer = 1; // Yes
        answerText = 'Yes';
      } else {
        answer = 0; // No
        answerText = 'No';
      }
    } else if (questionText.includes('decision maker identified') || questionText.includes('decision maker')) {
      // Check if account has contacts with decision maker role
      answer = 0; // Default to No (would need contact data)
      answerText = 'No';
    } else if (questionText.includes('relationship opportunity') || questionText.includes('relationship')) {
      // Check for relationship indicators
      answer = 0; // Default to No
      answerText = 'No';
    } else if (questionText.includes('procurement via rfp') || questionText.includes('rfp')) {
      // Check for RFP indicators
      answer = 0; // Default to No
      answerText = 'No';
    } else if (questionText.includes('building quality')) {
      // Would need property data
      answer = 1; // Default to Good
      answerText = 'Good';
    } else if (questionText.includes('aesthetics')) {
      // Would need property data
      answer = 1; // Default to Good
      answerText = 'Good';
    } else if (questionText.includes('buildings and properties size') || questionText.includes('properties size')) {
      // Check jobsite count
      if (jobsitesCount >= 2) {
        answer = 5; // Large
        answerText = 'Large';
      } else if (jobsitesCount === 1) {
        answer = 3; // Medium
        answerText = 'Medium';
      } else {
        answer = 1; // Small
        answerText = 'Small';
      }
    } else if (questionText.includes('exceeds 15% of revenue')) {
      // Check if account revenue exceeds threshold
      answer = 0; // Default to No
      answerText = 'No';
    } else if (questionText.includes('industry')) {
      // Map account industry/type
      const accountType = (account.account_type || '').toLowerCase();
      if (accountType.includes('retail') || accountType.includes('industrial')) {
        answer = 4; // Retail, Industrial
        answerText = 'Retail, Industrial';
      } else {
        answer = 0;
        answerText = 'Other';
      }
    } else {
      // Default: unanswered question gets 0
      answer = 0;
      answerText = 'N/A';
    }
    } // End of legacy mapping code (disabled)

    // Calculate weighted score
    const weightedScore = answer * question.weight;

    return {
      question_text: question.question_text,
      answer: answer,
      answer_text: answerText,
      weight: question.weight,
      weighted_score: weightedScore,
      section: question.section || 'Other'
    };
  });

  // Calculate section sub-totals
  const sectionScores = {};
  responses.forEach(response => {
    const section = response.section;
    if (!sectionScores[section]) {
      sectionScores[section] = 0;
    }
    sectionScores[section] += response.weighted_score;
  });

  // Calculate total score
  const totalScore = responses.reduce((sum, r) => sum + r.weighted_score, 0);
  const normalizedScore = Math.round((totalScore / template.total_possible_score) * 100);
  const passThreshold = template.pass_threshold || 70;
  const isPass = normalizedScore >= passThreshold;

  return {
    total_score: totalScore,
    normalized_score: normalizedScore,
    responses: responses,
    section_scores: sectionScores,
    is_pass: isPass
  };
}

