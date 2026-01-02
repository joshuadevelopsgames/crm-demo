/**
 * Comprehensive script to check all parsers and identify missing fields
 * Compares what's in Excel files vs what parsers extract
 */

import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find Excel files
const findFile = (filename) => {
  const possiblePaths = [
    join(homedir(), 'Downloads', filename),
    join(__dirname, filename),
    join(__dirname, 'downloads', filename),
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
};

const files = {
  estimates: findFile('Estimates List.xlsx'),
  contacts: findFile('Contacts Export.xlsx'),
  leads: findFile('Leads List.xlsx') || findFile('Leads.xlsx') || findFile('Leads (2).xlsx'),
  jobsites: findFile('Jobsite Export.xlsx') || findFile('Jobsite Export (1).xlsx')
};

console.log('🔍 Checking all parser fields...\n');

// Function to get all headers from an Excel file
function getHeaders(filePath) {
  if (!filePath) return null;
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    return rows[0] || [];
  } catch (e) {
    return null;
  }
}

// Expected fields from parsers
const parserFields = {
  estimates: [
    'Estimate Type', 'Estimate ID', 'Estimate Date', 'Estimate Close Date',
    'Contract Start', 'Contract End', 'Project Name', 'Version', 'Contact Name',
    'CRM Tags', 'Contact ID', 'Address', 'Billing Address', 'Phone 1', 'Phone 2',
    'Email', 'Salesperson', 'Estimator', 'Status', 'Sales Pipeline Status',
    'Proposal First Shared', 'Proposal Last Shared', 'Proposal Last Updated',
    'Division', 'Referral', 'Ref. Note', 'Confidence Level', 'Archived',
    'Exclude Stats', 'Material Cost', 'Material Price', 'Labor Cost', 'Labor Price',
    'Labor Hours', 'Equipment Cost', 'Equipment Price', 'Other Costs', 'Other Price',
    'Sub Costs', 'Sub Price', 'Total Price', 'Total Price With Tax', 'Total Cost',
    'Total Overhead', 'Breakeven', 'Total Profit', 'Predicted Sales'
  ],
  contacts: [
    'CRM ID', 'Contact ID', 'CRM Name', 'Type', 'PrimaryContact', 'First Name',
    'Last Name', 'Address 1', 'Address 2', 'City', 'State', 'Zip', 'Country',
    'Phone 1', 'Phone 2', 'Email 1', 'Email 2', 'Notes', 'Tags', 'Archived',
    'Classification'
  ],
  leads: [
    'Lead Name', 'First Name', 'Last Name', 'Position', 'Address 1', 'Address 2',
    'City', 'State', 'Zip', 'Country', 'Phone 1', 'Phone 2', 'Email 1', 'Email 2',
    'Notes', 'Type', 'Created', 'Classification', 'DoNotEmail', 'DoNotMail',
    'DoNotCall', 'CustomClientID', 'ReferralSource'
  ],
  jobsites: [
    'Contact ID', 'Contact Name', 'Jobsite ID', 'Jobsite Name', 'Address 1',
    'Address 2', 'City', 'Province', 'Postal Code', 'Country', 'Notes'
  ]
};

// Check each file
for (const [fileType, filePath] of Object.entries(files)) {
  console.log('='.repeat(80));
  console.log(`📄 ${fileType.toUpperCase()} - ${filePath ? 'Found' : 'NOT FOUND'}`);
  console.log('='.repeat(80));
  
  if (!filePath) {
    console.log(`   ⚠️  File not found: ${fileType}\n`);
    continue;
  }
  
  const headers = getHeaders(filePath);
  if (!headers) {
    console.log(`   ❌ Could not read headers\n`);
    continue;
  }
  
  console.log(`   Total columns in file: ${headers.length}`);
  console.log(`   Expected by parser: ${parserFields[fileType].length}`);
  console.log('');
  
  // Find missing expected fields
  const missingExpected = parserFields[fileType].filter(expected => {
    return !headers.some(h => h && h.toString().trim() === expected);
  });
  
  if (missingExpected.length > 0) {
    console.log('   ⚠️  Expected fields NOT found in file:');
    missingExpected.forEach(field => {
      console.log(`      - ${field}`);
    });
    console.log('');
  }
  
  // Find extra fields in file that parser doesn't extract
  const extraFields = headers.filter(h => {
    if (!h) return false;
    const header = h.toString().trim();
    return !parserFields[fileType].includes(header);
  });
  
  if (extraFields.length > 0) {
    console.log('   📋 Extra fields in file (NOT being parsed):');
    extraFields.forEach(field => {
      console.log(`      - ${field}`);
    });
    console.log('');
  } else {
    console.log('   ✅ All fields in file are being parsed\n');
  }
  
  // Show all headers for reference
  console.log('   📝 All headers in file:');
  headers.forEach((h, i) => {
    if (h) {
      const isParsed = parserFields[fileType].includes(h.toString().trim());
      const marker = isParsed ? '✅' : '❌';
      console.log(`      ${i.toString().padStart(3)}: ${marker} "${h}"`);
    }
  });
  console.log('');
}

console.log('='.repeat(80));
console.log('📊 SUMMARY');
console.log('='.repeat(80));
console.log('Fields marked with ❌ are in the Excel file but NOT being parsed.');
console.log('These fields are being lost during import.');
console.log('='.repeat(80));

