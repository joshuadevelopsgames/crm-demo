#!/usr/bin/env node

/**
 * Diagnose why estimates are missing dates (contract_start, contract_end, estimate_date)
 * Checks specific estimates from the screenshot
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';

const downloadsPath = join(process.env.HOME || process.env.USERPROFILE, 'Downloads');

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    // Excel date serial number
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
    if (isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00Z`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00Z`;
    }
  }
  return null;
}

async function diagnoseMissingDates() {
  console.log('🔍 Diagnosing Missing Dates in Estimates\n');
  console.log('='.repeat(80));
  
  // Estimates from screenshot that are missing dates
  const problemEstimates = [
    'EST1053033',
    'EST1053051',
    'EST1343721',
    'EST1869281'
  ];
  
  const estimatesFile = join(downloadsPath, 'Estimates List.xlsx');
  if (!existsSync(estimatesFile)) {
    console.error(`❌ File not found: ${estimatesFile}`);
    return;
  }
  
  const estimatesWorkbook = XLSX.readFile(estimatesFile);
  const estimatesSheet = estimatesWorkbook.Sheets[estimatesWorkbook.SheetNames[0]];
  const estimatesRows = XLSX.utils.sheet_to_json(estimatesSheet, { header: 1, defval: null });
  
  const headers = estimatesRows[0];
  
  // Find column indices
  const colMap = {
    estimateId: headers.findIndex(h => h && h.toString().trim() === 'Estimate ID'),
    contractStart: headers.findIndex(h => h && h.toString().trim() === 'Contract Start'),
    contractEnd: headers.findIndex(h => h && h.toString().trim() === 'Contract End'),
    estimateDate: headers.findIndex(h => h && h.toString().trim() === 'Estimate Date'),
    status: headers.findIndex(h => h && h.toString().trim() === 'Status')
  };
  
  console.log('📋 Column Mapping:');
  Object.entries(colMap).forEach(([key, index]) => {
    const headerName = key === 'estimateId' ? 'Estimate ID' :
                      key === 'contractStart' ? 'Contract Start' :
                      key === 'contractEnd' ? 'Contract End' :
                      key === 'estimateDate' ? 'Estimate Date' :
                      key === 'status' ? 'Status' : key;
    console.log(`   ${headerName}: column ${index} ${index >= 0 ? '✅' : '❌'}`);
  });
  
  if (colMap.estimateId < 0) {
    console.error('❌ Estimate ID column not found!');
    return;
  }
  
  console.log('\n🔍 Checking Problem Estimates:');
  
  const foundEstimates = [];
  
  // Find the problem estimates in the Excel file
  for (let i = 1; i < estimatesRows.length; i++) {
    const row = estimatesRows[i];
    if (!row || row.length === 0) continue;
    
    const estimateId = row[colMap.estimateId]?.toString().trim();
    if (!estimateId || !problemEstimates.includes(estimateId)) continue;
    
    const contractStartRaw = colMap.contractStart >= 0 ? row[colMap.contractStart] : null;
    const contractEndRaw = colMap.contractEnd >= 0 ? row[colMap.contractEnd] : null;
    const estimateDateRaw = colMap.estimateDate >= 0 ? row[colMap.estimateDate] : null;
    const status = colMap.status >= 0 ? row[colMap.status]?.toString().trim() : '';
    
    const contractStart = parseDate(contractStartRaw);
    const contractEnd = parseDate(contractEndRaw);
    const estimateDate = parseDate(estimateDateRaw);
    
    foundEstimates.push({
      estimateId,
      rowNumber: i + 1,
      contractStartRaw,
      contractStart,
      contractEndRaw,
      contractEnd,
      estimateDateRaw,
      estimateDate,
      status,
      hasAnyDate: !!(contractStart || contractEnd || estimateDate)
    });
  }
  
  if (foundEstimates.length === 0) {
    console.log('   ⚠️  None of the problem estimates found in Excel file');
    console.log('   This might mean they were already imported or the file has changed');
  } else {
    foundEstimates.forEach(est => {
      console.log(`\n   📝 ${est.estimateId} (Row ${est.rowNumber}):`);
      console.log(`      Status: ${est.status || 'N/A'}`);
      console.log(`      Contract Start:`);
      console.log(`         Raw: ${est.contractStartRaw} (type: ${typeof est.contractStartRaw})`);
      console.log(`         Parsed: ${est.contractStart || 'null'}`);
      console.log(`      Contract End:`);
      console.log(`         Raw: ${est.contractEndRaw} (type: ${typeof est.contractEndRaw})`);
      console.log(`         Parsed: ${est.contractEnd || 'null'}`);
      console.log(`      Estimate Date:`);
      console.log(`         Raw: ${est.estimateDateRaw} (type: ${typeof est.estimateDateRaw})`);
      console.log(`         Parsed: ${est.estimateDate || 'null'}`);
      console.log(`      Has Any Date: ${est.hasAnyDate ? '✅' : '❌'}`);
      
      if (!est.hasAnyDate) {
        console.log(`      ⚠️  ISSUE: No dates found in Excel for this estimate!`);
      }
    });
  }
  
  // Check overall statistics
  console.log('\n📊 Overall Statistics:');
  let totalEstimates = 0;
  let estimatesWithContractStart = 0;
  let estimatesWithContractEnd = 0;
  let estimatesWithEstimateDate = 0;
  let estimatesWithAnyDate = 0;
  let estimatesWithoutAnyDate = 0;
  
  for (let i = 1; i < Math.min(1000, estimatesRows.length); i++) {
    const row = estimatesRows[i];
    if (!row || row.length === 0) continue;
    
    const estimateId = row[colMap.estimateId]?.toString().trim();
    if (!estimateId) continue;
    
    totalEstimates++;
    
    const contractStartRaw = colMap.contractStart >= 0 ? row[colMap.contractStart] : null;
    const contractEndRaw = colMap.contractEnd >= 0 ? row[colMap.contractEnd] : null;
    const estimateDateRaw = colMap.estimateDate >= 0 ? row[colMap.estimateDate] : null;
    
    const contractStart = parseDate(contractStartRaw);
    const contractEnd = parseDate(contractEndRaw);
    const estimateDate = parseDate(estimateDateRaw);
    
    if (contractStart) estimatesWithContractStart++;
    if (contractEnd) estimatesWithContractEnd++;
    if (estimateDate) estimatesWithEstimateDate++;
    
    if (contractStart || contractEnd || estimateDate) {
      estimatesWithAnyDate++;
    } else {
      estimatesWithoutAnyDate++;
    }
  }
  
  console.log(`   Total estimates checked: ${totalEstimates}`);
  console.log(`   With Contract Start: ${estimatesWithContractStart} (${(estimatesWithContractStart/totalEstimates*100).toFixed(1)}%)`);
  console.log(`   With Contract End: ${estimatesWithContractEnd} (${(estimatesWithContractEnd/totalEstimates*100).toFixed(1)}%)`);
  console.log(`   With Estimate Date: ${estimatesWithEstimateDate} (${(estimatesWithEstimateDate/totalEstimates*100).toFixed(1)}%)`);
  console.log(`   With Any Date: ${estimatesWithAnyDate} (${(estimatesWithAnyDate/totalEstimates*100).toFixed(1)}%)`);
  console.log(`   Without Any Date: ${estimatesWithoutAnyDate} (${(estimatesWithoutAnyDate/totalEstimates*100).toFixed(1)}%)`);
  
  // Check if parseDate function matches the parser
  console.log('\n🔍 Testing parseDate Function:');
  const testValues = [
    { name: 'Excel number', value: 45292 }, // Example Excel date serial
    { name: 'Date string', value: '2024-01-15' },
    { name: 'Empty string', value: '' },
    { name: 'Null', value: null },
    { name: 'Undefined', value: undefined },
    { name: 'Invalid string', value: 'invalid' }
  ];
  
  testValues.forEach(test => {
    const result = parseDate(test.value);
    console.log(`   ${test.name}: ${JSON.stringify(test.value)} → ${result || 'null'}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Diagnosis complete!');
  
  if (estimatesWithoutAnyDate > 0) {
    console.log(`\n⚠️  Found ${estimatesWithoutAnyDate} estimates without any dates in Excel file`);
    console.log('   This could be:');
    console.log('   1. Excel file has empty date columns for these estimates');
    console.log('   2. Date format is not recognized by parser');
    console.log('   3. Column names don\'t match expected format');
  }
}

diagnoseMissingDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

