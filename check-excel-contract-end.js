#!/usr/bin/env node

/**
 * Check Estimates List.xlsx for Contract End column and data
 */

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Common locations to check for the Excel file
const possiblePaths = [
  join(process.cwd(), 'Estimates List.xlsx'),
  join(homedir(), 'Downloads', 'Estimates List.xlsx'),
  join(homedir(), 'Desktop', 'Estimates List.xlsx'),
];

function findExcelFile() {
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

function checkContractEndColumn(filePath) {
  console.log(`📖 Reading Excel file: ${filePath}\n`);

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    if (rows.length < 2) {
      console.log('❌ File appears to be empty or has no data rows');
      return;
    }

    const headers = rows[0];
    console.log(`📊 Total columns: ${headers.length}`);
    console.log(`📋 Total rows (including header): ${rows.length}\n`);

    // Find Contract End column
    const contractEndIndex = headers.findIndex(h => 
      h && h.toString().trim() === 'Contract End'
    );

    // Also check for Contract Start
    const contractStartIndex = headers.findIndex(h => 
      h && h.toString().trim() === 'Contract Start'
    );

    // Initialize counters (will be set in the if block below)
    let hasContractEndCount = 0;
    let hasContractEndWonCount = 0;
    let wonEstimatesCount = 0;
    const sampleContractEnds = [];

    console.log('='.repeat(60));
    console.log('📋 COLUMN ANALYSIS');
    console.log('='.repeat(60));

    if (contractEndIndex === -1) {
      console.log('❌ "Contract End" column NOT FOUND in Excel file');
      console.log('\nAvailable columns:');
      headers.forEach((h, i) => {
        if (h) console.log(`   ${i}: "${h}"`);
      });
    } else {
      console.log(`✅ "Contract End" column FOUND at index ${contractEndIndex}`);
      
      // Check how many rows have data in Contract End
      const statusIndex = headers.findIndex(h => h && h.toString().trim() === 'Status');
      const estimateIdIndex = headers.findIndex(h => h && h.toString().trim() === 'Estimate ID');

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const contractEnd = row[contractEndIndex];
        const status = statusIndex >= 0 ? row[statusIndex] : null;

        // Check if it's a won estimate
        let isWon = false;
        if (status) {
          const statusLower = status.toString().toLowerCase().trim();
          isWon = 
            statusLower === 'email contract award' ||
            statusLower === 'verbal contract award' ||
            statusLower === 'work complete' ||
            statusLower === 'work in progress' ||
            statusLower === 'billing complete' ||
            statusLower === 'contract signed' ||
            statusLower === 'contract in progress' ||
            statusLower === 'contract + billing complete' ||
            statusLower.includes('email contract award') ||
            statusLower.includes('verbal contract award') ||
            statusLower.includes('work complete') ||
            statusLower.includes('billing complete') ||
            statusLower.includes('contract signed') ||
            statusLower.includes('contract in progress') ||
            statusLower.includes('contract + billing complete');
        }

        if (isWon) {
          wonEstimatesCount++;
        }

        if (contractEnd !== null && contractEnd !== undefined && contractEnd !== '') {
          hasContractEndCount++;
          
          if (isWon) {
            hasContractEndWonCount++;
            if (sampleContractEnds.length < 10) {
              sampleContractEnds.push({
                estimateId: estimateIdIndex >= 0 ? row[estimateIdIndex] : 'N/A',
                status: status,
                contractEnd: contractEnd
              });
            }
          }
        }
      }

      console.log(`\n📊 Contract End Data Analysis:`);
      console.log(`   Total rows with Contract End data: ${hasContractEndCount} / ${rows.length - 1}`);
      console.log(`   Won estimates: ${wonEstimatesCount}`);
      console.log(`   Won estimates with Contract End: ${hasContractEndWonCount}`);
      console.log(`   Won estimates WITHOUT Contract End: ${wonEstimatesCount - hasContractEndWonCount}`);

      if (sampleContractEnds.length > 0) {
        console.log(`\n📅 Sample Contract End dates from Won estimates:`);
        sampleContractEnds.forEach(({ estimateId, status, contractEnd }) => {
          console.log(`   - Estimate ${estimateId}: ${contractEnd} (Status: ${status})`);
        });
      } else if (wonEstimatesCount > 0) {
        console.log(`\n⚠️  WARNING: Found ${wonEstimatesCount} won estimates, but NONE have Contract End dates!`);
      }
    }

    if (contractStartIndex === -1) {
      console.log('\n❌ "Contract Start" column NOT FOUND in Excel file');
    } else {
      console.log(`\n✅ "Contract Start" column FOUND at index ${contractStartIndex}`);
      
      // Check how many rows have Contract Start data
      let hasContractStartCount = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const contractStart = row[contractStartIndex];
        if (contractStart !== null && contractStart !== undefined && contractStart !== '') {
          hasContractStartCount++;
        }
      }
      console.log(`   Rows with Contract Start data: ${hasContractStartCount} / ${rows.length - 1}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 SUMMARY');
    console.log('='.repeat(60));
    
    if (contractEndIndex === -1) {
      console.log('❌ The Excel file does NOT have a "Contract End" column.');
      console.log('   This is why contract_end dates are null in the database.');
      console.log('   Solution: The Excel export from LMN may not include this column.');
    } else if (hasContractEndWonCount === 0 && wonEstimatesCount > 0) {
      console.log('⚠️  The Excel file HAS a "Contract End" column, but won estimates have no data in it.');
      console.log('   This means the column exists but is empty for won estimates.');
      console.log('   Solution: Check if LMN exports include contract end dates for won estimates.');
    } else if (hasContractEndWonCount > 0) {
      console.log(`✅ The Excel file HAS "Contract End" data for ${hasContractEndWonCount} won estimates.`);
      console.log(`   Total won estimates: ${wonEstimatesCount}`);
      console.log(`   Won estimates WITHOUT Contract End: ${wonEstimatesCount - hasContractEndWonCount}`);
      console.log('\n⚠️  IMPORTANT: The Excel file has contract_end data, but the database shows 0 won estimates with contract_end.');
      console.log('   This means the import process is NOT preserving contract_end dates.');
      console.log('   Solution: Check the import process and re-import the Estimates List.xlsx file.');
    }

  } catch (error) {
    console.error('❌ Error reading Excel file:', error.message);
    if (error.message.includes('ENOENT')) {
      console.log('\n💡 File not found. Please ensure "Estimates List.xlsx" is in one of these locations:');
      possiblePaths.forEach(path => console.log(`   - ${path}`));
    }
  }
}

// Main execution
const filePath = findExcelFile();

if (!filePath) {
  console.log('❌ Could not find "Estimates List.xlsx" file');
  console.log('\nSearched in:');
  possiblePaths.forEach(path => console.log(`   - ${path}`));
  console.log('\n💡 Please provide the file path as an argument:');
  console.log('   node check-excel-contract-end.js "/path/to/Estimates List.xlsx"');
  
  // Check if path was provided as argument
  const argPath = process.argv[2];
  if (argPath && existsSync(argPath)) {
    console.log(`\n✅ Using provided path: ${argPath}`);
    checkContractEndColumn(argPath);
  } else {
    process.exit(1);
  }
} else {
  checkContractEndColumn(filePath);
}

