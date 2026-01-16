/**
 * Calculate how Costco scorecard data will change after removing test field
 * Based on the scorecard data provided by the user
 */

console.log('📊 Costco Scorecard - Before and After Removing Test Field\n');
console.log('=' .repeat(60));

// Original data from the scorecard
const originalSectionScores = {
  'Corporate Demographic Information': 4,
  'Non-Negotiables': 67,
  'Non-Negotiable after 3 Years': 11,
  'Red Flags': 14,
  'Estimates by Department': 12,
  'Other': 25  // This includes the test field
};

const testFieldData = {
  question_text: 'test',
  answer: 5,
  weight: 5,
  weighted_score: 25,
  section: 'Other'
};

// Calculate original totals
const originalTotalScore = Object.values(originalSectionScores).reduce((sum, score) => sum + score, 0);
const originalTotalPossibleScore = 3994; // From template before removal
const originalNormalizedScore = Math.round((originalTotalScore / originalTotalPossibleScore) * 100);
const originalPassThreshold = 70;
const originalIsPass = originalNormalizedScore >= originalPassThreshold;

// New calculations (after removing test field)
const newSectionScores = {
  ...originalSectionScores,
  'Other': originalSectionScores['Other'] - testFieldData.weighted_score
};

const newTotalScore = originalTotalScore - testFieldData.weighted_score;
const newTotalPossibleScore = 504; // From updated template
const newNormalizedScore = Math.round((newTotalScore / newTotalPossibleScore) * 100);
const newIsPass = newNormalizedScore >= originalPassThreshold;

console.log('\n📋 SECTION SCORES:');
console.log('-'.repeat(60));
Object.entries(originalSectionScores).forEach(([section, score]) => {
  const newScore = newSectionScores[section];
  const change = newScore - score;
  const changeStr = change !== 0 ? ` (${change > 0 ? '+' : ''}${change})` : '';
  console.log(`  ${section.padEnd(40)} ${String(score).padStart(4)} → ${String(newScore).padStart(4)}${changeStr}`);
});

console.log('\n📊 OVERALL SCORES:');
console.log('-'.repeat(60));
console.log(`  Total Score:              ${String(originalTotalScore).padStart(4)} → ${String(newTotalScore).padStart(4)} (${newTotalScore - originalTotalScore < 0 ? '' : '+'}${newTotalScore - originalTotalScore})`);
console.log(`  Total Possible Score:    ${String(originalTotalPossibleScore).padStart(4)} → ${String(newTotalPossibleScore).padStart(4)} (${newTotalPossibleScore - originalTotalPossibleScore < 0 ? '' : '+'}${newTotalPossibleScore - originalTotalPossibleScore})`);
console.log(`  Normalized Score:         ${String(originalNormalizedScore).padStart(3)}% → ${String(newNormalizedScore).padStart(3)}% (${newNormalizedScore - originalNormalizedScore > 0 ? '+' : ''}${newNormalizedScore - originalNormalizedScore}%)`);
console.log(`  Pass/Fail Status:         ${originalIsPass ? 'PASS' : 'FAIL'} → ${newIsPass ? 'PASS' : 'FAIL'}`);

console.log('\n🗑️  REMOVED TEST FIELD:');
console.log('-'.repeat(60));
console.log(`  Question: "${testFieldData.question_text}"`);
console.log(`  Answer: ${testFieldData.answer} (out of 5)`);
console.log(`  Weight: ${testFieldData.weight}`);
console.log(`  Contribution: ${testFieldData.weighted_score} points`);
console.log(`  Section: ${testFieldData.section}`);

console.log('\n📈 IMPACT SUMMARY:');
console.log('-'.repeat(60));
console.log(`  • Total score reduced by: ${testFieldData.weighted_score} points`);
console.log(`  • Normalized score changed: ${originalNormalizedScore}% → ${newNormalizedScore}%`);
console.log(`  • Pass/Fail status: ${originalIsPass === newIsPass ? 'UNCHANGED' : 'CHANGED'}`);
console.log(`  • "Other" section reduced: ${originalSectionScores['Other']} → ${newSectionScores['Other']} (${newSectionScores['Other'] - originalSectionScores['Other']} points)`);

console.log('\n' + '='.repeat(60));
console.log('✅ Calculation complete!\n');

