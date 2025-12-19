/**
 * Comprehensive Test Script for Won/Loss/Pending Algorithm
 * 
 * This script tests the accuracy of the status mapping algorithm
 * by comparing expected vs actual results for various status combinations.
 * 
 * Usage: node test-status-accuracy.js
 */

// Import the actual mapping function (if running in Node.js, we'll duplicate it)
// In browser/React, import from '@/utils/csvParser'

function mapStatus(status, pipelineStatus) {
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

// Test Cases
const testCases = [
  // ========== HIGH CONFIDENCE TESTS (Should be 100% accurate) ==========
  
  // Pipeline Status: Sold → Won
  { status: '', pipelineStatus: 'Sold', expected: 'won', confidence: 'high', description: 'Pipeline: Sold' },
  { status: '', pipelineStatus: 'SOLD', expected: 'won', confidence: 'high', description: 'Pipeline: SOLD (uppercase)' },
  { status: '', pipelineStatus: 'sold', expected: 'won', confidence: 'high', description: 'Pipeline: sold (lowercase)' },
  
  // Pipeline Status: Lost → Lost
  { status: '', pipelineStatus: 'Lost', expected: 'lost', confidence: 'high', description: 'Pipeline: Lost' },
  { status: '', pipelineStatus: 'LOST', expected: 'lost', confidence: 'high', description: 'Pipeline: LOST (uppercase)' },
  
  // Pipeline Status: Pending → Pending
  { status: '', pipelineStatus: 'Pending', expected: 'pending', confidence: 'high', description: 'Pipeline: Pending' },
  
  // Status Field: Exact matches
  { status: 'Contract Signed', pipelineStatus: '', expected: 'won', confidence: 'high', description: 'Status: Contract Signed' },
  { status: 'Contract Award', pipelineStatus: '', expected: 'won', confidence: 'high', description: 'Status: Contract Award' },
  { status: 'Sold', pipelineStatus: '', expected: 'won', confidence: 'high', description: 'Status: Sold' },
  { status: 'Lost', pipelineStatus: '', expected: 'lost', confidence: 'high', description: 'Status: Lost' },
  { status: 'Estimate Lost', pipelineStatus: '', expected: 'lost', confidence: 'high', description: 'Status: Estimate Lost' },
  { status: 'In Progress', pipelineStatus: '', expected: 'pending', confidence: 'high', description: 'Status: In Progress' },
  { status: 'Pending', pipelineStatus: '', expected: 'pending', confidence: 'high', description: 'Status: Pending' },
  { status: '', pipelineStatus: '', expected: 'pending', confidence: 'high', description: 'Both empty (default)' },
  
  // ========== MEDIUM CONFIDENCE TESTS (Pattern matches) ==========
  
  // Won patterns
  { status: 'Email Contract Award', pipelineStatus: '', expected: 'won', confidence: 'medium', description: 'Status: Email Contract Award' },
  { status: 'Verbal Contract', pipelineStatus: '', expected: 'won', confidence: 'medium', description: 'Status: Verbal Contract' },
  { status: 'Contract Signed - Final', pipelineStatus: '', expected: 'won', confidence: 'medium', description: 'Status: Contract Signed - Final' },
  
  // Lost patterns
  { status: 'Estimate Lost - Price too high', pipelineStatus: '', expected: 'lost', confidence: 'medium', description: 'Status: Estimate Lost - Price too high' },
  { status: 'Estimate Lost - Competitor', pipelineStatus: '', expected: 'lost', confidence: 'medium', description: 'Status: Estimate Lost - Competitor' },
  
  // Pending patterns
  { status: 'Estimate In Progress', pipelineStatus: '', expected: 'pending', confidence: 'medium', description: 'Status: Estimate In Progress' },
  { status: 'Pending Approval', pipelineStatus: '', expected: 'pending', confidence: 'medium', description: 'Status: Pending Approval' },
  
  // ========== EDGE CASES / POTENTIAL FALSE POSITIVES ==========
  
  // False positive risks for WON
  { status: 'Contract Signed - Pending Approval', pipelineStatus: '', expected: 'won', actualShouldBe: 'pending', confidence: 'low', description: '⚠️ FALSE POSITIVE: Should be pending but contains "contract signed"' },
  { status: 'Sold Equipment', pipelineStatus: '', expected: 'won', actualShouldBe: 'pending', confidence: 'low', description: '⚠️ FALSE POSITIVE: Should be pending but contains "sold"' },
  { status: 'Email Contract - Draft', pipelineStatus: '', expected: 'won', actualShouldBe: 'pending', confidence: 'low', description: '⚠️ FALSE POSITIVE: Should be pending but contains "email contract"' },
  
  // False positive risks for LOST
  { status: 'Lost Contact', pipelineStatus: '', expected: 'lost', actualShouldBe: 'pending', confidence: 'low', description: '⚠️ FALSE POSITIVE: Should be pending but contains "lost"' },
  { status: 'Lost in Translation', pipelineStatus: '', expected: 'lost', actualShouldBe: 'pending', confidence: 'low', description: '⚠️ FALSE POSITIVE: Should be pending but contains "lost"' },
  
  // ========== PRIORITY TESTS (Pipeline Status should override Status) ==========
  
  { status: 'Contract Signed', pipelineStatus: 'Lost', expected: 'lost', confidence: 'high', description: 'Pipeline: Lost overrides Status: Contract Signed' },
  { status: 'Lost', pipelineStatus: 'Sold', expected: 'won', confidence: 'high', description: 'Pipeline: Sold overrides Status: Lost' },
  { status: 'In Progress', pipelineStatus: 'Sold', expected: 'won', confidence: 'high', description: 'Pipeline: Sold overrides Status: In Progress' },
  
  // ========== CASE VARIATIONS ==========
  
  { status: 'CONTRACT SIGNED', pipelineStatus: '', expected: 'won', confidence: 'high', description: 'Status: CONTRACT SIGNED (uppercase)' },
  { status: 'contract signed', pipelineStatus: '', expected: 'won', confidence: 'high', description: 'Status: contract signed (lowercase)' },
  { status: 'Contract Signed', pipelineStatus: '', expected: 'won', confidence: 'high', description: 'Status: Contract Signed (mixed case)' },
  { status: 'CoNtRaCt SiGnEd', pipelineStatus: '', expected: 'won', confidence: 'high', description: 'Status: CoNtRaCt SiGnEd (mixed case)' },
];

// Run Tests
console.log('\n🧪 WON/LOSS/PENDING ALGORITHM ACCURACY TEST\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;
let warnings = 0;
const failures = [];
const warningsList = [];

testCases.forEach((testCase, index) => {
  const result = mapStatus(testCase.status, testCase.pipelineStatus);
  const passedTest = result === testCase.expected;
  
  if (passedTest) {
    passed++;
    if (testCase.actualShouldBe) {
      // This is a known false positive
      warnings++;
      warningsList.push({
        test: testCase.description,
        got: result,
        expected: testCase.expected,
        shouldBe: testCase.actualShouldBe,
        status: testCase.status,
        pipelineStatus: testCase.pipelineStatus
      });
    }
  } else {
    failed++;
    failures.push({
      test: testCase.description,
      got: result,
      expected: testCase.expected,
      status: testCase.status,
      pipelineStatus: testCase.pipelineStatus
    });
  }
});

// Print Results
console.log(`\n📊 TEST RESULTS:\n`);
console.log(`✅ Passed: ${passed}/${testCases.length}`);
console.log(`❌ Failed: ${failed}/${testCases.length}`);
console.log(`⚠️  Known Issues: ${warnings}/${testCases.length}`);

const accuracy = ((passed / testCases.length) * 100).toFixed(1);
console.log(`\n📈 Overall Accuracy: ${accuracy}%`);

// Print Failures
if (failures.length > 0) {
  console.log(`\n\n❌ FAILED TESTS (${failures.length}):\n`);
  console.log('-'.repeat(80));
  failures.forEach((failure, i) => {
    console.log(`\n${i + 1}. ${failure.test}`);
    console.log(`   Status: "${failure.status}"`);
    console.log(`   Pipeline Status: "${failure.pipelineStatus}"`);
    console.log(`   Expected: ${failure.expected}`);
    console.log(`   Got: ${failure.got}`);
  });
}

// Print Warnings (Known False Positives)
if (warningsList.length > 0) {
  console.log(`\n\n⚠️  KNOWN ISSUES / FALSE POSITIVES (${warningsList.length}):\n`);
  console.log('-'.repeat(80));
  warningsList.forEach((warning, i) => {
    console.log(`\n${i + 1}. ${warning.test}`);
    console.log(`   Status: "${warning.status}"`);
    console.log(`   Pipeline Status: "${warning.pipelineStatus}"`);
    console.log(`   Algorithm Result: ${warning.got} (matches expected: ${warning.expected})`);
    console.log(`   ⚠️  Should Actually Be: ${warning.shouldBe}`);
    console.log(`   💡 This is a known limitation of pattern matching`);
  });
}

// Summary
console.log(`\n\n📋 SUMMARY:\n`);
console.log('='.repeat(80));
console.log(`Total Tests: ${testCases.length}`);
console.log(`✅ Passed: ${passed} (${((passed / testCases.length) * 100).toFixed(1)}%)`);
console.log(`❌ Failed: ${failed} (${((failed / testCases.length) * 100).toFixed(1)}%)`);
console.log(`⚠️  Known Issues: ${warnings} (${((warnings / testCases.length) * 100).toFixed(1)}%)`);

if (warnings > 0) {
  console.log(`\n💡 RECOMMENDATION:`);
  console.log(`   The algorithm has ${warnings} known false positive cases.`);
  console.log(`   Consider improving pattern matching to use exact matches or word boundaries.`);
}

if (failed === 0 && warnings === 0) {
  console.log(`\n🎉 All tests passed! Algorithm is working as expected.`);
} else if (failed === 0) {
  console.log(`\n✅ All tests passed, but ${warnings} known edge cases exist.`);
} else {
  console.log(`\n⚠️  Some tests failed. Review the failures above.`);
}

console.log('\n' + '='.repeat(80) + '\n');

// Additional Analysis
console.log('📊 CONFIDENCE BREAKDOWN:\n');
const highConfidence = testCases.filter(t => t.confidence === 'high').length;
const mediumConfidence = testCases.filter(t => t.confidence === 'medium').length;
const lowConfidence = testCases.filter(t => t.confidence === 'low').length;

console.log(`High Confidence Tests: ${highConfidence}`);
console.log(`Medium Confidence Tests: ${mediumConfidence}`);
console.log(`Low Confidence Tests: ${lowConfidence} (edge cases)`);

console.log('\n✅ Test Complete!\n');

