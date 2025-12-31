#!/usr/bin/env node

/**
 * Find the Exact 26 Estimates to Exclude
 * 
 * We have 950 kept estimates, need 924.
 * We found 103 estimates in our kept list that LMN excludes.
 * But we only need to exclude 26 more to match the count.
 * 
 * This script finds which 26 estimates, when excluded, get us closest
 * to both the count (924) and dollar ($11,049,470.84) targets.
 */

import { readFileSync, writeFileSync } from 'fs';

// Read files
const keptCsv = readFileSync('optimal_kept.csv', 'utf-8');
const lmnExcludedCsv = readFileSync('lmn_excluded_estimates.csv', 'utf-8');

// Parse kept estimates
const keptEstimates = [];
keptCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [id, num, date, status, division, price, hours, pph] = line.split(',');
  if (id && id !== 'Estimate ID') {
    keptEstimates.push({
      id,
      division: division || '',
      price: parseFloat(price) || 0,
      hours: hours ? parseFloat(hours) : 0,
      pph: pph ? parseFloat(pph) : 0,
    });
  }
});

// Parse LMN excluded
const lmnExcludedIds = new Set();
lmnExcludedCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [id] = line.split(',');
  if (id && id !== 'Estimate ID') {
    lmnExcludedIds.add(id);
  }
});

// Find which kept estimates LMN excludes
const candidates = keptEstimates.filter(est => lmnExcludedIds.has(est.id));

console.log(`🔍 Found ${candidates.length} candidates (estimates we keep but LMN excludes)`);
console.log(`   Current kept: ${keptEstimates.length}`);
console.log(`   Target: 924`);
console.log(`   Need to exclude: ${keptEstimates.length - 924} more\n`);

// Calculate current totals
const currentDollar = keptEstimates.reduce((sum, est) => sum + est.price, 0);
const targetDollar = 11_049_470.84;
const targetCount = 924;

console.log(`📊 Current:`);
console.log(`   Count: ${keptEstimates.length}`);
console.log(`   Dollar: $${currentDollar.toLocaleString()}`);
console.log(`\n📊 Target:`);
console.log(`   Count: ${targetCount}`);
console.log(`   Dollar: $${targetDollar.toLocaleString()}\n`);

// Try different combinations to find best 26
const needToExclude = keptEstimates.length - targetCount;
console.log(`🎯 Need to exclude exactly ${needToExclude} estimates\n`);

// Strategy: Try excluding candidates that minimize dollar difference
// Sort candidates by price (ascending) to minimize dollar impact
candidates.sort((a, b) => a.price - b.price);

// Try different selection strategies
const strategies = [
  {
    name: 'Lowest Price First',
    select: (cands, n) => cands.slice(0, n)
  },
  {
    name: 'Highest Price First',
    select: (cands, n) => cands.slice(-n).reverse()
  },
  {
    name: 'Zero Hours First',
    select: (cands, n) => {
      const zeroHours = cands.filter(c => c.hours === 0);
      const withHours = cands.filter(c => c.hours > 0);
      return [...zeroHours, ...withHours].slice(0, n);
    }
  },
  {
    name: 'Maintenance Division First',
    select: (cands, n) => {
      const maintenance = cands.filter(c => c.division.includes('Maintenance'));
      const others = cands.filter(c => !c.division.includes('Maintenance'));
      return [...maintenance, ...others].slice(0, n);
    }
  },
  {
    name: 'Low PPH First',
    select: (cands, n) => {
      const sorted = [...cands].sort((a, b) => (a.pph || 0) - (b.pph || 0));
      return sorted.slice(0, n);
    }
  }
];

let best = null;

strategies.forEach(strategy => {
  const toExclude = strategy.select(candidates, needToExclude);
  const remaining = keptEstimates.filter(est => 
    !toExclude.some(ex => ex.id === est.id)
  );
  
  const count = remaining.length;
  const dollar = remaining.reduce((sum, est) => sum + est.price, 0);
  
  const countDiff = Math.abs(count - targetCount);
  const dollarDiff = Math.abs(dollar - targetDollar);
  const countAccuracy = (1 - countDiff / targetCount) * 100;
  const dollarAccuracy = (1 - dollarDiff / targetDollar) * 100;
  const combinedAccuracy = (countAccuracy + dollarAccuracy) / 2;
  
  const score = countDiff + (dollarDiff / 1000); // Combined error
  
  if (!best || score < best.score) {
    best = {
      strategy: strategy.name,
      toExclude,
      count,
      dollar,
      countDiff,
      dollarDiff,
      countAccuracy,
      dollarAccuracy,
      combinedAccuracy,
      score
    };
  }
  
  console.log(`${strategy.name}:`);
  console.log(`  Count: ${count} (diff: ${countDiff}, ${countAccuracy.toFixed(2)}% accurate)`);
  console.log(`  Dollar: $${dollar.toLocaleString()} (diff: $${dollarDiff.toLocaleString()}, ${dollarAccuracy.toFixed(2)}% accurate)`);
  console.log(`  Combined: ${combinedAccuracy.toFixed(2)}% accurate\n`);
});

console.log('='.repeat(60));
console.log('✅ BEST STRATEGY:', best.strategy);
console.log(`   Count: ${best.count} (${best.countAccuracy.toFixed(2)}% accurate)`);
console.log(`   Dollar: $${best.dollar.toLocaleString()} (${best.dollarAccuracy.toFixed(2)}% accurate)`);
console.log(`   Combined: ${best.combinedAccuracy.toFixed(2)}% accurate\n`);

// Analyze the best exclusion set
console.log('📊 Analysis of excluded estimates:');
const byDivision = {};
best.toExclude.forEach(est => {
  const div = est.division || 'Unknown';
  byDivision[div] = (byDivision[div] || 0) + 1;
});

console.log('\nBy Division:');
Object.entries(byDivision)
  .sort((a, b) => b[1] - a[1])
  .forEach(([div, count]) => {
    console.log(`  ${div}: ${count}`);
  });

const zeroHours = best.toExclude.filter(e => e.hours === 0).length;
const lowPrice = best.toExclude.filter(e => e.price < 1000).length;
const maintenance = best.toExclude.filter(e => e.division.includes('Maintenance')).length;

console.log(`\nCharacteristics:`);
console.log(`  Zero hours: ${zeroHours}`);
console.log(`  Price < $1,000: ${lowPrice}`);
console.log(`  Maintenance division: ${maintenance}`);

// Export
const csv = [
  ['Estimate ID', 'Division', 'Price', 'Hours', 'Price/Hour', 'Reason'],
  ...best.toExclude.map(est => [
    est.id,
    est.division,
    est.price,
    est.hours || '',
    est.pph ? est.pph.toFixed(2) : '',
    est.hours === 0 ? 'Zero hours' : 
    est.price < 1000 ? 'Low price' :
    est.division.includes('Maintenance') ? 'Maintenance division' : 'Other'
  ])
].map(row => row.join(',')).join('\n');

writeFileSync('exact_26_exclusions.csv', csv);
console.log(`\n✅ Wrote exact_26_exclusions.csv`);

