// Test script to analyze CSV accuracy
const fs = require('fs');

// Read the CSV file
const csvPath = '/Users/joshua/Downloads/Estimate Test - Sheet1.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Simple CSV parser (handles quoted fields)
function parseCSV(text) {
  const lines = text.split('\n');
  const result = [];
  
  for (let line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  
  return result;
}

const rows = parseCSV(csvContent);
const headers = rows[0];

// Find column indices
const statusIndex = headers.indexOf('Status');
const pipelineStatusIndex = headers.indexOf('Sales Pipeline Status');
const totalPriceIndex = headers.indexOf('Total Price');
const contactNameIndex = headers.indexOf('Contact Name');

console.log('\n📊 CSV ACCURACY ANALYSIS\n');
console.log('='.repeat(60));

// Count unique statuses
const statusCounts = {};
const pipelineStatusCounts = {};
const combinedStatusCounts = {};

let totalRows = 0;
let validRows = 0;
let rowsWithPrice = 0;
let rowsWithContact = 0;

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (row.length < 20) continue;
  
  totalRows++;
  
  const status = row[statusIndex] || '';
  const pipelineStatus = row[pipelineStatusIndex] || '';
  const totalPrice = row[totalPriceIndex] || '';
  const contactName = row[contactNameIndex] || '';
  
  // Count statuses
  if (status) {
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  if (pipelineStatus) {
    pipelineStatusCounts[pipelineStatus] = (pipelineStatusCounts[pipelineStatus] || 0) + 1;
  }
  
  const combined = `${status} | ${pipelineStatus}`;
  combinedStatusCounts[combined] = (combinedStatusCounts[combined] || 0) + 1;
  
  if (contactName && contactName.trim()) rowsWithContact++;
  if (totalPrice && totalPrice !== '$0.00') rowsWithPrice++;
  if (contactName && totalPrice !== '$0.00') validRows++;
}

console.log(`\n📈 BASIC STATS:`);
console.log(`Total Rows: ${totalRows}`);
console.log(`Rows with Contact Name: ${rowsWithContact}`);
console.log(`Rows with Price > $0: ${rowsWithPrice}`);
console.log(`Valid Estimate Rows: ${validRows}`);

console.log(`\n\n📋 UNIQUE "Status" VALUES (${Object.keys(statusCounts).length} total):`);
console.log('-'.repeat(60));
Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([status, count]) => {
    console.log(`  ${count.toString().padStart(4)} | ${status || '(empty)'}`);
  });

console.log(`\n\n🎯 UNIQUE "Sales Pipeline Status" VALUES (${Object.keys(pipelineStatusCounts).length} total):`);
console.log('-'.repeat(60));
Object.entries(pipelineStatusCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([status, count]) => {
    console.log(`  ${count.toString().padStart(4)} | ${status || '(empty)'}`);
  });

console.log(`\n\n🔗 COMBINED STATUS PATTERNS:`);
console.log('-'.repeat(60));
Object.entries(combinedStatusCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([combined, count]) => {
    console.log(`  ${count.toString().padStart(4)} | ${combined}`);
  });

// Test our mapping function
function mapStatus(status, pipelineStatus) {
  const pipeline = (pipelineStatus || '').toLowerCase();
  if (pipeline === 'sold') return 'won';
  if (pipeline === 'lost') return 'lost';
  if (pipeline === 'pending') return 'pending';
  
  const stat = (status || '').toLowerCase();
  
  if (
    stat.includes('contract signed') ||
    stat.includes('contract award') ||
    stat.includes('sold') ||
    stat.includes('email contract') ||
    stat.includes('verbal contract')
  ) {
    return 'won';
  }
  
  if (stat.includes('lost') || stat.includes('estimate lost')) {
    return 'lost';
  }
  
  if (
    stat.includes('in progress') ||
    stat.includes('pending') ||
    stat === ''
  ) {
    return 'pending';
  }
  
  return 'pending';
}

// Test mapping accuracy
const mappingResults = { won: 0, lost: 0, pending: 0, unmapped: 0 };

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (row.length < 20) continue;
  
  const status = row[statusIndex] || '';
  const pipelineStatus = row[pipelineStatusIndex] || '';
  const contactName = row[contactNameIndex] || '';
  const totalPrice = row[totalPriceIndex] || '';
  
  if (!contactName || totalPrice === '$0.00') continue;
  
  const mapped = mapStatus(status, pipelineStatus);
  if (mapped) {
    mappingResults[mapped]++;
  } else {
    mappingResults.unmapped++;
  }
}

console.log(`\n\n✅ MAPPING ACCURACY TEST:`);
console.log('-'.repeat(60));
console.log(`Won:     ${mappingResults.won.toString().padStart(4)} estimates`);
console.log(`Lost:    ${mappingResults.lost.toString().padStart(4)} estimates`);
console.log(`Pending: ${mappingResults.pending.toString().padStart(4)} estimates`);
console.log(`\nTotal Mapped: ${mappingResults.won + mappingResults.lost + mappingResults.pending}`);
console.log(`Unmapped:     ${mappingResults.unmapped}`);

const wonRate = ((mappingResults.won / (mappingResults.won + mappingResults.lost)) * 100).toFixed(1);
console.log(`\n📊 OVERALL WIN RATE: ${wonRate}%`);

console.log('\n' + '='.repeat(60));
console.log('✅ Analysis Complete!\n');
























