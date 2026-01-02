#!/usr/bin/env node

/**
 * Diagnostic script to test the Contacts Export parser
 * Usage: node test-contacts-parser.js [path-to-contacts-file.xlsx]
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';
// Note: We'll just inspect the file structure, not test the parser directly

// Get file path from command line or use default
const filePath = process.argv[2] || join(process.cwd(), 'downloads', 'Contacts Export.xlsx');

console.log('🔍 Testing Contacts Export Parser\n');
console.log(`📁 File: ${filePath}\n`);

if (!existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  console.log('\nUsage: node test-contacts-parser.js [path-to-contacts-file.xlsx]');
  process.exit(1);
}

try {
  // Read the Excel file
  console.log('📖 Reading Excel file...');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  console.log(`✅ Loaded sheet "${sheetName}" with ${rows.length} rows\n`);
  
  // Show headers
  const headers = rows[0];
  console.log('📋 Column Headers:');
  console.log('='.repeat(60));
  headers.forEach((header, index) => {
    if (header) {
      console.log(`${index.toString().padStart(3)}: "${header}"`);
    }
  });
  console.log('='.repeat(60));
  console.log();
  
  // Find CRM and name-related columns
  const crmColumns = headers
    .map((h, i) => ({ name: h, index: i }))
    .filter(({ name }) => name && name.toString().toLowerCase().includes('crm'));
  
  const nameColumns = headers
    .map((h, i) => ({ name: h, index: i }))
    .filter(({ name }) => name && (name.toString().toLowerCase().includes('name') || name.toString().toLowerCase().includes('account')));
  
  console.log('🏢 CRM-related columns:');
  if (crmColumns.length > 0) {
    crmColumns.forEach(({ name, index }) => {
      console.log(`  ${index}: "${name}"`);
      // Show sample values
      const sampleValues = [];
      for (let i = 1; i < Math.min(6, rows.length); i++) {
        const value = rows[i][index];
        if (value !== null && value !== undefined && value !== '') {
          sampleValues.push(value);
        }
      }
      if (sampleValues.length > 0) {
        console.log(`    Sample values: ${sampleValues.slice(0, 3).join(', ')}${sampleValues.length > 3 ? '...' : ''}`);
      }
    });
  } else {
    console.log('  (none found)');
  }
  console.log();
  
  console.log('📛 Name-related columns:');
  if (nameColumns.length > 0) {
    nameColumns.forEach(({ name, index }) => {
      console.log(`  ${index}: "${name}"`);
      // Show sample values
      const sampleValues = [];
      for (let i = 1; i < Math.min(6, rows.length); i++) {
        const value = rows[i][index];
        if (value !== null && value !== undefined && value !== '') {
          sampleValues.push(value);
        }
      }
      if (sampleValues.length > 0) {
        console.log(`    Sample values: ${sampleValues.slice(0, 3).join(', ')}${sampleValues.length > 3 ? '...' : ''}`);
      }
    });
  } else {
    console.log('  (none found)');
  }
  console.log();
  
  // Check what the parser is looking for
  console.log('🔍 Parser Requirements:');
  console.log('  - Looking for: "CRM ID" (case-insensitive, alternatives: Crm Id, crm id, CRM_ID, CrmId)');
  console.log('  - Looking for: "CRM Name" (case-insensitive, alternatives: Crm Name, crm name, CRM_NAME, CrmName, Account Name, account name)');
  console.log();
  
  // Check if required columns exist
  const crmIdIndex = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'crm id');
  const crmNameIndex = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'crm name');
  const accountNameIndex = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'account name');
  
  console.log('✅ Column Detection:');
  if (crmIdIndex >= 0) {
    console.log(`  ✅ Found "CRM ID" at index ${crmIdIndex}`);
  } else {
    console.log(`  ❌ "CRM ID" not found`);
  }
  
  if (crmNameIndex >= 0) {
    console.log(`  ✅ Found "CRM Name" at index ${crmNameIndex}`);
  } else if (accountNameIndex >= 0) {
    console.log(`  ✅ Found "Account Name" at index ${accountNameIndex} (will be used as CRM Name)`);
  } else {
    console.log(`  ❌ "CRM Name" or "Account Name" not found`);
  }
  
  if (crmIdIndex >= 0 && (crmNameIndex >= 0 || accountNameIndex >= 0)) {
    console.log(`\n✅ Parser should work correctly with this file!`);
  } else {
    console.log(`\n❌ Parser will fail - missing required columns`);
    console.log(`\n💡 Suggestion: Check if column names have extra spaces or different casing`);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}

