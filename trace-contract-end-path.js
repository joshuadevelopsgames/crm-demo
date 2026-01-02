#!/usr/bin/env node

/**
 * Comprehensive trace of contract_end through the entire import pipeline
 * This will help identify exactly where contract_end is being lost
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';
import { parseEstimatesList } from './src/utils/lmnEstimatesListParser.js';
import { mergeContactData } from './src/utils/lmnMergeData.js';
import { parseContactsExport } from './src/utils/lmnContactsExportParser.js';
import { parseLeadsList } from './src/utils/lmnLeadsListParser.js';
import { parseJobsiteExport } from './src/utils/lmnJobsiteExportParser.js';

const downloadsPath = join(process.env.HOME || process.env.USERPROFILE, 'Downloads');

async function traceContractEnd() {
  console.log('🔍 Tracing contract_end Through Entire Import Pipeline\n');
  console.log('='.repeat(80));
  
  // Step 1: Parse Estimates List
  console.log('\n1️⃣ PARSER: parseEstimatesList');
  const estimatesFile = join(downloadsPath, 'Estimates List.xlsx');
  if (!existsSync(estimatesFile)) {
    console.error(`❌ File not found: ${estimatesFile}`);
    return;
  }
  
  const estimatesWorkbook = XLSX.readFile(estimatesFile);
  const estimatesSheet = estimatesWorkbook.Sheets[estimatesWorkbook.SheetNames[0]];
  const estimatesRows = XLSX.utils.sheet_to_json(estimatesSheet, { header: 1, defval: null });
  
  const parsedEstimates = parseEstimatesList(estimatesRows);
  console.log(`   ✅ Parsed ${parsedEstimates.estimates.length} estimates`);
  
  // Find a won estimate with contract_end
  const wonWithContractEnd = parsedEstimates.estimates.find(e => 
    e.status === 'won' && e.contract_end
  );
  
  if (!wonWithContractEnd) {
    console.log('   ⚠️  No won estimates with contract_end found in parsed data');
    return;
  }
  
  console.log(`   📝 Sample estimate with contract_end:`);
  console.log(`      lmn_estimate_id: ${wonWithContractEnd.lmn_estimate_id}`);
  console.log(`      contract_end: ${wonWithContractEnd.contract_end}`);
  console.log(`      contract_end type: ${typeof wonWithContractEnd.contract_end}`);
  console.log(`      contract_start: ${wonWithContractEnd.contract_start}`);
  console.log(`      status: ${wonWithContractEnd.status}`);
  console.log(`      All keys: ${Object.keys(wonWithContractEnd).filter(k => k.includes('contract') || k.includes('date')).join(', ')}`);
  
  // Step 2: Parse other files
  console.log('\n2️⃣ PARSER: Other Files');
  const contactsFile = join(downloadsPath, 'Contacts Export.xlsx');
  const leadsFile = join(downloadsPath, 'Leads.xlsx');
  const jobsitesFile = join(downloadsPath, 'Jobsite Export (1).xlsx');
  
  const contactsWorkbook = XLSX.readFile(contactsFile);
  const contactsSheet = contactsWorkbook.Sheets[contactsWorkbook.SheetNames[0]];
  const contactsRows = XLSX.utils.sheet_to_json(contactsSheet, { header: 1, defval: null });
  const parsedContacts = parseContactsExport(contactsRows);
  
  const leadsWorkbook = XLSX.readFile(leadsFile);
  const leadsSheet = leadsWorkbook.Sheets[leadsWorkbook.SheetNames[0]];
  const leadsRows = XLSX.utils.sheet_to_json(leadsSheet, { header: 1, defval: null });
  const parsedLeads = parseLeadsList(leadsRows);
  
  const jobsitesWorkbook = XLSX.readFile(jobsitesFile);
  const jobsitesSheet = jobsitesWorkbook.Sheets[jobsitesWorkbook.SheetNames[0]];
  const jobsitesRows = XLSX.utils.sheet_to_json(jobsitesSheet, { header: 1, defval: null });
  const parsedJobsites = parseJobsiteExport(jobsitesRows);
  
  console.log(`   ✅ Parsed contacts, leads, jobsites`);
  
  // Step 3: Merge Data
  console.log('\n3️⃣ MERGE: mergeContactData');
  const merged = mergeContactData(
    parsedContacts,
    parsedLeads,
    { estimates: parsedEstimates.estimates },
    parsedJobsites
  );
  
  console.log(`   ✅ Merged ${merged.estimates.length} estimates`);
  
  // Find the same estimate after merge
  const mergedEstimate = merged.estimates.find(e => 
    e.lmn_estimate_id === wonWithContractEnd.lmn_estimate_id
  );
  
  if (!mergedEstimate) {
    console.log(`   ❌ Estimate ${wonWithContractEnd.lmn_estimate_id} NOT FOUND after merge!`);
    return;
  }
  
  console.log(`   📝 Same estimate after merge:`);
  console.log(`      lmn_estimate_id: ${mergedEstimate.lmn_estimate_id}`);
  console.log(`      contract_end: ${mergedEstimate.contract_end}`);
  console.log(`      contract_end type: ${typeof mergedEstimate.contract_end}`);
  console.log(`      contract_end === original: ${mergedEstimate.contract_end === wonWithContractEnd.contract_end}`);
  console.log(`      contract_start: ${mergedEstimate.contract_start}`);
  console.log(`      status: ${mergedEstimate.status}`);
  console.log(`      account_id: ${mergedEstimate.account_id || 'null'}`);
  console.log(`      All keys: ${Object.keys(mergedEstimate).filter(k => k.includes('contract') || k.includes('date')).join(', ')}`);
  
  if (!mergedEstimate.contract_end) {
    console.log(`   ❌ CRITICAL: contract_end was LOST during merge!`);
    console.log(`   Original had: ${wonWithContractEnd.contract_end}`);
    console.log(`   Merged has: ${mergedEstimate.contract_end || 'null/undefined'}`);
    
    // Check if it's in the object but falsy
    console.log(`   Has contract_end key: ${'contract_end' in mergedEstimate}`);
    console.log(`   contract_end value: ${JSON.stringify(mergedEstimate.contract_end)}`);
    return;
  }
  
  // Step 4: Simulate what ImportLeadsDialog does
  console.log('\n4️⃣ IMPORT DIALOG: Filtering/Transformation');
  
  // Simulate the filter (from ImportLeadsDialog.jsx line 606)
  const validEstimates = merged.estimates.filter(est => {
    const estId = est.lmn_estimate_id || est.id;
    return !!estId; // Only filter if ID is missing
  });
  
  console.log(`   ✅ Filtered to ${validEstimates.length} valid estimates`);
  
  const filteredEstimate = validEstimates.find(e => 
    e.lmn_estimate_id === wonWithContractEnd.lmn_estimate_id
  );
  
  if (!filteredEstimate) {
    console.log(`   ❌ Estimate ${wonWithContractEnd.lmn_estimate_id} NOT FOUND after filter!`);
    return;
  }
  
  console.log(`   📝 Same estimate after filter:`);
  console.log(`      contract_end: ${filteredEstimate.contract_end}`);
  console.log(`      contract_end type: ${typeof filteredEstimate.contract_end}`);
  console.log(`      contract_end === merged: ${filteredEstimate.contract_end === mergedEstimate.contract_end}`);
  
  if (!filteredEstimate.contract_end) {
    console.log(`   ❌ CRITICAL: contract_end was LOST during filter!`);
    return;
  }
  
  // Step 5: Simulate the map transformation (from ImportLeadsDialog.jsx line 660)
  console.log('\n5️⃣ IMPORT DIALOG: Map Transformation');
  
  const transformedEstimates = validEstimates.map(est => {
    // Simulate the transformation (lines 660-712)
    // This is what happens before sending to API
    return est; // For now, just return as-is to see if map itself causes issues
  });
  
  const transformedEstimate = transformedEstimates.find(e => 
    e.lmn_estimate_id === wonWithContractEnd.lmn_estimate_id
  );
  
  console.log(`   📝 Same estimate after map:`);
  console.log(`      contract_end: ${transformedEstimate.contract_end}`);
  console.log(`      contract_end type: ${typeof transformedEstimate.contract_end}`);
  
  if (!transformedEstimate.contract_end) {
    console.log(`   ❌ CRITICAL: contract_end was LOST during map transformation!`);
    return;
  }
  
  // Step 6: Check what would be sent to API
  console.log('\n6️⃣ API PAYLOAD: What gets sent');
  
  // Simulate what the API receives (from ImportLeadsDialog.jsx line 913)
  const apiPayload = {
    action: 'bulk_upsert',
    data: {
      estimates: transformedEstimates.slice(0, 1), // Just the test estimate
      lookupField: 'lmn_estimate_id'
    }
  };
  
  const payloadEstimate = apiPayload.data.estimates[0];
  console.log(`   📝 Estimate in API payload:`);
  console.log(`      contract_end: ${payloadEstimate.contract_end}`);
  console.log(`      contract_end type: ${typeof payloadEstimate.contract_end}`);
  console.log(`      JSON stringified contract_end: ${JSON.stringify(payloadEstimate.contract_end)}`);
  console.log(`      Has contract_end key: ${'contract_end' in payloadEstimate}`);
  
  // Check all contract/date related keys
  const contractKeys = Object.keys(payloadEstimate).filter(k => 
    k.includes('contract') || k.includes('date') || k.includes('Date')
  );
  console.log(`      All contract/date keys: ${contractKeys.join(', ')}`);
  
  // Check if contract_end is explicitly set or just inherited
  console.log(`      contract_end explicitly in object: ${payloadEstimate.hasOwnProperty('contract_end')}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Trace complete!');
  console.log('\nSummary:');
  console.log(`  Parser: ${wonWithContractEnd.contract_end ? '✅ Has contract_end' : '❌ Missing'}`);
  console.log(`  Merge: ${mergedEstimate.contract_end ? '✅ Has contract_end' : '❌ Missing'}`);
  console.log(`  Filter: ${filteredEstimate.contract_end ? '✅ Has contract_end' : '❌ Missing'}`);
  console.log(`  Transform: ${transformedEstimate.contract_end ? '✅ Has contract_end' : '❌ Missing'}`);
  console.log(`  API Payload: ${payloadEstimate.contract_end ? '✅ Has contract_end' : '❌ Missing'}`);
}

traceContractEnd()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

