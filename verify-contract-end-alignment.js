#!/usr/bin/env node

/**
 * Verify that contract_end is correctly aligned with Estimate ID in the Excel file
 * This checks if there's any row misalignment or column mismatch
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

async function verifyAlignment() {
  console.log('🔍 Verifying contract_end Alignment with Estimate ID\n');
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
  
  // Find column indices
  const colMap = {
    estimateId: headers.findIndex(h => h && h.toString().trim() === 'Estimate ID'),
    contractEnd: headers.findIndex(h => h && h.toString().trim() === 'Contract End'),
    contractStart: headers.findIndex(h => h && h.toString().trim() === 'Contract Start'),
    status: headers.findIndex(h => h && h.toString().trim() === 'Status'),
    projectName: headers.findIndex(h => h && h.toString().trim() === 'Project Name'),
    estimateNumber: headers.findIndex(h => h && h.toString().trim() === 'Estimate Number')
  };
  
  console.log('📋 Column Mapping:');
  Object.entries(colMap).forEach(([key, index]) => {
    console.log(`   ${key}: column ${index} ${index >= 0 ? '✅' : '❌'}`);
  });
  
  if (colMap.estimateId < 0 || colMap.contractEnd < 0) {
    console.error('❌ Required columns not found!');
    return;
  }
  
  console.log('\n🔍 Checking Row Alignment:');
  console.log('   (Verifying that contract_end in each row matches the Estimate ID in the same row)');
  
  // Check first 20 won estimates with contract_end
  let checked = 0;
  const misaligned = [];
  const aligned = [];
  
  for (let i = 1; i < estimatesRows.length && checked < 20; i++) {
    const row = estimatesRows[i];
    if (!row || row.length === 0) continue;
    
    const estimateId = row[colMap.estimateId]?.toString().trim();
    const contractEndRaw = colMap.contractEnd >= 0 ? row[colMap.contractEnd] : null;
    const contractStartRaw = colMap.contractStart >= 0 ? row[colMap.contractStart] : null;
    const status = row[colMap.status]?.toString().trim() || '';
    const projectName = row[colMap.projectName]?.toString().trim() || '';
    
    const isWon = status.toLowerCase().includes('contract') || 
                 status.toLowerCase().includes('work complete') ||
                 status.toLowerCase().includes('billing complete');
    
    if (!isWon || !estimateId) continue;
    
    const contractEnd = parseDate(contractEndRaw);
    const contractStart = parseDate(contractStartRaw);
    
    if (contractEnd || contractStart) {
      checked++;
      
      // Check if the row data looks consistent
      const hasAllData = estimateId && (contractEnd || contractStart) && projectName;
      const rowLength = row.length;
      const estimateIdIndex = colMap.estimateId;
      const contractEndIndex = colMap.contractEnd;
      
      // Check for potential misalignment indicators:
      // 1. Estimate ID is in wrong position
      // 2. Contract End is in wrong position
      // 3. Row length is inconsistent
      // 4. Data types are unexpected
      
      const potentialIssues = [];
      
      if (estimateIdIndex >= rowLength) {
        potentialIssues.push(`Estimate ID column (${estimateIdIndex}) beyond row length (${rowLength})`);
      }
      if (contractEndIndex >= rowLength) {
        potentialIssues.push(`Contract End column (${contractEndIndex}) beyond row length (${rowLength})`);
      }
      
      // Check if Estimate ID looks valid (should start with EST or be numeric)
      const isValidEstimateId = estimateId && (
        estimateId.toUpperCase().startsWith('EST') ||
        /^\d+$/.test(estimateId)
      );
      
      if (!isValidEstimateId) {
        potentialIssues.push(`Estimate ID format looks invalid: "${estimateId}"`);
      }
      
      // Check if contract_end date is reasonable (not too far in past/future)
      if (contractEnd) {
        const contractEndDate = new Date(contractEnd);
        const now = new Date();
        const yearsDiff = (contractEndDate - now) / (1000 * 60 * 60 * 24 * 365);
        if (yearsDiff > 20 || yearsDiff < -10) {
          potentialIssues.push(`Contract End date seems unusual: ${contractEnd} (${yearsDiff.toFixed(1)} years from now)`);
        }
      }
      
      const record = {
        rowNumber: i + 1,
        estimateId,
        contractEnd,
        contractStart,
        projectName,
        status,
        rowLength,
        issues: potentialIssues
      };
      
      if (potentialIssues.length > 0) {
        misaligned.push(record);
      } else {
        aligned.push(record);
      }
    }
  }
  
  console.log(`\n📊 Results: ${checked} won estimates checked`);
  console.log(`   ✅ Aligned: ${aligned.length}`);
  console.log(`   ⚠️  Potential Issues: ${misaligned.length}`);
  
  if (aligned.length > 0) {
    console.log('\n✅ Sample Aligned Records:');
    aligned.slice(0, 3).forEach(rec => {
      console.log(`   Row ${rec.rowNumber}: ${rec.estimateId} | Contract End: ${rec.contractEnd} | Project: ${rec.projectName}`);
    });
  }
  
  if (misaligned.length > 0) {
    console.log('\n⚠️  Records with Potential Issues:');
    misaligned.forEach(rec => {
      console.log(`\n   Row ${rec.rowNumber}: ${rec.estimateId}`);
      console.log(`      Contract End: ${rec.contractEnd || 'null'}`);
      console.log(`      Project: ${rec.projectName}`);
      console.log(`      Issues:`);
      rec.issues.forEach(issue => {
        console.log(`         - ${issue}`);
      });
    });
  }
  
  // Now simulate what the parser does
  console.log('\n🔍 Simulating Parser Behavior:');
  console.log('   (Checking if parser correctly extracts contract_end for each Estimate ID)');
  
  const parserResults = [];
  for (let i = 1; i < Math.min(100, estimatesRows.length); i++) {
    const row = estimatesRows[i];
    if (!row || row.length === 0) continue;
    
    const estimateId = row[colMap.estimateId]?.toString().trim();
    const contractEndRaw = colMap.contractEnd >= 0 ? row[colMap.contractEnd] : null;
    
    if (!estimateId) continue;
    
    const contractEnd = parseDate(contractEndRaw);
    
    if (contractEnd) {
      parserResults.push({
        estimateId,
        contractEnd,
        rowNumber: i + 1
      });
      
      if (parserResults.length >= 10) break;
    }
  }
  
  console.log(`\n   Parser would extract ${parserResults.length} estimates with contract_end:`);
  parserResults.forEach(rec => {
    console.log(`      Row ${rec.rowNumber}: ${rec.estimateId} → contract_end: ${rec.contractEnd}`);
  });
  
  // Check for duplicates (same Estimate ID with different contract_end)
  console.log('\n🔍 Checking for Duplicate Estimate IDs:');
  const estimateIdMap = new Map();
  parserResults.forEach(rec => {
    if (estimateIdMap.has(rec.estimateId)) {
      const existing = estimateIdMap.get(rec.estimateId);
      if (existing.contractEnd !== rec.contractEnd) {
        console.log(`   ⚠️  Duplicate Estimate ID ${rec.estimateId} with different contract_end:`);
        console.log(`      Row ${existing.rowNumber}: ${existing.contractEnd}`);
        console.log(`      Row ${rec.rowNumber}: ${rec.contractEnd}`);
      }
    } else {
      estimateIdMap.set(rec.estimateId, rec);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Verification complete!');
  
  if (misaligned.length === 0 && estimateIdMap.size === parserResults.length) {
    console.log('\n✅ No alignment issues detected - contract_end is correctly matched to Estimate ID');
  } else {
    console.log('\n⚠️  Potential issues detected - review the details above');
  }
}

verifyAlignment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

