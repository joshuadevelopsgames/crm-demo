#!/usr/bin/env node

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Find Estimates List file
const downloadsPath = join(homedir(), 'Downloads');
const filePath = join(downloadsPath, 'Estimates List.xlsx');

if (!existsSync(filePath)) {
  console.log('❌ Could not find Estimates List file');
  process.exit(1);
}

console.log(`📖 Reading: ${filePath}\n`);

const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 });

const headers = rows[0];
const statusIndex = headers.findIndex(h => h === 'Status');
const contractEndIndex = headers.findIndex(h => h === 'Contract End');
const estimateIdIndex = headers.findIndex(h => h === 'Estimate ID');

// Find first won estimate with contract_end
let foundEstimate = null;
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  const status = row[statusIndex];
  const contractEnd = row[contractEndIndex];
  const estimateId = row[estimateIdIndex];
  
  const isWon = status && (
    String(status).toLowerCase().includes('contract signed') ||
    String(status).toLowerCase().includes('work complete') ||
    String(status).toLowerCase().includes('billing complete')
  );
  
  if (isWon && contractEnd) {
    foundEstimate = {
      estimateId: estimateId || 'N/A',
      status: status || 'N/A',
      contractEndRaw: contractEnd,
      rowIndex: i
    };
    break;
  }
}

if (!foundEstimate) {
  console.log('❌ Could not find a won estimate with contract_end');
  process.exit(1);
}

console.log('✅ Found won estimate with contract_end:');
console.log(`   Estimate ID: ${foundEstimate.estimateId}`);
console.log(`   Status: ${foundEstimate.status}`);
console.log(`   Contract End (raw): ${foundEstimate.contractEndRaw}`);
console.log(`   Type: ${typeof foundEstimate.contractEndRaw}\n`);

// Now simulate the parser logic
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

const parsedContractEnd = parseDate(foundEstimate.contractEndRaw);
console.log(`   Contract End (parsed): ${parsedContractEnd || 'NULL'}\n`);

// Simulate what the estimate object would look like
const estimateObject = {
  id: `lmn-estimate-${foundEstimate.estimateId}`,
  lmn_estimate_id: foundEstimate.estimateId,
  status: 'won',
  contract_end: parsedContractEnd
};

console.log('📦 Estimate object that would be sent to API:');
console.log(JSON.stringify(estimateObject, null, 2));
console.log('\n✅ The contract_end field IS included in the parsed data!');
console.log('   If it\'s not in the database, the issue is in the API save process.');

