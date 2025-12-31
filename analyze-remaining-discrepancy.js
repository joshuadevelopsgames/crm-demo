#!/usr/bin/env node

/**
 * Analyze Remaining Discrepancy
 * 
 * We have 99.46% accuracy but there's still a $118,625.23 difference.
 * Let's find which estimates differ between our final list and LMN's exact list.
 */

import { readFileSync } from 'fs';
import XLSX from 'xlsx';

// Read our final kept estimates (after all exclusions)
const ourKeptCsv = readFileSync('optimal_kept.csv', 'utf-8');
const exact26Csv = readFileSync('exact_26_exclusions.csv', 'utf-8');

// Parse our final list (924 estimates)
const ourFinalEstimates = new Map();
ourKeptCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [id, num, date, status, division, price, hours, pph] = line.split(',');
  if (id && id !== 'Estimate ID') {
    ourFinalEstimates.set(id, {
      id,
      price: parseFloat(price) || 0,
      division: division || '',
      hours: hours ? parseFloat(hours) : 0,
    });
  }
});

// Remove the 26 we identified for exclusion
const exact26Ids = new Set();
exact26Csv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [id] = line.split(',');
  if (id && id !== 'Estimate ID') {
    exact26Ids.add(id);
  }
});

// Our final list after excluding the 26
const ourFinal = Array.from(ourFinalEstimates.entries())
  .filter(([id]) => !exact26Ids.has(id))
  .map(([id, est]) => ({ id, ...est }));

console.log(`📊 Our Final List: ${ourFinal.length} estimates`);
const ourDollar = ourFinal.reduce((sum, est) => sum + est.price, 0);
console.log(`   Dollar: $${ourDollar.toLocaleString()}\n`);

// Read LMN's exact export
console.log('📖 Reading LMN\'s exact export...');
const lmnWorkbook = XLSX.readFile('/Users/joshua/Downloads/Estimate List - Detailed Export.xlsx');
const lmnSheet = lmnWorkbook.Sheets[lmnWorkbook.SheetNames[0]];
const lmnRows = XLSX.utils.sheet_to_json(lmnSheet, { header: 1, defval: null });

const lmnHeaders = lmnRows[0];
const estimateIdCol = lmnHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
const statusCol = lmnHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
const priceCol = lmnHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
const divisionCol = lmnHeaders.findIndex(h => h && h.includes('Division'));

// Filter to only "Sold" status
const lmnSold = [];
for (let i = 1; i < lmnRows.length; i++) {
  const row = lmnRows[i];
  if (!row || row.length === 0) continue;
  
  const status = (row[statusCol] || '').toString().toLowerCase().trim();
  if (status.includes('sold') || 
      status === 'contract signed' ||
      status === 'work complete' ||
      status === 'billing complete') {
    
    const id = normalizeId(row[estimateIdCol]);
    if (id) {
      lmnSold.push({
        id,
        price: parseMoney(row[priceCol]),
        division: (row[divisionCol] || '').toString().trim(),
      });
    }
  }
}

function normalizeId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase();
}

function parseMoney(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

console.log(`📊 LMN Sold List: ${lmnSold.length} estimates`);
const lmnDollar = lmnSold.reduce((sum, est) => sum + est.price, 0);
console.log(`   Dollar: $${lmnDollar.toLocaleString()}\n`);

// Create maps
const ourMap = new Map(ourFinal.map(est => [est.id, est]));
const lmnMap = new Map(lmnSold.map(est => [est.id, est]));

// Find differences
const weHaveButLMNExcludes = ourFinal.filter(est => !lmnMap.has(est.id));
const lmnHasButWeExclude = lmnSold.filter(est => !ourMap.has(est.id));

console.log(`🔍 Differences:`);
console.log(`   We have but LMN excludes: ${weHaveButLMNExcludes.length}`);
console.log(`   LMN has but we exclude: ${lmnHasButWeExclude.length}\n`);

// Calculate dollar impact
const ourExtraDollar = weHaveButLMNExcludes.reduce((sum, est) => sum + est.price, 0);
const lmnExtraDollar = lmnHasButWeExclude.reduce((sum, est) => sum + est.price, 0);
const netDifference = ourExtraDollar - lmnExtraDollar;

console.log(`💰 Dollar Impact:`);
console.log(`   Our extra estimates: $${ourExtraDollar.toLocaleString()}`);
console.log(`   LMN's extra estimates: $${lmnExtraDollar.toLocaleString()}`);
console.log(`   Net difference: $${netDifference.toLocaleString()}`);
console.log(`   Expected difference: $${(ourDollar - lmnDollar).toLocaleString()}\n`);

// Analyze patterns
if (weHaveButLMNExcludes.length > 0) {
  console.log(`📊 Analyzing ${weHaveButLMNExcludes.length} estimates we have but LMN excludes:\n`);
  
  const byDivision = {};
  const byPrice = [];
  
  weHaveButLMNExcludes.forEach(est => {
    const div = est.division || 'Unknown';
    byDivision[div] = (byDivision[div] || 0) + 1;
    byPrice.push(est.price);
  });
  
  console.log('By Division:');
  Object.entries(byDivision)
    .sort((a, b) => b[1] - a[1])
    .forEach(([div, count]) => {
      console.log(`  ${div}: ${count}`);
    });
  
  byPrice.sort((a, b) => a - b);
  console.log(`\nPrice Range:`);
  console.log(`  Min: $${byPrice[0]?.toLocaleString()}`);
  console.log(`  Max: $${byPrice[byPrice.length - 1]?.toLocaleString()}`);
  console.log(`  Median: $${byPrice[Math.floor(byPrice.length / 2)]?.toLocaleString()}`);
  console.log(`  Average: $${(byPrice.reduce((a, b) => a + b, 0) / byPrice.length).toLocaleString()}`);
  
  console.log(`\nExamples:`);
  weHaveButLMNExcludes.slice(0, 10).forEach(est => {
    console.log(`  ${est.id}: ${est.division}, $${est.price.toLocaleString()}`);
  });
}

if (lmnHasButWeExclude.length > 0) {
  console.log(`\n📊 Analyzing ${lmnHasButWeExclude.length} estimates LMN has but we exclude:\n`);
  
  const byDivision = {};
  const byPrice = [];
  
  lmnHasButWeExclude.forEach(est => {
    const div = est.division || 'Unknown';
    byDivision[div] = (byDivision[div] || 0) + 1;
    byPrice.push(est.price);
  });
  
  console.log('By Division:');
  Object.entries(byDivision)
    .sort((a, b) => b[1] - a[1])
    .forEach(([div, count]) => {
      console.log(`  ${div}: ${count}`);
    });
  
  byPrice.sort((a, b) => a - b);
  console.log(`\nPrice Range:`);
  console.log(`  Min: $${byPrice[0]?.toLocaleString()}`);
  console.log(`  Max: $${byPrice[byPrice.length - 1]?.toLocaleString()}`);
  console.log(`  Median: $${byPrice[Math.floor(byPrice.length / 2)]?.toLocaleString()}`);
  console.log(`  Average: $${(byPrice.reduce((a, b) => a + b, 0) / byPrice.length).toLocaleString()}`);
  
  console.log(`\nExamples:`);
  lmnHasButWeExclude.slice(0, 10).forEach(est => {
    console.log(`  ${est.id}: ${est.division}, $${est.price.toLocaleString()}`);
  });
}

// Check for price matching issues
console.log(`\n🔍 Checking for price matching issues...`);
const commonIds = Array.from(ourMap.keys()).filter(id => lmnMap.has(id));
let priceDifferences = [];
commonIds.forEach(id => {
  const ourPrice = ourMap.get(id).price;
  const lmnPrice = lmnMap.get(id).price;
  const diff = Math.abs(ourPrice - lmnPrice);
  if (diff > 0.01) { // More than 1 cent difference
    priceDifferences.push({
      id,
      ourPrice,
      lmnPrice,
      diff
    });
  }
});

if (priceDifferences.length > 0) {
  console.log(`\n💰 Found ${priceDifferences.length} estimates with price differences:`);
  priceDifferences.sort((a, b) => b.diff - a.diff);
  priceDifferences.slice(0, 10).forEach(pd => {
    console.log(`  ${pd.id}: Our $${pd.ourPrice.toLocaleString()} vs LMN $${pd.lmnPrice.toLocaleString()} (diff: $${pd.diff.toLocaleString()})`);
  });
  
  const totalPriceDiff = priceDifferences.reduce((sum, pd) => sum + pd.diff, 0);
  console.log(`\n  Total price difference from matching estimates: $${totalPriceDiff.toLocaleString()}`);
} else {
  console.log(`  ✅ All matching estimates have identical prices`);
}

