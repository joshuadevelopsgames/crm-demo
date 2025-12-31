#!/usr/bin/env node

/**
 * Check exact column names in Excel import files
 * This helps identify column name mismatches
 */

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const downloadsPath = join(homedir(), 'Downloads');

const files = [
  'Estimates List (3).xlsx',
  'Leads (5).xlsx',
  'Contacts Export (4).xlsx',
  'Jobsite Export (3).xlsx'
];

console.log('📋 Checking column names in Excel import files...\n');

files.forEach(fileName => {
  const filePath = join(downloadsPath, fileName);
  
  if (!existsSync(filePath)) {
    console.log(`❌ ${fileName}: File not found`);
    return;
  }
  
  try {
    console.log(`\n📄 ${fileName}:`);
    console.log('═'.repeat(60));
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Read first row as headers
    const rows = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '',
      raw: false 
    });
    
    if (rows.length === 0) {
      console.log('  ⚠️  File is empty');
      return;
    }
    
    const headers = rows[0];
    console.log(`  Total columns: ${headers.length}`);
    console.log(`  Sheet name: ${sheetName}\n`);
    
    // Show all column names
    console.log('  Column names:');
    headers.forEach((header, index) => {
      if (header) {
        console.log(`    [${index}] "${header}"`);
      } else {
        console.log(`    [${index}] (empty)`);
      }
    });
    
    // Check for date-related columns
    console.log('\n  Date-related columns:');
    const dateKeywords = ['date', 'Date', 'DATE', 'created', 'Created', 'close', 'Close', 'start', 'Start', 'end', 'End'];
    const dateColumns = headers
      .map((h, i) => ({ name: h, index: i }))
      .filter(({ name }) => dateKeywords.some(keyword => name && name.includes(keyword)));
    
    if (dateColumns.length > 0) {
      dateColumns.forEach(({ name, index }) => {
        console.log(`    [${index}] "${name}"`);
      });
    } else {
      console.log('    (none found)');
    }
    
    // Check for estimate date specifically
    console.log('\n  Looking for estimate date columns:');
    const estimateDateVariations = [
      'Estimate Date',
      'EstimateDate',
      'Estimate Created Date',
      'Date Created',
      'Created Date',
      'Estimate Close Date',
      'EstimateCloseDate',
      'Close Date',
      'Closed Date'
    ];
    
    estimateDateVariations.forEach(variation => {
      const index = headers.findIndex(h => h === variation);
      if (index !== -1) {
        console.log(`    ✅ Found "${variation}" at index ${index}`);
      }
    });
    
  } catch (error) {
    console.error(`  ❌ Error reading ${fileName}:`, error.message);
  }
});

console.log('\n✅ Column check complete!\n');
