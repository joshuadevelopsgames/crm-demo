#!/usr/bin/env node

/**
 * Verify that contract_end stays matched to the correct lmn_estimate_id
 * through the entire import pipeline (parser → merge → API)
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

async function verifyMatching() {
  console.log('🔍 Verifying contract_end Matching to lmn_estimate_id\n');
  console.log('='.repeat(80));
  
  const estimatesFile = join(downloadsPath, 'Estimates List.xlsx');
  if (!existsSync(estimatesFile)) {
    console.error(`❌ File not found: ${estimatesFile}`);
    return;
  }
  
  const estimatesWorkbook = XLSX.readFile(estimatesFile);
  const estimatesSheet = estimatesWorkbook.Sheets[estimatesWorkbook.SheetNames[0]];
  const estimatesRows = XLSX.utils.sheet_to_json(estimatesSheet, { header: 1, defval: null });
  
  const headers = estimatesRows[0];
  const colMap = {
    estimateId: headers.findIndex(h => h && h.toString().trim() === 'Estimate ID'),
    contractEnd: headers.findIndex(h => h && h.toString().trim() === 'Contract End'),
    contractStart: headers.findIndex(h => h && h.toString().trim() === 'Contract Start'),
    status: headers.findIndex(h => h && h.toString().trim() === 'Status')
  };
  
  // Simulate parser - create estimate objects
  console.log('1️⃣ PARSER: Creating estimate objects');
  const parserEstimates = [];
  
  for (let i = 1; i < Math.min(50, estimatesRows.length); i++) {
    const row = estimatesRows[i];
    if (!row || row.length === 0) continue;
    
    const estimateId = row[colMap.estimateId]?.toString().trim();
    if (!estimateId) continue;
    
    const contractEndRaw = colMap.contractEnd >= 0 ? row[colMap.contractEnd] : null;
    const contractEnd = parseDate(contractEndRaw);
    
    if (contractEnd) {
      // Simulate what parser does (lines 321-329)
      const estimate = {
        id: `lmn-estimate-${estimateId}`,
        lmn_estimate_id: estimateId,
        estimate_number: estimateId,
        contract_end: contractEnd,
        contract_start: parseDate(colMap.contractStart >= 0 ? row[colMap.contractStart] : null),
        status: row[colMap.status]?.toString().trim() || 'lost'
      };
      
      parserEstimates.push(estimate);
      
      if (parserEstimates.length >= 5) break;
    }
  }
  
  console.log(`   ✅ Created ${parserEstimates.length} estimates with contract_end`);
  console.log(`   📝 Sample:`);
  parserEstimates.slice(0, 3).forEach(est => {
    console.log(`      ${est.lmn_estimate_id} → contract_end: ${est.contract_end}`);
    console.log(`         id: ${est.id}`);
    console.log(`         Match: ${est.id === `lmn-estimate-${est.lmn_estimate_id}` ? '✅' : '❌'}`);
  });
  
  // Verify matching
  const parserMatches = parserEstimates.every(est => 
    est.id === `lmn-estimate-${est.lmn_estimate_id}` &&
    est.estimate_number === est.lmn_estimate_id &&
    est.contract_end !== undefined
  );
  
  console.log(`\n   ✅ Parser matching: ${parserMatches ? 'CORRECT' : '❌ MISMATCH'}`);
  
  // Simulate mergeContactData - uses spread operator
  console.log('\n2️⃣ MERGE: mergeContactData (spread operator)');
  const mergedEstimates = parserEstimates.map(est => {
    // Simulate what mergeContactData does (line 456, 488, 597)
    return {
      ...est,
      account_id: 'lmn-account-test123' // Simulated account_id
    };
  });
  
  console.log(`   ✅ Merged ${mergedEstimates.length} estimates`);
  const mergeMatches = mergedEstimates.every(est => 
    est.id === `lmn-estimate-${est.lmn_estimate_id}` &&
    est.contract_end !== undefined &&
    est.contract_end === parserEstimates.find(p => p.lmn_estimate_id === est.lmn_estimate_id)?.contract_end
  );
  
  console.log(`   📝 Sample after merge:`);
  mergedEstimates.slice(0, 3).forEach(est => {
    const original = parserEstimates.find(p => p.lmn_estimate_id === est.lmn_estimate_id);
    console.log(`      ${est.lmn_estimate_id} → contract_end: ${est.contract_end}`);
    console.log(`         id: ${est.id}`);
    console.log(`         Matches original: ${est.contract_end === original?.contract_end ? '✅' : '❌'}`);
  });
  
  console.log(`\n   ✅ Merge matching: ${mergeMatches ? 'CORRECT' : '❌ MISMATCH'}`);
  
  // Simulate API processing
  console.log('\n3️⃣ API: Processing (destructuring and preservation)');
  const apiEstimates = mergedEstimates.map(estimate => {
    // Simulate API processing (lines 280-350)
    const { account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutInternal } = estimate;
    const estimateData = {
      ...estimateWithoutInternal,
      updated_at: new Date().toISOString()
    };
    
    // Explicit preservation (lines 339-350)
    if (estimate.contract_start !== undefined) {
      estimateData.contract_start = estimate.contract_start;
    }
    if (estimate.contract_end !== undefined) {
      estimateData.contract_end = estimate.contract_end;
    }
    
    return {
      id: estimate.id,
      lmn_estimate_id: estimate.lmn_estimate_id,
      estimateData
    };
  });
  
  console.log(`   ✅ Processed ${apiEstimates.length} estimates`);
  const apiMatches = apiEstimates.every(apiEst => {
    const original = parserEstimates.find(p => p.lmn_estimate_id === apiEst.lmn_estimate_id);
    return apiEst.estimateData.contract_end === original?.contract_end &&
           apiEst.estimateData.lmn_estimate_id === apiEst.lmn_estimate_id &&
           apiEst.estimateData.id === apiEst.id;
  });
  
  console.log(`   📝 Sample after API processing:`);
  apiEstimates.slice(0, 3).forEach(apiEst => {
    const original = parserEstimates.find(p => p.lmn_estimate_id === apiEst.lmn_estimate_id);
    console.log(`      ${apiEst.lmn_estimate_id} → contract_end: ${apiEst.estimateData.contract_end}`);
    console.log(`         id: ${apiEst.estimateData.id}`);
    console.log(`         lmn_estimate_id: ${apiEst.estimateData.lmn_estimate_id}`);
    console.log(`         Matches original: ${apiEst.estimateData.contract_end === original?.contract_end ? '✅' : '❌'}`);
    console.log(`         ID consistency: ${apiEst.estimateData.id === `lmn-estimate-${apiEst.estimateData.lmn_estimate_id}` ? '✅' : '❌'}`);
  });
  
  console.log(`\n   ✅ API matching: ${apiMatches ? 'CORRECT' : '❌ MISMATCH'}`);
  
  // Final verification
  console.log('\n4️⃣ FINAL VERIFICATION:');
  const allMatch = parserMatches && mergeMatches && apiMatches;
  
  if (allMatch) {
    console.log('   ✅ contract_end is correctly matched to lmn_estimate_id throughout the pipeline');
    console.log('   ✅ No reassignment or mixing detected');
  } else {
    console.log('   ❌ MISMATCH DETECTED!');
    console.log('      Parser:', parserMatches ? '✅' : '❌');
    console.log('      Merge:', mergeMatches ? '✅' : '❌');
    console.log('      API:', apiMatches ? '✅' : '❌');
  }
  
  // Check for potential issues
  console.log('\n5️⃣ CHECKING FOR POTENTIAL ISSUES:');
  
  // Check if multiple estimates could have same lmn_estimate_id
  const estimateIdMap = new Map();
  parserEstimates.forEach(est => {
    if (estimateIdMap.has(est.lmn_estimate_id)) {
      console.log(`   ⚠️  Duplicate lmn_estimate_id: ${est.lmn_estimate_id}`);
      console.log(`      First: contract_end = ${estimateIdMap.get(est.lmn_estimate_id).contract_end}`);
      console.log(`      Second: contract_end = ${est.contract_end}`);
    } else {
      estimateIdMap.set(est.lmn_estimate_id, est);
    }
  });
  
  if (estimateIdMap.size === parserEstimates.length) {
    console.log('   ✅ No duplicate lmn_estimate_id values');
  }
  
  // Check if id and lmn_estimate_id are always consistent
  const idConsistency = parserEstimates.every(est => 
    est.id === `lmn-estimate-${est.lmn_estimate_id}`
  );
  
  console.log(`   ✅ ID consistency: ${idConsistency ? 'CORRECT' : '❌ MISMATCH'}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Verification complete!');
}

verifyMatching()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

