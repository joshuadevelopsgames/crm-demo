/**
 * Standalone test script to debug date parsing in the estimates parser
 * Run: node test-parser-dates-debug.js
 */

import { parseEstimatesList } from './src/utils/lmnEstimatesListParser.js';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to find the Excel file
const possiblePaths = [
  join(homedir(), 'Downloads', 'Estimates List.xlsx'),
  join(__dirname, 'Estimates List.xlsx'),
  join(__dirname, 'downloads', 'Estimates List.xlsx'),
];

let excelPath = null;
for (const path of possiblePaths) {
  try {
    readFileSync(path);
    excelPath = path;
    console.log(`✅ Found Excel file: ${path}\n`);
    break;
  } catch (e) {
    // File not found, try next path
  }
}

if (!excelPath) {
  console.error('❌ Could not find "Estimates List.xlsx"');
  console.error('   Tried paths:');
  possiblePaths.forEach(p => console.error(`     - ${p}`));
  console.error('\n   Please ensure the file is in one of these locations.');
  process.exit(1);
}

// Read the Excel file
console.log('📖 Reading Excel file...');
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

console.log(`✅ Read ${rows.length} rows from "${sheetName}"\n`);

// Get headers
const headers = rows[0] || [];
console.log('📋 Column Headers:');
headers.forEach((h, i) => {
  if (h) {
    console.log(`   ${i}: "${h}"`);
  }
});
console.log('');

// Find date-related columns
const dateColumns = headers
  .map((h, i) => ({ name: h, index: i }))
  .filter(({ name }) => name && name.toString().toLowerCase().includes('date'));

console.log('📅 Date-related columns found:');
dateColumns.forEach(({ name, index }) => {
  console.log(`   ${index}: "${name}"`);
});
console.log('');

// Check what the parser will see
console.log('🔍 Checking data format for parser...');
console.log(`   Rows type: ${Array.isArray(rows) ? 'array' : typeof rows}`);
console.log(`   First row type: ${Array.isArray(rows[0]) ? 'array' : typeof rows[0]}`);
console.log(`   First row length: ${rows[0] ? rows[0].length : 'N/A'}`);
console.log(`   First row sample: ${rows[0] ? rows[0].slice(0, 5).join(', ') : 'N/A'}`);
console.log(`   Second row (first data row) sample: ${rows[1] ? rows[1].slice(0, 5).join(', ') : 'N/A'}`);
console.log('');

// Manually check what the parser would do with first data row
if (rows.length > 1) {
  const testRow = rows[1];
  const headers = rows[0];
  const estimateIdIndex = headers.findIndex(h => h && h.toString().trim() === 'Estimate ID');
  console.log('🔍 Manual parser check on first data row:');
  console.log(`   Estimate ID column index: ${estimateIdIndex}`);
  console.log(`   Estimate ID value: "${testRow[estimateIdIndex]}" (${typeof testRow[estimateIdIndex]})`);
  console.log(`   Estimate ID truthy check: ${!!testRow[estimateIdIndex]}`);
  console.log(`   Estimate ID trimmed: "${testRow[estimateIdIndex]?.toString().trim()}"`);
  console.log('');
}

// Run the parser
console.log('🔍 Running parser...\n');
console.log('Note: Parser logs will appear above...\n');
const result = parseEstimatesList(rows);

console.log('='.repeat(80));
console.log('📊 PARSER RESULTS');
console.log('='.repeat(80));
console.log('Parser returned:', typeof result);
console.log('Result keys:', result ? Object.keys(result) : 'null/undefined');

if (!result || !result.estimates) {
  console.error('❌ Parser did not return expected format');
  console.error('Expected: { estimates: [], errors: [] }');
  console.error('Got:', result);
  process.exit(1);
}

console.log(`Total estimates parsed: ${result.estimates.length}`);
console.log(`Errors: ${result.errors ? result.errors.length : 0}`);
console.log(`Stats:`, JSON.stringify(result.stats, null, 2));

if (result.errors && result.errors.length > 0) {
  console.log('\n⚠️  Parser Errors (first 10):');
  result.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
}

if (result.estimates.length === 0) {
  console.log('\n❌ WARNING: No estimates were parsed!');
  console.log('   This could mean:');
  console.log('   1. All rows are being filtered out');
  console.log('   2. Estimate IDs are missing');
  console.log('   3. There\'s an issue with the parser logic');
  console.log('\n   Checking first few data rows...');
  for (let i = 1; i < Math.min(6, rows.length); i++) {
    const row = rows[i];
    const estId = row[1]; // Estimate ID is column 1
    console.log(`   Row ${i + 1}: Estimate ID = "${estId}" (${typeof estId})`);
  }
}

console.log('');

// Analyze date fields
console.log('📅 DATE FIELD ANALYSIS');
console.log('='.repeat(80));

const dateStats = {
  hasEstimateDate: 0,
  hasContractStart: 0,
  hasContractEnd: 0,
  hasEstimateCloseDate: 0,
  hasAllDates: 0,
  hasNoDates: 0,
  sampleWithDates: [],
  sampleWithoutDates: []
};

result.estimates.forEach((est, idx) => {
  const hasEstDate = !!est.estimate_date;
  const hasContractStart = !!est.contract_start;
  const hasContractEnd = !!est.contract_end;
  const hasEstCloseDate = !!est.estimate_close_date;
  
  if (hasEstDate) dateStats.hasEstimateDate++;
  if (hasContractStart) dateStats.hasContractStart++;
  if (hasContractEnd) dateStats.hasContractEnd++;
  if (hasEstCloseDate) dateStats.hasEstimateCloseDate++;
  
  if (hasEstDate && hasContractStart && hasContractEnd) {
    dateStats.hasAllDates++;
    if (dateStats.sampleWithDates.length < 5) {
      dateStats.sampleWithDates.push(est);
    }
  }
  
  if (!hasEstDate && !hasContractStart && !hasContractEnd) {
    dateStats.hasNoDates++;
    if (dateStats.sampleWithoutDates.length < 5) {
      dateStats.sampleWithoutDates.push(est);
    }
  }
});

console.log(`Estimates with estimate_date: ${dateStats.hasEstimateDate} (${((dateStats.hasEstimateDate / result.estimates.length) * 100).toFixed(1)}%)`);
console.log(`Estimates with contract_start: ${dateStats.hasContractStart} (${((dateStats.hasContractStart / result.estimates.length) * 100).toFixed(1)}%)`);
console.log(`Estimates with contract_end: ${dateStats.hasContractEnd} (${((dateStats.hasContractEnd / result.estimates.length) * 100).toFixed(1)}%)`);
console.log(`Estimates with estimate_close_date: ${dateStats.hasEstimateCloseDate} (${((dateStats.hasEstimateCloseDate / result.estimates.length) * 100).toFixed(1)}%)`);
console.log(`Estimates with ALL dates: ${dateStats.hasAllDates} (${((dateStats.hasAllDates / result.estimates.length) * 100).toFixed(1)}%)`);
console.log(`Estimates with NO dates: ${dateStats.hasNoDates} (${((dateStats.hasNoDates / result.estimates.length) * 100).toFixed(1)}%)`);
console.log('');

// Show sample estimates with dates
if (dateStats.sampleWithDates.length > 0) {
  console.log('✅ Sample estimates WITH dates:');
  dateStats.sampleWithDates.forEach((est, i) => {
    console.log(`\n   ${i + 1}. ${est.lmn_estimate_id || est.id}:`);
    console.log(`      estimate_date: ${est.estimate_date}`);
    console.log(`      contract_start: ${est.contract_start}`);
    console.log(`      contract_end: ${est.contract_end}`);
    console.log(`      estimate_close_date: ${est.estimate_close_date}`);
  });
  console.log('');
}

// Show sample estimates without dates
if (dateStats.sampleWithoutDates.length > 0) {
  console.log('❌ Sample estimates WITHOUT dates:');
  dateStats.sampleWithoutDates.forEach((est, i) => {
    console.log(`\n   ${i + 1}. ${est.lmn_estimate_id || est.id}:`);
    console.log(`      estimate_date: ${est.estimate_date} (${typeof est.estimate_date})`);
    console.log(`      contract_start: ${est.contract_start} (${typeof est.contract_start})`);
    console.log(`      contract_end: ${est.contract_end} (${typeof est.contract_end})`);
    console.log(`      estimate_close_date: ${est.estimate_close_date} (${typeof est.estimate_close_date})`);
  });
  console.log('');
}

// Check specific estimates mentioned in user's logs
const problematicIds = ['EST3405651', 'EST3386982', 'EST3387003', 'EST3387047', 'EST3387052'];
console.log('🔍 Checking specific problematic estimates:');
console.log('='.repeat(80));
problematicIds.forEach(id => {
  const est = result.estimates.find(e => e.lmn_estimate_id === id || e.id === id);
  if (est) {
    console.log(`\n${id}:`);
    console.log(`   estimate_date: ${est.estimate_date} (${typeof est.estimate_date})`);
    console.log(`   contract_start: ${est.contract_start} (${typeof est.contract_start})`);
    console.log(`   contract_end: ${est.contract_end} (${typeof est.contract_end})`);
    console.log(`   estimate_close_date: ${est.estimate_close_date} (${typeof est.estimate_close_date})`);
    
    // Try to find the row in the Excel file
    const rowIndex = rows.findIndex(row => {
      const estId = row[0] || row[1] || row[2]; // Try first few columns
      return estId && estId.toString().trim() === id;
    });
    
    if (rowIndex >= 0) {
      const row = rows[rowIndex];
      console.log(`   Found in Excel at row ${rowIndex + 1}:`);
      console.log(`   Row data (first 20 columns):`, row.slice(0, 20).map((v, i) => `${i}: ${v}`).join(', '));
      
      // Check date columns
      dateColumns.forEach(({ name, index }) => {
        const value = row[index];
        console.log(`   "${name}" (col ${index}): ${value} (${typeof value})`);
      });
    } else {
      console.log(`   ⚠️  Not found in Excel file`);
    }
  } else {
    console.log(`\n${id}: ❌ Not found in parsed estimates`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ Test complete!');
console.log('='.repeat(80));

