#!/usr/bin/env node

/**
 * Test the FULL import flow to find where contract_end is lost
 * Simulates exactly what happens during import
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';

const downloadsPath = join(process.env.HOME || process.env.USERPROFILE, 'Downloads');

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00Z`;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00Z`;
    }
  }
  return null;
}

async function testFullFlow() {
  console.log('🔍 Testing FULL Import Flow\n');
  console.log('='.repeat(80));
  
  // Read Estimates List
  const estimatesFile = join(downloadsPath, 'Estimates List.xlsx');
  const estimatesWorkbook = XLSX.readFile(estimatesFile);
  const estimatesSheet = estimatesWorkbook.Sheets[estimatesWorkbook.SheetNames[0]];
  const estimatesRows = XLSX.utils.sheet_to_json(estimatesSheet, { header: 1, defval: null });
  
  const headers = estimatesRows[0];
  const colMap = {
    estimateId: headers.findIndex(h => h && h.toString().trim() === 'Estimate ID'),
    contractEnd: headers.findIndex(h => h && h.toString().trim() === 'Contract End'),
    status: headers.findIndex(h => h && h.toString().trim() === 'Status'),
    contractStart: headers.findIndex(h => h && h.toString().trim() === 'Contract Start'),
    estimateDate: headers.findIndex(h => h && h.toString().trim() === 'Estimate Date')
  };
  
  // Find a won estimate with contract_end
  let testEstimate = null;
  for (let i = 1; i < estimatesRows.length; i++) {
    const row = estimatesRows[i];
    const estimateId = row[colMap.estimateId]?.toString().trim();
    const status = row[colMap.status]?.toString().trim() || '';
    const contractEndRaw = colMap.contractEnd >= 0 ? row[colMap.contractEnd] : null;
    
    const isWon = status.toLowerCase().includes('contract') || 
                 status.toLowerCase().includes('work complete') ||
                 status.toLowerCase().includes('billing complete');
    
    if (isWon && contractEndRaw && estimateId) {
      const contractEnd = parseDate(contractEndRaw);
      if (contractEnd) {
        // Simulate parser output
        testEstimate = {
          id: `lmn-estimate-${estimateId}`,
          lmn_estimate_id: estimateId,
          estimate_number: estimateId,
          contract_end: contractEnd,
          contract_start: parseDate(row[colMap.contractStart]),
          estimate_date: parseDate(row[colMap.estimateDate]),
          status: 'won',
          total_price_with_tax: 1000
        };
        break;
      }
    }
  }
  
  if (!testEstimate) {
    console.log('❌ No won estimate with contract_end found');
    return;
  }
  
  console.log('1️⃣ PARSER OUTPUT:');
  console.log(JSON.stringify({ contract_end: testEstimate.contract_end, contract_start: testEstimate.contract_start }, null, 2));
  
  // Simulate mergeContactData - uses spread operator
  console.log('\n2️⃣ AFTER mergeContactData (spread operator):');
  const mergedEstimate = {
    ...testEstimate,
    account_id: 'lmn-account-test123' // Simulated
  };
  console.log(`   contract_end: ${mergedEstimate.contract_end}`);
  console.log(`   Has contract_end: ${'contract_end' in mergedEstimate}`);
  
  // Simulate ImportLeadsDialog filter/map
  console.log('\n3️⃣ AFTER ImportLeadsDialog filter/map:');
  const filteredEstimate = mergedEstimate; // Filter doesn't change
  const mappedEstimate = {
    ...filteredEstimate,
    account_id: null // Simulating the map that sets account_id to null
  };
  console.log(`   contract_end: ${mappedEstimate.contract_end}`);
  console.log(`   Has contract_end: ${'contract_end' in mappedEstimate}`);
  console.log(`   All keys: ${Object.keys(mappedEstimate).filter(k => k.includes('contract') || k.includes('date')).join(', ')}`);
  
  // Simulate API processing - the critical part
  console.log('\n4️⃣ API PROCESSING (api/data/estimates.js):');
  console.log('   Line 277: Destructuring...');
  
  // This is the EXACT code from the API
  const { id, account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutIds } = mappedEstimate;
  const estimateData = {
    ...estimateWithoutIds,
    updated_at: new Date().toISOString()
  };
  
  console.log(`   After destructuring:`);
  console.log(`      contract_end in estimateWithoutIds: ${'contract_end' in estimateWithoutIds}`);
  console.log(`      contract_end value: ${estimateWithoutIds.contract_end}`);
  
  console.log(`   After spread into estimateData:`);
  console.log(`      contract_end in estimateData: ${'contract_end' in estimateData}`);
  console.log(`      contract_end value: ${estimateData.contract_end}`);
  
  // Check the explicit preservation code
  console.log('\n   Line 339-350: Explicit preservation...');
  if (mappedEstimate.contract_start !== undefined) {
    estimateData.contract_start = mappedEstimate.contract_start;
  } else if (mappedEstimate.contract_start === null) {
    estimateData.contract_start = null;
  }
  if (mappedEstimate.contract_end !== undefined) {
    estimateData.contract_end = mappedEstimate.contract_end;
  } else if (mappedEstimate.contract_end === null) {
    estimateData.contract_end = null;
  }
  
  console.log(`   After explicit preservation:`);
  console.log(`      contract_end: ${estimateData.contract_end}`);
  console.log(`      contract_end type: ${typeof estimateData.contract_end}`);
  
  // Check what would be sent to Supabase
  console.log('\n5️⃣ FINAL DATA (what gets sent to Supabase):');
  console.log(JSON.stringify({
    contract_end: estimateData.contract_end,
    contract_start: estimateData.contract_start,
    lmn_estimate_id: estimateData.lmn_estimate_id,
    status: estimateData.status
  }, null, 2));
  
  // Check if there are any undefined values that might cause issues
  console.log('\n6️⃣ CHECKING FOR ISSUES:');
  const hasUndefined = Object.keys(estimateData).some(k => estimateData[k] === undefined);
  const hasNullContractEnd = estimateData.contract_end === null;
  const hasUndefinedContractEnd = estimateData.contract_end === undefined;
  
  console.log(`   Has undefined values: ${hasUndefined}`);
  console.log(`   contract_end is null: ${hasNullContractEnd}`);
  console.log(`   contract_end is undefined: ${hasUndefinedContractEnd}`);
  console.log(`   contract_end truthy: ${!!estimateData.contract_end}`);
  
  if (hasUndefinedContractEnd) {
    console.log(`\n   ❌ CRITICAL: contract_end is undefined in final estimateData!`);
    console.log(`   This means it's being lost during the destructuring or spread.`);
  } else if (hasNullContractEnd) {
    console.log(`\n   ⚠️  contract_end is null (might be expected if Excel had no value)`);
  } else {
    console.log(`\n   ✅ contract_end is present and should be saved`);
  }
  
  console.log('\n' + '='.repeat(80));
}

testFullFlow()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

