#!/usr/bin/env node

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Find Estimates List file
const downloadsPath = join(homedir(), 'Downloads');
const possibleFiles = [
  'Estimates List.xlsx',
  'Estimates List (1).xlsx',
  'Estimates List (2).xlsx',
  'Estimates List (3).xlsx',
];

let filePath = null;
for (const fileName of possibleFiles) {
  const fullPath = join(downloadsPath, fileName);
  if (existsSync(fullPath)) {
    filePath = fullPath;
    break;
  }
}

if (!filePath) {
  console.log('❌ Could not find Estimates List file');
  process.exit(1);
}

console.log(`📖 Reading: ${filePath}\n`);

const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 });

if (rows.length < 2) {
  console.log('❌ File is empty or invalid');
  process.exit(1);
}

const headers = rows[0];
const statusIndex = headers.findIndex(h => h === 'Status');
const contractEndIndex = headers.findIndex(h => h === 'Contract End');
const estimateIdIndex = headers.findIndex(h => h === 'Estimate ID');

if (statusIndex < 0 || contractEndIndex < 0) {
  console.log('❌ Required columns not found');
  process.exit(1);
}

// Parse won statuses (same logic as parser)
const isWonStatus = (status) => {
  if (!status) return false;
  const stat = String(status).toLowerCase().trim();
  return (
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
  );
};

// Parse date
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string') {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return null;
};

let totalRows = 0;
let wonEstimates = 0;
let wonWithContractEnd = 0;
let wonWithoutContractEnd = 0;
const wonWithoutContractEndExamples = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  totalRows++;
  const status = row[statusIndex];
  const contractEnd = row[contractEndIndex];
  const estimateId = row[estimateIdIndex];
  
  if (isWonStatus(status)) {
    wonEstimates++;
    const parsedContractEnd = parseDate(contractEnd);
    
    if (parsedContractEnd) {
      wonWithContractEnd++;
    } else {
      wonWithoutContractEnd++;
      if (wonWithoutContractEndExamples.length < 10) {
        wonWithoutContractEndExamples.push({
          estimateId: estimateId || 'N/A',
          status: status || 'N/A',
          contractEndRaw: contractEnd || 'empty',
          contractEndParsed: parsedContractEnd
        });
      }
    }
  }
}

console.log('══════════════════════════════════════════════════');
console.log('📊 WON ESTIMATES CONTRACT END ANALYSIS');
console.log('══════════════════════════════════════════════════\n');
console.log(`Total rows: ${totalRows}`);
console.log(`Won estimates: ${wonEstimates}`);
console.log(`Won estimates WITH contract_end: ${wonWithContractEnd}`);
console.log(`Won estimates WITHOUT contract_end: ${wonWithoutContractEnd}\n`);

if (wonWithoutContractEnd > 0) {
  console.log(`⚠️  ${wonWithoutContractEnd} won estimates are missing contract_end dates!`);
  console.log(`\n   Examples (first 10):`);
  wonWithoutContractEndExamples.forEach((ex, i) => {
    console.log(`   ${i + 1}. Estimate ID: ${ex.estimateId}`);
    console.log(`      Status: ${ex.status}`);
    console.log(`      Contract End (raw): ${ex.contractEndRaw}`);
    console.log(`      Contract End (parsed): ${ex.contractEndParsed || 'null'}`);
    console.log('');
  });
}

if (wonWithContractEnd === 0 && wonEstimates > 0) {
  console.log('\n❌ PROBLEM: NONE of the won estimates have contract_end dates!');
  console.log('   This explains why there are no at-risk accounts.');
  console.log('   The Excel file has won estimates, but they don\'t have Contract End dates filled in.');
} else if (wonWithContractEnd > 0) {
  console.log(`\n✅ ${wonWithContractEnd} won estimates have contract_end dates`);
  console.log('   These should be imported and used for at-risk calculations.');
  if (wonWithoutContractEnd > 0) {
    console.log(`   However, ${wonWithoutContractEnd} won estimates are missing contract_end dates.`);
  }
}

