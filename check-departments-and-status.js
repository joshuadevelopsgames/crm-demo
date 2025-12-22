/**
 * Check for uncategorized departments and win/loss edge cases
 * 
 * This script analyzes the codebase to find:
 * 1. Any division values that might not be properly categorized
 * 2. Any status values that might not be handled by the win/loss algorithm
 */

// Exact division categories from Google Sheet (matching EstimatesTab.jsx)
const DIVISION_CATEGORIES = [
  'LE Irrigation',
  'LE Landscapes',
  'LE Maintenance (Summer/Winter)',
  'LE Maintenance Enchancements',
  'LE Paving',
  'LE Tree Care',
  'Line Painting',
  'Parking Lot Sweeping',
  'Snow',
  'Warranty'
];

// Known statuses from the updated algorithm
const KNOWN_WON_STATUSES = [
  'email contract award',
  'verbal contract award',
  'work complete',
  'work in progress',
  'billing complete',
  'contract signed',
  'sold'
];

const KNOWN_LOST_STATUSES = [
  'estimate in progress - lost',
  'review + approve - lost',
  'client proposal phase - lost',
  'estimate lost',
  'estimate on hold',
  'estimate lost - no reply',
  'estimate lost - price too high',
  'lost'
];

// Match division value to exact categories, or return "Uncategorized"
function normalizeDepartment(division) {
  if (!division) return 'Uncategorized';
  
  const trimmed = division.trim();
  
  // Handle empty/null-like values - map to Uncategorized
  if (trimmed === '' || 
      trimmed.toLowerCase() === '<unassigned>' || 
      trimmed.toLowerCase() === 'unassigned' ||
      trimmed.toLowerCase() === '[unassigned]' ||
      trimmed.toLowerCase() === 'null' ||
      trimmed.toLowerCase() === 'undefined' ||
      trimmed.toLowerCase() === 'n/a' ||
      trimmed.toLowerCase() === 'na') {
    return 'Uncategorized';
  }
  
  // Check if the trimmed value exactly matches one of the known categories (case-insensitive)
  const matchedCategory = DIVISION_CATEGORIES.find(
    category => category.toLowerCase() === trimmed.toLowerCase()
  );
  
  if (matchedCategory) {
    // Return the exact category from the list (preserves exact casing)
    return matchedCategory;
  }
  
  // If no match found, return "Uncategorized"
  return 'Uncategorized';
}

// Test mapStatus function
function mapStatus(status, pipelineStatus) {
  const pipeline = (pipelineStatus || '').toLowerCase();
  if (pipeline === 'sold') return 'won';
  if (pipeline === 'lost') return 'lost';
  if (pipeline === 'pending') return 'lost';
  
  const stat = (status || '').toLowerCase().trim();
  
  // Explicit Won statuses
  if (
    stat === 'email contract award' ||
    stat === 'verbal contract award' ||
    stat === 'work complete' ||
    stat === 'work in progress' ||
    stat === 'billing complete' ||
    stat === 'contract signed' ||
    stat.includes('email contract award') ||
    stat.includes('verbal contract award') ||
    stat.includes('work complete') ||
    stat.includes('billing complete') ||
    stat.includes('contract signed')
  ) {
    return 'won';
  }
  
  // Explicit Lost statuses
  if (
    stat === 'estimate in progress - lost' ||
    stat === 'review + approve - lost' ||
    stat === 'client proposal phase - lost' ||
    stat === 'estimate lost' ||
    stat === 'estimate on hold' ||
    stat === 'estimate lost - no reply' ||
    stat === 'estimate lost - price too high' ||
    stat.includes('estimate in progress - lost') ||
    stat.includes('review + approve - lost') ||
    stat.includes('client proposal phase - lost') ||
    stat.includes('estimate lost - no reply') ||
    stat.includes('estimate lost - price too high') ||
    stat.includes('estimate on hold')
  ) {
    return 'lost';
  }
  
  // Pattern-based Won statuses
  if (
    stat.includes('contract signed') ||
    stat.includes('contract award') ||
    stat.includes('sold') ||
    stat.includes('email contract') ||
    stat.includes('verbal contract') ||
    stat.includes('work complete') ||
    stat.includes('billing complete')
  ) {
    return 'won';
  }
  
  // Pattern-based Lost statuses
  if (
    stat.includes('estimate lost') ||
    stat.includes('lost') ||
    stat.includes('on hold')
  ) {
    return 'lost';
  }
  
  // Pending/In Progress/Empty defaults to lost
  if (
    stat.includes('in progress') ||
    stat.includes('pending') ||
    stat === ''
  ) {
    return 'lost';
  }
  
  return 'lost';
}

// Test cases for departments
const departmentTestCases = [
  // Valid departments
  'Snow and Ice Maintenance',
  'Landscape Maintenance',
  'Paving and concrete',
  'Landscape Construction',
  'Tree Care',
  'Irrigation',
  // Variations
  'snow and ice maintenance',
  'SNOW AND ICE MAINTENANCE',
  'Landscape Maintenance Services',
  'Tree Care Services',
  // Unassigned variations
  '<unassigned>',
  'unassigned',
  'Unassigned',
  '<Unassigned>',
  'null',
  'undefined',
  'n/a',
  'N/A',
  'na',
  '',
  '   ',
  // Potential uncategorized
  'Snow Removal',
  'Ice Management',
  'Lawn Care',
  'Groundskeeping',
  'Hardscaping',
  'Softscaping',
  'Arborist Services',
  'Sprinkler Systems',
  'Maintenance',
  'Construction',
  'Other',
  'Misc',
  'General',
  'Unknown',
  'TBD',
  'To Be Determined'
];

// Test cases for statuses
const statusTestCases = [
  // Known won
  'Email Contract Award',
  'Verbal Contract Award',
  'Work Complete',
  'Work In Progress',
  'Billing Complete',
  'Contract Signed',
  // Known lost
  'Estimate In Progress - Lost',
  'Review + Approve - Lost',
  'Client Proposal Phase - Lost',
  'Estimate Lost',
  'Estimate On Hold',
  'Estimate Lost - No Reply',
  'Estimate Lost - Price too high',
  // Potential edge cases
  'Contract Signed - Pending',
  'Work In Progress - On Hold',
  'Billing In Progress',
  'Work Started',
  'Work Completed',
  'Contract Awarded',
  'Proposal Accepted',
  'Quote Accepted',
  'Estimate Accepted',
  'Estimate Rejected',
  'Estimate Cancelled',
  'Estimate Withdrawn',
  'Estimate Expired',
  'No Response',
  'Client Declined',
  'Price Too High',
  'Competitor Won',
  'Project Cancelled',
  'On Hold',
  'Pending Review',
  'Under Review',
  'Awaiting Approval',
  'Approved',
  'Rejected',
  'Cancelled',
  'Deferred',
  'Postponed',
  'Quoted',
  'Proposed',
  'Negotiating',
  'In Negotiation',
  'Draft',
  'Final',
  'Completed',
  'Active',
  'Closed',
  ''
];

console.log('\n🔍 CHECKING FOR UNCATEGORIZED DEPARTMENTS AND WIN/LOSS EDGE CASES\n');
console.log('='.repeat(80));

// Test departments
console.log('\n📊 DEPARTMENT CATEGORIZATION TEST:\n');
console.log('-'.repeat(80));

const uncategorizedDepartments = [];
const categorizedDepartments = [];

departmentTestCases.forEach(dept => {
  const result = normalizeDepartment(dept);
  if (result === 'Uncategorized') {
    uncategorizedDepartments.push(dept);
    console.log(`❌ "${dept}" → Uncategorized`);
  } else {
    categorizedDepartments.push({ original: dept, normalized: result });
    if (DIVISION_CATEGORIES.includes(result)) {
      console.log(`✅ "${dept}" → ${result}`);
    } else {
      console.log(`⚠️  "${dept}" → ${result} (not in DIVISION_CATEGORIES list)`);
    }
  }
});

console.log(`\n📈 Summary:`);
console.log(`   Categorized: ${categorizedDepartments.length}`);
console.log(`   Uncategorized: ${uncategorizedDepartments.length}`);

if (uncategorizedDepartments.length > 0) {
  console.log(`\n⚠️  Potential uncategorized departments found:`);
  uncategorizedDepartments.forEach(dept => {
    console.log(`   - "${dept}"`);
  });
  console.log(`\n💡 These will all be grouped under "Uncategorized" which is correct.`);
}

// Test statuses
console.log(`\n\n📊 WIN/LOSS STATUS TEST:\n`);
console.log('-'.repeat(80));

const wonStatuses = [];
const lostStatuses = [];
const edgeCases = [];

statusTestCases.forEach(status => {
  const result = mapStatus(status, '');
  const statusLower = status.toLowerCase().trim();
  
  if (result === 'won') {
    wonStatuses.push(status);
    const isKnown = KNOWN_WON_STATUSES.some(known => 
      statusLower === known || statusLower.includes(known) || known.includes(statusLower)
    );
    if (isKnown) {
      console.log(`✅ "${status}" → won (known)`);
    } else {
      console.log(`⚠️  "${status}" → won (pattern match, not explicitly listed)`);
      edgeCases.push({ status, result, type: 'won-pattern' });
    }
  } else {
    lostStatuses.push(status);
    const isKnown = KNOWN_LOST_STATUSES.some(known => 
      statusLower === known || statusLower.includes(known) || known.includes(statusLower)
    );
    if (isKnown) {
      console.log(`✅ "${status}" → lost (known)`);
    } else {
      console.log(`⚠️  "${status}" → lost (pattern match or default)`);
      if (!statusLower.includes('lost') && 
          !statusLower.includes('on hold') && 
          !statusLower.includes('in progress') &&
          !statusLower.includes('pending') &&
          statusLower !== '') {
        edgeCases.push({ status, result, type: 'lost-pattern' });
      }
    }
  }
});

console.log(`\n📈 Summary:`);
console.log(`   Won: ${wonStatuses.length}`);
console.log(`   Lost: ${lostStatuses.length}`);
console.log(`   Edge Cases: ${edgeCases.length}`);

if (edgeCases.length > 0) {
  console.log(`\n⚠️  Potential edge cases found:`);
  edgeCases.forEach(ec => {
    console.log(`   - "${ec.status}" → ${ec.result} (${ec.type})`);
  });
  console.log(`\n💡 Consider adding explicit handling for these statuses if they appear frequently.`);
}

// Check for potential issues
console.log(`\n\n🔍 POTENTIAL ISSUES:\n`);
console.log('-'.repeat(80));

const issues = [];

// Check if "Work In Progress" is won (might be confusing)
if (wonStatuses.includes('Work In Progress')) {
  issues.push({
    type: 'warning',
    message: '"Work In Progress" is marked as WON. This might be intentional (work has started), but could be confusing.',
    suggestion: 'Consider if "Work In Progress" should be won or if it needs a different status.'
  });
}

// Check for ambiguous statuses
const ambiguousStatuses = [
  'Contract Signed - Pending',
  'Work In Progress - On Hold',
  'Billing In Progress'
];

ambiguousStatuses.forEach(status => {
  const result = mapStatus(status, '');
  issues.push({
    type: 'ambiguous',
    message: `"${status}" → ${result}`,
    suggestion: 'This status contains conflicting keywords. Verify the result is correct.'
  });
});

if (issues.length > 0) {
  issues.forEach(issue => {
    console.log(`\n${issue.type === 'warning' ? '⚠️' : '❓'} ${issue.message}`);
    console.log(`   💡 ${issue.suggestion}`);
  });
} else {
  console.log('✅ No obvious issues found!');
}

console.log('\n' + '='.repeat(80));
console.log('✅ Analysis Complete!\n');
