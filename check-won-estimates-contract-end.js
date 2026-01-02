/**
 * Check won estimates and their contract_end dates in the Excel file
 * This helps determine if the issue is missing data in Excel or parser not reading it
 */

import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find Excel file
const excelPath = join(homedir(), 'Downloads', 'Estimates List.xlsx');

if (!existsSync(excelPath)) {
  console.error('❌ Could not find "Estimates List.xlsx" in Downloads');
  process.exit(1);
}

console.log('📖 Reading Excel file...');
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

console.log(`✅ Read ${rows.length} rows from "${sheetName}"\n`);

const headers = rows[0] || [];

// Find column indices
const statusIndex = headers.findIndex(h => h && h.toString().trim() === 'Status');
const contractEndIndex = headers.findIndex(h => h && h.toString().trim() === 'Contract End');
const estimateIdIndex = headers.findIndex(h => h && h.toString().trim() === 'Estimate ID');

if (statusIndex === -1 || contractEndIndex === -1 || estimateIdIndex === -1) {
  console.error('❌ Required columns not found');
  console.error(`   Status: ${statusIndex >= 0 ? '✅' : '❌'}`);
  console.error(`   Contract End: ${contractEndIndex >= 0 ? '✅' : '❌'}`);
  console.error(`   Estimate ID: ${estimateIdIndex >= 0 ? '✅' : '❌'}`);
  process.exit(1);
}

console.log('📊 Analyzing won estimates and contract_end dates...\n');

let totalRows = 0;
let wonEstimates = 0;
let wonWithContractEnd = 0;
let wonWithoutContractEnd = 0;
const wonStatuses = [
  'email contract award',
  'verbal contract award',
  'work complete',
  'work in progress',
  'billing complete',
  'contract signed',
  'contract in progress',
  'contract + billing complete'
];

const sampleWonWithoutContractEnd = [];
const sampleWonWithContractEnd = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  totalRows++;
  
  const status = row[statusIndex]?.toString().trim().toLowerCase() || '';
  const estimateId = row[estimateIdIndex]?.toString().trim() || '';
  const contractEnd = row[contractEndIndex];
  
  // Check if it's a won status
  const isWon = wonStatuses.some(wonStatus => status.includes(wonStatus));
  
  if (isWon && estimateId) {
    wonEstimates++;
    
    // Check if contract_end has a value
    const hasContractEnd = contractEnd !== null && 
                           contractEnd !== undefined && 
                           contractEnd !== '' &&
                           !(typeof contractEnd === 'string' && contractEnd.trim() === '');
    
    if (hasContractEnd) {
      wonWithContractEnd++;
      if (sampleWonWithContractEnd.length < 5) {
        sampleWonWithContractEnd.push({
          estimateId,
          status: row[statusIndex],
          contractEnd,
          contractEndType: typeof contractEnd
        });
      }
    } else {
      wonWithoutContractEnd++;
      if (sampleWonWithoutContractEnd.length < 10) {
        sampleWonWithoutContractEnd.push({
          estimateId,
          status: row[statusIndex],
          contractEnd,
          contractEndType: typeof contractEnd,
          contractEndIsNull: contractEnd === null,
          contractEndIsUndefined: contractEnd === undefined,
          contractEndIsEmpty: contractEnd === ''
        });
      }
    }
  }
}

console.log('='.repeat(80));
console.log('📊 RESULTS');
console.log('='.repeat(80));
console.log(`Total rows processed: ${totalRows}`);
console.log(`Won estimates: ${wonEstimates}`);
console.log(`Won estimates WITH contract_end: ${wonWithContractEnd} (${((wonWithContractEnd / wonEstimates) * 100).toFixed(1)}%)`);
console.log(`Won estimates WITHOUT contract_end: ${wonWithoutContractEnd} (${((wonWithoutContractEnd / wonEstimates) * 100).toFixed(1)}%)`);
console.log('');

if (sampleWonWithContractEnd.length > 0) {
  console.log('✅ Sample won estimates WITH contract_end:');
  sampleWonWithContractEnd.forEach((est, i) => {
    console.log(`\n   ${i + 1}. ${est.estimateId}:`);
    console.log(`      Status: ${est.status}`);
    console.log(`      Contract End: ${est.contractEnd} (${est.contractEndType})`);
  });
  console.log('');
}

if (sampleWonWithoutContractEnd.length > 0) {
  console.log('❌ Sample won estimates WITHOUT contract_end:');
  sampleWonWithoutContractEnd.forEach((est, i) => {
    console.log(`\n   ${i + 1}. ${est.estimateId}:`);
    console.log(`      Status: ${est.status}`);
    console.log(`      Contract End value: ${est.contractEnd}`);
    console.log(`      Contract End type: ${est.contractEndType}`);
    console.log(`      Is null: ${est.contractEndIsNull}`);
    console.log(`      Is undefined: ${est.contractEndIsUndefined}`);
    console.log(`      Is empty string: ${est.contractEndIsEmpty}`);
  });
  console.log('');
}

console.log('='.repeat(80));
console.log('📋 CONCLUSION');
console.log('='.repeat(80));
if (wonWithoutContractEnd === 0) {
  console.log('✅ All won estimates have contract_end dates in Excel');
  console.log('   If dates aren\'t saving, the issue is in the parser or API.');
} else {
  console.log(`⚠️  ${wonWithoutContractEnd} won estimates are missing contract_end in Excel`);
  console.log('   This is expected - not all won estimates have contract end dates.');
  console.log('   The warning is informational, not an error.');
  console.log('');
  console.log('   To reduce the warning, you can:');
  console.log('   1. Add contract_end dates to won estimates in LMN');
  console.log('   2. Adjust the warning threshold in the parser');
  console.log('   3. Accept that some won estimates won\'t have contract_end dates');
}
