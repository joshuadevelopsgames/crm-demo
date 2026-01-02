#!/usr/bin/env node

/**
 * Simple trace of contract_end - reads Excel directly and checks each step
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

async function traceContractEnd() {
  console.log('🔍 Tracing contract_end Through Import Pipeline\n');
  console.log('='.repeat(80));
  
  // Step 1: Read Excel directly
  console.log('\n1️⃣ EXCEL FILE: Reading Estimates List.xlsx');
  const estimatesFile = join(downloadsPath, 'Estimates List.xlsx');
  if (!existsSync(estimatesFile)) {
    console.error(`❌ File not found: ${estimatesFile}`);
    return;
  }
  
  const estimatesWorkbook = XLSX.readFile(estimatesFile);
  const estimatesSheet = estimatesWorkbook.Sheets[estimatesWorkbook.SheetNames[0]];
  const estimatesRows = XLSX.utils.sheet_to_json(estimatesSheet, { header: 1, defval: null });
  
  const headers = estimatesRows[0];
  const estimateIdIndex = headers.findIndex(h => h && h.toString().trim() === 'Estimate ID');
  const contractEndIndex = headers.findIndex(h => h && h.toString().trim() === 'Contract End');
  const statusIndex = headers.findIndex(h => h && h.toString().trim() === 'Status');
  
  console.log(`   Headers found: Estimate ID=${estimateIdIndex}, Contract End=${contractEndIndex}, Status=${statusIndex}`);
  
  // Find won estimates with contract_end
  const wonWithContractEnd = [];
  for (let i = 1; i < Math.min(100, estimatesRows.length); i++) {
    const row = estimatesRows[i];
    const estimateId = row[estimateIdIndex]?.toString().trim();
    const status = row[statusIndex]?.toString().trim() || '';
    const contractEndRaw = contractEndIndex >= 0 ? row[contractEndIndex] : null;
    
    const isWon = status.toLowerCase().includes('contract') || 
                 status.toLowerCase().includes('work complete') ||
                 status.toLowerCase().includes('billing complete');
    
    if (isWon && contractEndRaw && estimateId) {
      const contractEnd = parseDate(contractEndRaw);
      if (contractEnd) {
        wonWithContractEnd.push({
          estimateId,
          contractEndRaw,
          contractEnd,
          status
        });
        if (wonWithContractEnd.length >= 5) break;
      }
    }
  }
  
  if (wonWithContractEnd.length === 0) {
    console.log('   ⚠️  No won estimates with contract_end found in first 100 rows');
    return;
  }
  
  const testEstimate = wonWithContractEnd[0];
  console.log(`\n   📝 Sample won estimate with contract_end:`);
  console.log(`      Estimate ID: ${testEstimate.estimateId}`);
  console.log(`      Contract End (raw): ${testEstimate.contractEndRaw} (type: ${typeof testEstimate.contractEndRaw})`);
  console.log(`      Contract End (parsed): ${testEstimate.contractEnd}`);
  console.log(`      Status: ${testEstimate.status}`);
  
  // Step 2: Simulate parser output
  console.log('\n2️⃣ PARSER OUTPUT: What parseEstimatesList would return');
  const parserOutput = {
    lmn_estimate_id: testEstimate.estimateId,
    contract_end: testEstimate.contractEnd,
    status: 'won'
  };
  console.log(`   📝 Parser would return:`);
  console.log(`      contract_end: ${parserOutput.contract_end}`);
  console.log(`      contract_end type: ${typeof parserOutput.contract_end}`);
  console.log(`      Has contract_end: ${!!parserOutput.contract_end}`);
  
  // Step 3: Check mergeContactData - does it preserve contract_end?
  console.log('\n3️⃣ MERGE: Checking mergeContactData behavior');
  console.log('   mergeContactData uses spread operator: { ...estimate }');
  console.log('   This SHOULD preserve contract_end');
  
  const mergedEstimate = {
    ...parserOutput,
    account_id: 'lmn-account-test123' // Simulated account_id from merge
  };
  
  console.log(`   📝 After merge (simulated):`);
  console.log(`      contract_end: ${mergedEstimate.contract_end}`);
  console.log(`      contract_end type: ${typeof mergedEstimate.contract_end}`);
  console.log(`      Has contract_end: ${!!mergedEstimate.contract_end}`);
  console.log(`      contract_end === original: ${mergedEstimate.contract_end === parserOutput.contract_end}`);
  
  // Step 4: Check ImportLeadsDialog filter/map
  console.log('\n4️⃣ IMPORT DIALOG: Checking filter/map operations');
  console.log('   Filter: Only filters if lmn_estimate_id is missing - should preserve contract_end');
  console.log('   Map: Uses spread { ...est, account_id: null } - should preserve contract_end');
  
  const filteredEstimate = mergedEstimate; // Filter doesn't change the object
  const mappedEstimate = {
    ...filteredEstimate,
    account_id: null // Simulating the map transformation
  };
  
  console.log(`   📝 After filter/map (simulated):`);
  console.log(`      contract_end: ${mappedEstimate.contract_end}`);
  console.log(`      contract_end type: ${typeof mappedEstimate.contract_end}`);
  console.log(`      Has contract_end: ${!!mappedEstimate.contract_end}`);
  
  // Step 5: Check API payload
  console.log('\n5️⃣ API PAYLOAD: What gets sent to /api/data/estimates');
  const apiPayload = {
    action: 'bulk_upsert',
    data: {
      estimates: [mappedEstimate],
      lookupField: 'lmn_estimate_id'
    }
  };
  
  const payloadEstimate = apiPayload.data.estimates[0];
  console.log(`   📝 In API payload:`);
  console.log(`      contract_end: ${payloadEstimate.contract_end}`);
  console.log(`      contract_end type: ${typeof payloadEstimate.contract_end}`);
  console.log(`      JSON: ${JSON.stringify({ contract_end: payloadEstimate.contract_end })}`);
  
  // Step 6: Check API processing
  console.log('\n6️⃣ API PROCESSING: What happens in api/data/estimates.js');
  console.log('   Line 277: const { id, account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutIds } = estimate;');
  console.log('   This destructuring SHOULD preserve contract_end (it\'s not in the destructured list)');
  
  const { id, account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutIds } = payloadEstimate;
  
  console.log(`   📝 After destructuring:`);
  console.log(`      contract_end in estimateWithoutIds: ${'contract_end' in estimateWithoutIds}`);
  console.log(`      contract_end value: ${estimateWithoutIds.contract_end}`);
  console.log(`      contract_end type: ${typeof estimateWithoutIds.contract_end}`);
  
  if (!('contract_end' in estimateWithoutIds)) {
    console.log(`   ❌ CRITICAL: contract_end was REMOVED during destructuring!`);
    console.log(`   This is the bug!`);
    return;
  }
  
  console.log('\n   Line 339-342: Explicitly preserves contract_end');
  const estimateData = {
    ...estimateWithoutIds,
    updated_at: new Date().toISOString()
  };
  
  if (payloadEstimate.contract_end !== undefined) {
    estimateData.contract_end = payloadEstimate.contract_end;
  } else if (payloadEstimate.contract_end === null) {
    estimateData.contract_end = null;
  }
  
  console.log(`   📝 Final estimateData before save:`);
  console.log(`      contract_end: ${estimateData.contract_end}`);
  console.log(`      contract_end type: ${typeof estimateData.contract_end}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Trace complete!');
  console.log('\nConclusion:');
  if (estimateData.contract_end) {
    console.log('   ✅ contract_end should be saved correctly');
    console.log('   ⚠️  If it\'s not in database, check:');
    console.log('      1. Are updates actually being executed?');
    console.log('      2. Are there any database constraints preventing the save?');
    console.log('      3. Is the update query actually running?');
  } else {
    console.log('   ❌ contract_end is being lost somewhere in the pipeline');
  }
}

traceContractEnd()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

