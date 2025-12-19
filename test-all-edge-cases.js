/**
 * Comprehensive Edge Case Testing for Won/Loss/Pending Algorithm
 * 
 * Tests both CSV parser and LMN parser implementations
 * Identifies all edge cases, inconsistencies, and potential issues
 * 
 * Usage: node test-all-edge-cases.js
 */

// CSV Parser Implementation (from src/utils/csvParser.js)
function mapStatusCSV(status, pipelineStatus) {
  // Check pipeline status first (more reliable)
  const pipeline = (pipelineStatus || '').toLowerCase();
  if (pipeline === 'sold') return 'won';
  if (pipeline === 'lost') return 'lost';
  if (pipeline === 'pending') return 'pending';
  
  // Fall back to Status field
  const stat = (status || '').toLowerCase();
  
  // Won statuses
  if (
    stat.includes('contract signed') ||
    stat.includes('contract award') ||
    stat.includes('sold') ||
    stat.includes('email contract') ||
    stat.includes('verbal contract')
  ) {
    return 'won';
  }
  
  // Lost statuses
  if (stat.includes('lost') || stat.includes('estimate lost')) {
    return 'lost';
  }
  
  // Pending/In Progress
  if (
    stat.includes('in progress') ||
    stat.includes('pending') ||
    stat === ''
  ) {
    return 'pending';
  }
  
  // Default to pending
  return 'pending';
}

// LMN Parser Implementation (from src/utils/lmnEstimatesListParser.js)
function mapStatusLMN(status, pipelineStatus) {
  const stat = (status || '').toLowerCase();
  const pipeline = (pipelineStatus || '').toLowerCase();
  let estimateStatus = 'pending';
  
  if (pipeline.includes('sold') || 
      pipeline.includes('contract') ||
      stat.includes('won')) {
    estimateStatus = 'won';
  } else if (pipeline.includes('lost') ||
             stat.includes('lost')) {
    estimateStatus = 'lost';
  }
  
  return estimateStatus;
}

// Comprehensive Edge Case Test Suite
const edgeCases = [
  // ========== NULL/UNDEFINED/EMPTY VALUES ==========
  { status: null, pipelineStatus: null, description: 'Both null' },
  { status: undefined, pipelineStatus: undefined, description: 'Both undefined' },
  { status: '', pipelineStatus: '', description: 'Both empty strings' },
  { status: '   ', pipelineStatus: '   ', description: 'Both whitespace only' },
  { status: null, pipelineStatus: '', description: 'Status null, Pipeline empty' },
  { status: '', pipelineStatus: null, description: 'Status empty, Pipeline null' },
  { status: undefined, pipelineStatus: 'Sold', description: 'Status undefined, Pipeline Sold' },
  { status: 'Sold', pipelineStatus: undefined, description: 'Status Sold, Pipeline undefined' },
  
  // ========== CASE SENSITIVITY ==========
  { status: 'SOLD', pipelineStatus: '', description: 'Status: SOLD (uppercase)' },
  { status: 'sold', pipelineStatus: '', description: 'Status: sold (lowercase)' },
  { status: 'Sold', pipelineStatus: '', description: 'Status: Sold (mixed)' },
  { status: 'SoLd', pipelineStatus: '', description: 'Status: SoLd (mixed case)' },
  { status: 'CONTRACT SIGNED', pipelineStatus: '', description: 'Status: CONTRACT SIGNED (uppercase)' },
  { status: 'contract signed', pipelineStatus: '', description: 'Status: contract signed (lowercase)' },
  { status: 'Contract Signed', pipelineStatus: '', description: 'Status: Contract Signed (title case)' },
  { status: '', pipelineStatus: 'SOLD', description: 'Pipeline: SOLD (uppercase)' },
  { status: '', pipelineStatus: 'sold', description: 'Pipeline: sold (lowercase)' },
  { status: '', pipelineStatus: 'Sold', description: 'Pipeline: Sold (mixed)' },
  
  // ========== WHITESPACE HANDLING ==========
  { status: '  Contract Signed  ', pipelineStatus: '', description: 'Status with leading/trailing spaces' },
  { status: 'Contract   Signed', pipelineStatus: '', description: 'Status with extra spaces' },
  { status: '\tContract Signed\n', pipelineStatus: '', description: 'Status with tabs/newlines' },
  { status: '', pipelineStatus: '  Sold  ', description: 'Pipeline with leading/trailing spaces' },
  { status: ' Contract Signed ', pipelineStatus: '  Sold  ', description: 'Both with whitespace' },
  
  // ========== FALSE POSITIVE RISKS FOR WON ==========
  { status: 'Contract Signed - Pending Approval', pipelineStatus: '', description: '⚠️ Contract Signed but pending approval' },
  { status: 'Contract Signed - Draft', pipelineStatus: '', description: '⚠️ Contract Signed but draft' },
  { status: 'Contract Signed - Not Final', pipelineStatus: '', description: '⚠️ Contract Signed but not final' },
  { status: 'Sold Equipment', pipelineStatus: '', description: '⚠️ Sold Equipment (unrelated)' },
  { status: 'Sold Items', pipelineStatus: '', description: '⚠️ Sold Items (unrelated)' },
  { status: 'Email Contract - Draft', pipelineStatus: '', description: '⚠️ Email Contract but draft' },
  { status: 'Email Contract - Pending', pipelineStatus: '', description: '⚠️ Email Contract but pending' },
  { status: 'Verbal Contract - Not Confirmed', pipelineStatus: '', description: '⚠️ Verbal Contract but not confirmed' },
  { status: 'Contract Award - Pending', pipelineStatus: '', description: '⚠️ Contract Award but pending' },
  { status: 'Pre-Contract Signed', pipelineStatus: '', description: '⚠️ Pre-Contract Signed (before signing)' },
  
  // ========== FALSE POSITIVE RISKS FOR LOST ==========
  { status: 'Lost Contact', pipelineStatus: '', description: '⚠️ Lost Contact (not estimate lost)' },
  { status: 'Lost in Translation', pipelineStatus: '', description: '⚠️ Lost in Translation (not estimate lost)' },
  { status: 'Lost Opportunity', pipelineStatus: '', description: '⚠️ Lost Opportunity (ambiguous)' },
  { status: 'Lost Time', pipelineStatus: '', description: '⚠️ Lost Time (unrelated)' },
  { status: 'Lost and Found', pipelineStatus: '', description: '⚠️ Lost and Found (unrelated)' },
  { status: 'Estimate Lost Contact', pipelineStatus: '', description: '⚠️ Estimate Lost Contact (ambiguous)' },
  
  // ========== PIPELINE STATUS PRIORITY TESTS ==========
  { status: 'Contract Signed', pipelineStatus: 'Lost', description: 'Pipeline Lost overrides Status Contract Signed' },
  { status: 'Lost', pipelineStatus: 'Sold', description: 'Pipeline Sold overrides Status Lost' },
  { status: 'In Progress', pipelineStatus: 'Sold', description: 'Pipeline Sold overrides Status In Progress' },
  { status: 'Pending', pipelineStatus: 'Lost', description: 'Pipeline Lost overrides Status Pending' },
  { status: 'Contract Signed', pipelineStatus: 'Pending', description: 'Pipeline Pending overrides Status Contract Signed' },
  
  // ========== PARTIAL MATCHES (Potential Issues) ==========
  { status: 'Contract', pipelineStatus: '', description: 'Status: Contract (partial match)' },
  { status: 'Signed', pipelineStatus: '', description: 'Status: Signed (partial match)' },
  { status: 'Award', pipelineStatus: '', description: 'Status: Award (partial match)' },
  { status: 'Email', pipelineStatus: '', description: 'Status: Email (partial match)' },
  { status: 'Verbal', pipelineStatus: '', description: 'Status: Verbal (partial match)' },
  { status: 'Lost', pipelineStatus: '', description: 'Status: Lost (exact match)' },
  { status: 'Estimate', pipelineStatus: '', description: 'Status: Estimate (partial match)' },
  
  // ========== UNHANDLED STATUSES ==========
  { status: 'Cancelled', pipelineStatus: '', description: '❓ Status: Cancelled (unhandled)' },
  { status: 'On Hold', pipelineStatus: '', description: '❓ Status: On Hold (unhandled)' },
  { status: 'Deferred', pipelineStatus: '', description: '❓ Status: Deferred (unhandled)' },
  { status: 'Quoted', pipelineStatus: '', description: '❓ Status: Quoted (unhandled)' },
  { status: 'Proposed', pipelineStatus: '', description: '❓ Status: Proposed (unhandled)' },
  { status: 'Negotiating', pipelineStatus: '', description: '❓ Status: Negotiating (unhandled)' },
  { status: 'Partially Won', pipelineStatus: '', description: '❓ Status: Partially Won (unhandled)' },
  { status: 'Partially Lost', pipelineStatus: '', description: '❓ Status: Partially Lost (unhandled)' },
  { status: 'Withdrawn', pipelineStatus: '', description: '❓ Status: Withdrawn (unhandled)' },
  { status: 'Expired', pipelineStatus: '', description: '❓ Status: Expired (unhandled)' },
  { status: 'Rejected', pipelineStatus: '', description: '❓ Status: Rejected (unhandled)' },
  { status: 'Approved', pipelineStatus: '', description: '❓ Status: Approved (unhandled)' },
  { status: 'Under Review', pipelineStatus: '', description: '❓ Status: Under Review (unhandled)' },
  { status: 'Awaiting Response', pipelineStatus: '', description: '❓ Status: Awaiting Response (unhandled)' },
  
  // ========== PIPELINE STATUS VARIATIONS ==========
  { status: '', pipelineStatus: 'Sold - Final', description: 'Pipeline: Sold - Final' },
  { status: '', pipelineStatus: 'Sold Equipment', description: 'Pipeline: Sold Equipment (unrelated?)' },
  { status: '', pipelineStatus: 'Lost - Price', description: 'Pipeline: Lost - Price' },
  { status: '', pipelineStatus: 'Lost Opportunity', description: 'Pipeline: Lost Opportunity' },
  { status: '', pipelineStatus: 'Pending Approval', description: 'Pipeline: Pending Approval' },
  { status: '', pipelineStatus: 'Pending Review', description: 'Pipeline: Pending Review' },
  
  // ========== SPECIAL CHARACTERS ==========
  { status: 'Contract-Signed', pipelineStatus: '', description: 'Status: Contract-Signed (hyphen)' },
  { status: 'Contract_Signed', pipelineStatus: '', description: 'Status: Contract_Signed (underscore)' },
  { status: 'Contract.Signed', pipelineStatus: '', description: 'Status: Contract.Signed (period)' },
  { status: 'Contract/Signed', pipelineStatus: '', description: 'Status: Contract/Signed (slash)' },
  { status: 'Contract (Signed)', pipelineStatus: '', description: 'Status: Contract (Signed) (parentheses)' },
  { status: 'Contract [Signed]', pipelineStatus: '', description: 'Status: Contract [Signed] (brackets)' },
  
  // ========== REAL-WORLD VARIATIONS ==========
  { status: 'Contract Signed - Final', pipelineStatus: '', description: 'Status: Contract Signed - Final' },
  { status: 'Contract Signed - Complete', pipelineStatus: '', description: 'Status: Contract Signed - Complete' },
  { status: 'Email Contract Award', pipelineStatus: '', description: 'Status: Email Contract Award' },
  { status: 'Email Contract Awarded', pipelineStatus: '', description: 'Status: Email Contract Awarded' },
  { status: 'Verbal Contract Confirmed', pipelineStatus: '', description: 'Status: Verbal Contract Confirmed' },
  { status: 'Estimate Lost - Price too high', pipelineStatus: '', description: 'Status: Estimate Lost - Price too high' },
  { status: 'Estimate Lost - Competitor', pipelineStatus: '', description: 'Status: Estimate Lost - Competitor' },
  { status: 'Estimate Lost - No Response', pipelineStatus: '', description: 'Status: Estimate Lost - No Response' },
  { status: 'Estimate In Progress', pipelineStatus: '', description: 'Status: Estimate In Progress' },
  { status: 'Estimate Pending', pipelineStatus: '', description: 'Status: Estimate Pending' },
  { status: 'In Progress - Review', pipelineStatus: '', description: 'Status: In Progress - Review' },
  { status: 'Pending - Approval', pipelineStatus: '', description: 'Status: Pending - Approval' },
  
  // ========== LMN PARSER SPECIFIC EDGE CASES ==========
  { status: 'Won', pipelineStatus: '', description: 'Status: Won (LMN parser checks this)' },
  { status: 'WON', pipelineStatus: '', description: 'Status: WON (LMN parser checks this)' },
  { status: 'won', pipelineStatus: '', description: 'Status: won (LMN parser checks this)' },
  { status: '', pipelineStatus: 'Contract', description: 'Pipeline: Contract (LMN parser checks this)' },
  { status: '', pipelineStatus: 'Contract Signed', description: 'Pipeline: Contract Signed (LMN parser checks this)' },
  { status: '', pipelineStatus: 'Contract Award', description: 'Pipeline: Contract Award (LMN parser checks this)' },
];

// Test Results
const results = {
  total: 0,
  csv: { won: 0, lost: 0, pending: 0 },
  lmn: { won: 0, lost: 0, pending: 0 },
  differences: [],
  falsePositives: [],
  unhandled: [],
  edgeCases: []
};

console.log('\n🔍 COMPREHENSIVE EDGE CASE ANALYSIS\n');
console.log('='.repeat(100));

edgeCases.forEach((testCase, index) => {
  results.total++;
  const csvResult = mapStatusCSV(testCase.status, testCase.pipelineStatus);
  const lmnResult = mapStatusLMN(testCase.status, testCase.pipelineStatus);
  
  results.csv[csvResult]++;
  results.lmn[lmnResult]++;
  
  // Check for differences between parsers
  if (csvResult !== lmnResult) {
    results.differences.push({
      index: index + 1,
      description: testCase.description,
      status: testCase.status || '(empty)',
      pipelineStatus: testCase.pipelineStatus || '(empty)',
      csv: csvResult,
      lmn: lmnResult
    });
  }
  
  // Check for false positives
  if (testCase.description.includes('⚠️')) {
    results.falsePositives.push({
      index: index + 1,
      description: testCase.description,
      status: testCase.status || '(empty)',
      pipelineStatus: testCase.pipelineStatus || '(empty)',
      csv: csvResult,
      lmn: lmnResult
    });
  }
  
  // Check for unhandled statuses
  if (testCase.description.includes('❓')) {
    results.unhandled.push({
      index: index + 1,
      description: testCase.description,
      status: testCase.status || '(empty)',
      pipelineStatus: testCase.pipelineStatus || '(empty)',
      csv: csvResult,
      lmn: lmnResult
    });
  }
});

// Print Summary
console.log(`\n📊 SUMMARY:\n`);
console.log(`Total Edge Cases Tested: ${results.total}`);
console.log(`\nCSV Parser Results:`);
console.log(`  Won: ${results.csv.won} (${((results.csv.won / results.total) * 100).toFixed(1)}%)`);
console.log(`  Lost: ${results.csv.lost} (${((results.csv.lost / results.total) * 100).toFixed(1)}%)`);
console.log(`  Pending: ${results.csv.pending} (${((results.csv.pending / results.total) * 100).toFixed(1)}%)`);
console.log(`\nLMN Parser Results:`);
console.log(`  Won: ${results.lmn.won} (${((results.lmn.won / results.total) * 100).toFixed(1)}%)`);
console.log(`  Lost: ${results.lmn.lost} (${((results.lmn.lost / results.total) * 100).toFixed(1)}%)`);
console.log(`  Pending: ${results.lmn.pending} (${((results.lmn.pending / results.total) * 100).toFixed(1)}%)`);

// Print Parser Differences
if (results.differences.length > 0) {
  console.log(`\n\n⚠️  PARSER INCONSISTENCIES (${results.differences.length}):\n`);
  console.log('-'.repeat(100));
  results.differences.forEach((diff, i) => {
    console.log(`\n${i + 1}. ${diff.description}`);
    console.log(`   Status: "${diff.status}"`);
    console.log(`   Pipeline: "${diff.pipelineStatus}"`);
    console.log(`   CSV Parser: ${diff.csv}`);
    console.log(`   LMN Parser: ${diff.lmn}`);
    console.log(`   ⚠️  DIFFERENT RESULTS!`);
  });
} else {
  console.log(`\n✅ No parser inconsistencies found.`);
}

// Print False Positives
if (results.falsePositives.length > 0) {
  console.log(`\n\n⚠️  FALSE POSITIVE RISKS (${results.falsePositives.length}):\n`);
  console.log('-'.repeat(100));
  results.falsePositives.forEach((fp, i) => {
    console.log(`\n${i + 1}. ${fp.description}`);
    console.log(`   Status: "${fp.status}"`);
    console.log(`   Pipeline: "${fp.pipelineStatus}"`);
    console.log(`   CSV Parser: ${fp.csv}`);
    console.log(`   LMN Parser: ${fp.lmn}`);
    if (fp.csv === 'won' || fp.lmn === 'won') {
      console.log(`   ⚠️  Marked as WON but should likely be PENDING`);
    }
    if (fp.csv === 'lost' || fp.lmn === 'lost') {
      console.log(`   ⚠️  Marked as LOST but should likely be PENDING`);
    }
  });
}

// Print Unhandled Statuses
if (results.unhandled.length > 0) {
  console.log(`\n\n❓ UNHANDLED STATUSES (${results.unhandled.length}):\n`);
  console.log('-'.repeat(100));
  results.unhandled.forEach((uh, i) => {
    console.log(`\n${i + 1}. ${uh.description}`);
    console.log(`   Status: "${uh.status}"`);
    console.log(`   Pipeline: "${uh.pipelineStatus}"`);
    console.log(`   CSV Parser: ${uh.csv} (defaults to pending)`);
    console.log(`   LMN Parser: ${uh.lmn} (defaults to pending)`);
    console.log(`   💡 Consider adding explicit handling for this status`);
  });
}

// Recommendations
console.log(`\n\n💡 RECOMMENDATIONS:\n`);
console.log('='.repeat(100));

if (results.differences.length > 0) {
  console.log(`\n1. UNIFY PARSER LOGIC:`);
  console.log(`   - ${results.differences.length} cases produce different results between CSV and LMN parsers`);
  console.log(`   - Create a shared utility function for status mapping`);
  console.log(`   - Use the same logic in both parsers`);
}

if (results.falsePositives.length > 0) {
  console.log(`\n2. IMPROVE PATTERN MATCHING:`);
  console.log(`   - ${results.falsePositives.length} potential false positive cases identified`);
  console.log(`   - Use exact matches or word boundaries instead of includes()`);
  console.log(`   - Add negative patterns (e.g., exclude "Pending" when checking "Contract Signed")`);
  console.log(`   - Consider adding manual override capability`);
}

if (results.unhandled.length > 0) {
  console.log(`\n3. HANDLE ADDITIONAL STATUSES:`);
  console.log(`   - ${results.unhandled.length} unhandled statuses found`);
  console.log(`   - Consider mapping: Cancelled, On Hold, Deferred, Quoted, Proposed, etc.`);
  console.log(`   - Decide if these should be: won, lost, or pending`);
}

console.log(`\n4. ADD VALIDATION:`);
console.log(`   - Verify won estimates have close dates`);
console.log(`   - Verify lost estimates have close dates (if applicable)`);
console.log(`   - Flag logical inconsistencies`);

console.log(`\n5. ADD TESTING:`);
console.log(`   - Add unit tests for edge cases`);
console.log(`   - Add integration tests with real data`);
console.log(`   - Monitor false positive rate in production`);

console.log('\n' + '='.repeat(100));
console.log('✅ Edge Case Analysis Complete!\n');
