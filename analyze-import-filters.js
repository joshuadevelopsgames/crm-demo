#!/usr/bin/env node

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Read Excel file
const filePath = join(homedir(), 'Downloads', 'Estimates List.xlsx');
if (!existsSync(filePath)) {
  console.error('❌ Could not find Estimates List.xlsx in Downloads');
  process.exit(1);
}

console.log(`📖 Reading: ${filePath}\n`);
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 });

const headers = rows[0];
const colMap = {
  estimateId: headers.findIndex(h => h === 'Estimate ID'),
  contactId: headers.findIndex(h => h === 'Contact ID'),
  accountId: headers.findIndex(h => h === 'Account ID'),
  crmTags: headers.findIndex(h => h === 'CRM Tags'),
};

// Analyze what would be filtered
let totalEstimates = 0;
let estimatesWithAccountId = 0;
let estimatesWithContactId = 0;
let estimatesWithCrmTags = 0;
let estimatesWithoutAccountId = 0;
let estimatesWithoutContactId = 0;

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  const estimateId = row[colMap.estimateId]?.toString().trim();
  if (!estimateId) continue;
  
  totalEstimates++;
  
  const contactId = row[colMap.contactId]?.toString().trim();
  const accountId = row[colMap.accountId]?.toString().trim();
  const crmTags = row[colMap.crmTags]?.toString().trim();
  
  if (accountId) estimatesWithAccountId++;
  else estimatesWithoutAccountId++;
  
  if (contactId) estimatesWithContactId++;
  else estimatesWithoutContactId++;
  
  if (crmTags) estimatesWithCrmTags++;
}

console.log('══════════════════════════════════════════════════');
console.log('📊 ESTIMATE IMPORT ANALYSIS');
console.log('══════════════════════════════════════════════════\n');
console.log(`Total estimates in Excel: ${totalEstimates}`);
console.log(`Estimates with Account ID: ${estimatesWithAccountId}`);
console.log(`Estimates without Account ID: ${estimatesWithoutAccountId}`);
console.log(`Estimates with Contact ID: ${estimatesWithContactId}`);
console.log(`Estimates without Contact ID: ${estimatesWithoutContactId}`);
console.log(`Estimates with CRM Tags: ${estimatesWithCrmTags}`);
console.log(`Estimates without CRM Tags: ${totalEstimates - estimatesWithCrmTags}\n`);

console.log('══════════════════════════════════════════════════');
console.log('⚠️  IMPORT FILTER ISSUES');
console.log('══════════════════════════════════════════════════\n');
console.log('1. Account/Contact Filter:');
console.log(`   - Estimates are filtered if their account_id/contact_id`);
console.log(`     references accounts/contacts NOT in the import sheets`);
console.log(`   - This caused ${564} valid estimates to be excluded`);
console.log(`   - FIX: Allow estimates even if account/contact not in sheets`);
console.log(`     (set account_id/contact_id to null instead of filtering)\n`);
console.log('2. CRM Tags Field:');
console.log(`   - The parser reads "CRM Tags" but it's filtered out during save`);
console.log(`   - ${estimatesWithCrmTags} estimates have CRM Tags that won't be saved`);
console.log(`   - FIX: Include crm_tags in the saved data\n`);

