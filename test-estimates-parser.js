#!/usr/bin/env node

/**
 * Diagnostic script to test the Estimates List parser
 * Usage: node test-estimates-parser.js [path-to-estimates-file.xlsx]
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';
import { parseEstimatesList } from './src/utils/lmnEstimatesListParser.js';

// Get file path from command line or use default
const filePath = process.argv[2] || join(process.cwd(), 'downloads', 'Estimates List.xlsx');

console.log('🔍 Testing Estimates List Parser\n');
console.log(`📁 File: ${filePath}\n`);

if (!existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  console.log('\nUsage: node test-estimates-parser.js [path-to-estimates-file.xlsx]');
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
  
  // Find date-related columns
  const dateColumns = headers
    .map((h, i) => ({ name: h, index: i }))
    .filter(({ name }) => name && name.toString().toLowerCase().includes('date'));
  
  console.log('📅 Date-related columns:');
  if (dateColumns.length > 0) {
    dateColumns.forEach(({ name, index }) => {
      console.log(`  ${index}: "${name}"`);
      
      // Show sample values from this column
      const sampleValues = [];
      for (let i = 1; i < Math.min(6, rows.length); i++) {
        const value = rows[i][index];
        if (value !== null && value !== undefined && value !== '') {
          sampleValues.push(value);
        }
      }
      if (sampleValues.length > 0) {
        console.log(`    Sample values: ${sampleValues.slice(0, 3).join(', ')}${sampleValues.length > 3 ? '...' : ''}`);
      } else {
        console.log(`    (all empty in first 5 rows)`);
      }
    });
  } else {
    console.log('  (none found)');
  }
  console.log();
  
  // Test the parser
  console.log('🧪 Testing parser...');
  console.log('='.repeat(60));
  const result = parseEstimatesList(rows);
  
  console.log(`\n✅ Parser completed`);
  console.log(`📊 Results:`);
  console.log(`  - Total estimates: ${result.estimates.length}`);
  console.log(`  - Estimates with estimate_date: ${result.estimates.filter(e => e.estimate_date).length}`);
  console.log(`  - Estimates without estimate_date: ${result.estimates.filter(e => !e.estimate_date).length}`);
  console.log(`  - Estimates with contract_start: ${result.estimates.filter(e => e.contract_start).length}`);
  console.log(`  - Estimates with contract_end: ${result.estimates.filter(e => e.contract_end).length}`);
  
  if (result.errors && result.errors.length > 0) {
    console.log(`\n⚠️  Errors/Warnings (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }
  
  // Analyze empty values in Estimate Date column
  if (colMap.estimateDate >= 0) {
    let emptyCount = 0;
    let nonEmptyCount = 0;
    const sampleEmptyRows = [];
    const sampleNonEmptyRows = [];
    
    for (let i = 1; i < rows.length; i++) {
      const value = rows[i][colMap.estimateDate];
      if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
        emptyCount++;
        if (sampleEmptyRows.length < 5) {
          const estimateId = rows[i][colMap.estimateId]?.toString().trim() || `Row ${i + 1}`;
          sampleEmptyRows.push({ row: i + 1, estimateId, value, valueType: typeof value });
        }
      } else {
        nonEmptyCount++;
        if (sampleNonEmptyRows.length < 3) {
          const estimateId = rows[i][colMap.estimateId]?.toString().trim() || `Row ${i + 1}`;
          sampleNonEmptyRows.push({ row: i + 1, estimateId, value, valueType: typeof value });
        }
      }
    }
    
    console.log(`\n📊 Estimate Date Column Analysis:`);
    console.log(`  - Total rows: ${rows.length - 1}`);
    console.log(`  - Rows with data: ${nonEmptyCount}`);
    console.log(`  - Rows with empty/null values: ${emptyCount}`);
    console.log(`  - Empty percentage: ${((emptyCount / (rows.length - 1)) * 100).toFixed(1)}%`);
    
    if (sampleEmptyRows.length > 0) {
      console.log(`\n  Sample empty rows:`);
      sampleEmptyRows.forEach(({ row, estimateId, value, valueType }) => {
        console.log(`    Row ${row} (${estimateId}): value="${value}" (type: ${valueType})`);
      });
    }
    
    if (sampleNonEmptyRows.length > 0) {
      console.log(`\n  Sample non-empty rows:`);
      sampleNonEmptyRows.forEach(({ row, estimateId, value, valueType }) => {
        console.log(`    Row ${row} (${estimateId}): value=${value} (type: ${valueType})`);
      });
    }
  }
  
  // Show sample estimates
  console.log(`\n📝 Sample estimates (first 5):`);
  result.estimates.slice(0, 5).forEach(est => {
    console.log(`  ${est.lmn_estimate_id}:`);
    console.log(`    estimate_date: ${est.estimate_date || '(missing)'}`);
    console.log(`    contract_start: ${est.contract_start || '(missing)'}`);
    console.log(`    contract_end: ${est.contract_end || '(missing)'}`);
    console.log(`    status: ${est.status}`);
  });
  
  // Show estimates missing estimate_date
  const missingDate = result.estimates.filter(e => !e.estimate_date);
  if (missingDate.length > 0) {
    console.log(`\n⚠️  Estimates missing estimate_date (first 10):`);
    missingDate.slice(0, 10).forEach(est => {
      console.log(`  - ${est.lmn_estimate_id} (status: ${est.status})`);
    });
    if (missingDate.length > 10) {
      console.log(`  ... and ${missingDate.length - 10} more`);
    }
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}

