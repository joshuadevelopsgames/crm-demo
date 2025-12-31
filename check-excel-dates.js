#!/usr/bin/env node

/**
 * Check actual date values in Estimates List Excel file
 * This helps identify date format issues
 */

import XLSX from 'xlsx';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const downloadsPath = join(homedir(), 'Downloads');
const filePath = join(downloadsPath, 'Estimates List (3).xlsx');

if (!existsSync(filePath)) {
  console.error('❌ File not found:', filePath);
  process.exit(1);
}

console.log('📋 Checking date values in Estimates List (3).xlsx...\n');

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Read as array of arrays
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    defval: null,
    raw: true // Keep raw values to see Excel serial dates
  });
  
  if (rows.length < 2) {
    console.log('⚠️  File has no data rows');
    process.exit(1);
  }
  
  const headers = rows[0];
  const estimateDateIndex = headers.findIndex(h => h === 'Estimate Date');
  const estimateCloseDateIndex = headers.findIndex(h => h === 'Estimate Close Date');
  
  console.log(`Found columns:`);
  console.log(`  Estimate Date: index ${estimateDateIndex}`);
  console.log(`  Estimate Close Date: index ${estimateCloseDateIndex}\n`);
  
  // Check first 20 rows with data
  console.log('Sample date values (first 20 rows with data):\n');
  let rowCount = 0;
  
  for (let i = 1; i < rows.length && rowCount < 20; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const estimateId = row[headers.findIndex(h => h === 'Estimate ID')];
    if (!estimateId) continue;
    
    const estimateDate = row[estimateDateIndex];
    const estimateCloseDate = row[estimateCloseDateIndex];
    
    console.log(`Row ${i + 1} (Estimate ID: ${estimateId}):`);
    console.log(`  Estimate Date: ${estimateDate} (type: ${typeof estimateDate})`);
    if (typeof estimateDate === 'number') {
      // Excel serial date
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + (estimateDate - 1) * 24 * 60 * 60 * 1000);
      console.log(`    → Parsed as: ${date.toISOString().split('T')[0]}`);
    }
    console.log(`  Estimate Close Date: ${estimateCloseDate} (type: ${typeof estimateCloseDate})`);
    if (typeof estimateCloseDate === 'number') {
      // Excel serial date
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + (estimateCloseDate - 1) * 24 * 60 * 60 * 1000);
      console.log(`    → Parsed as: ${date.toISOString().split('T')[0]}`);
    }
    console.log('');
    
    rowCount++;
  }
  
  // Count how many have dates vs null
  let hasEstimateDate = 0;
  let hasEstimateCloseDate = 0;
  let totalRows = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const estimateId = row[headers.findIndex(h => h === 'Estimate ID')];
    if (!estimateId) continue;
    
    totalRows++;
    if (row[estimateDateIndex] != null && row[estimateDateIndex] !== '') {
      hasEstimateDate++;
    }
    if (row[estimateCloseDateIndex] != null && row[estimateCloseDateIndex] !== '') {
      hasEstimateCloseDate++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Total estimates: ${totalRows}`);
  console.log(`  With Estimate Date: ${hasEstimateDate} (${((hasEstimateDate / totalRows) * 100).toFixed(1)}%)`);
  console.log(`  With Estimate Close Date: ${hasEstimateCloseDate} (${((hasEstimateCloseDate / totalRows) * 100).toFixed(1)}%)`);
  console.log(`  Missing both dates: ${totalRows - hasEstimateDate - hasEstimateCloseDate + (totalRows - hasEstimateDate - hasEstimateCloseDate === totalRows ? 0 : 0)}`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

