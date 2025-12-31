#!/usr/bin/env node

/**
 * Refine Exclusion Rules - Find Additional Patterns
 * 
 * We have 950 estimates but need 924 (26 too many).
 * Let's analyze what additional patterns exist in the kept estimates
 * that match LMN's excluded list.
 */

import { readFileSync } from 'fs';

// Read the files
const keptCsv = readFileSync('optimal_kept.csv', 'utf-8');
const lmnExcludedCsv = readFileSync('lmn_excluded_estimates.csv', 'utf-8');

// Parse kept estimates
const keptEstimates = new Map();
keptCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [id, num, date, status, division, price, hours, pph] = line.split(',');
  if (id && id !== 'Estimate ID') {
    keptEstimates.set(id, {
      id,
      division: division || '',
      price: parseFloat(price) || 0,
      hours: hours ? parseFloat(hours) : 0,
      pph: pph ? parseFloat(pph) : 0,
    });
  }
});

// Parse LMN excluded estimates
const lmnExcludedIds = new Set();
lmnExcludedCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [id] = line.split(',');
  if (id && id !== 'Estimate ID') {
    lmnExcludedIds.add(id);
  }
});

// Find kept estimates that LMN excludes
const shouldExclude = [];
keptEstimates.forEach((est, id) => {
  if (lmnExcludedIds.has(id)) {
    shouldExclude.push({ id, ...est });
  }
});

console.log(`🔍 Found ${shouldExclude.length} estimates in our kept list that LMN excludes\n`);

// Analyze patterns
console.log('📊 Analysis of estimates we keep but LMN excludes:\n');

// By division
const byDivision = {};
shouldExclude.forEach(est => {
  const div = est.division || 'Unknown';
  byDivision[div] = (byDivision[div] || 0) + 1;
});

console.log('By Division:');
Object.entries(byDivision)
  .sort((a, b) => b[1] - a[1])
  .forEach(([div, count]) => {
    console.log(`  ${div}: ${count}`);
  });

// By price-per-hour range
const byPPH = {
  '0-1000': 0,
  '1000-2000': 0,
  '2000-3000': 0,
  '3000-4000': 0,
  '4000-5000': 0,
  '5000+': 0,
};

shouldExclude.forEach(est => {
  const pph = est.pph || 0;
  if (pph === 0) byPPH['0-1000']++;
  else if (pph < 1000) byPPH['0-1000']++;
  else if (pph < 2000) byPPH['1000-2000']++;
  else if (pph < 3000) byPPH['2000-3000']++;
  else if (pph < 4000) byPPH['3000-4000']++;
  else if (pph < 5000) byPPH['4000-5000']++;
  else byPPH['5000+']++;
});

console.log('\nBy Price-Per-Hour:');
Object.entries(byPPH).forEach(([range, count]) => {
  if (count > 0) {
    console.log(`  ${range}: ${count}`);
  }
});

// By hours
const byHours = {
  '0': 0,
  '1-2': 0,
  '3-5': 0,
  '6-10': 0,
  '11-20': 0,
  '21+': 0,
};

shouldExclude.forEach(est => {
  const hours = est.hours || 0;
  if (hours === 0) byHours['0']++;
  else if (hours <= 2) byHours['1-2']++;
  else if (hours <= 5) byHours['3-5']++;
  else if (hours <= 10) byHours['6-10']++;
  else if (hours <= 20) byHours['11-20']++;
  else byHours['21+']++;
});

console.log('\nBy Hours:');
Object.entries(byHours).forEach(([range, count]) => {
  if (count > 0) {
    console.log(`  ${range}: ${count}`);
  }
});

// Show examples
console.log('\n📋 Examples of estimates we keep but LMN excludes:');
shouldExclude.slice(0, 20).forEach(est => {
  console.log(`  ${est.id}: ${est.division}, $${est.price.toLocaleString()}, ${est.hours}h, $${est.pph.toFixed(2)}/h`);
});

// Suggest refined rules
console.log('\n💡 Suggested Refined Rules:');
console.log('   Current: PPH > $5,000 OR Price < $100');
console.log(`   We need to exclude ${shouldExclude.length} more estimates`);

// Check if there's a pattern in PPH range 4000-5000
const pph4000to5000 = shouldExclude.filter(est => est.pph >= 4000 && est.pph < 5000);
if (pph4000to5000.length > 0) {
  console.log(`\n   Found ${pph4000to5000.length} estimates with PPH between $4,000-$5,000`);
  console.log('   Consider: Lower PPH threshold to $4,000 or $4,500');
}

// Check maintenance division with specific patterns
const maintenanceLowHours = shouldExclude.filter(est => 
  est.division.includes('Maintenance') && est.hours <= 2 && est.pph > 0
);
if (maintenanceLowHours.length > 0) {
  console.log(`\n   Found ${maintenanceLowHours.length} maintenance estimates with ≤2 hours`);
  console.log('   Consider: Exclude maintenance with hours ≤2 AND PPH > threshold');
}

