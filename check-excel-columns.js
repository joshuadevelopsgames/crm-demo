#!/usr/bin/env node

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Check for Estimates List file in Downloads
const downloadsPath = join(homedir(), 'Downloads');
const possibleFiles = [
  'Estimates List.xlsx',
  'Estimates List (1).xlsx',
  'Estimates List (2).xlsx',
  'Estimates List (3).xlsx',
  'Estimates List (4).xlsx',
];

let filePath = null;
for (const fileName of possibleFiles) {
  const fullPath = join(downloadsPath, fileName);
  if (existsSync(fullPath)) {
    filePath = fullPath;
    console.log(`📄 Found file: ${fileName}\n`);
    break;
  }
}

if (!filePath) {
  console.log('❌ Could not find "Estimates List.xlsx" in Downloads folder');
  console.log('   Please provide the path to your Estimates List file:');
  console.log('   node check-excel-columns.js /path/to/Estimates\ List.xlsx');
  process.exit(1);
}

// If path provided as argument, use it
if (process.argv[2]) {
  filePath = process.argv[2];
}

console.log(`📖 Reading Excel file: ${filePath}\n`);

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log(`📋 Found ${workbook.SheetNames.length} sheet(s):\n`);
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`══════════════════════════════════════════════════`);
    console.log(`📄 Sheet: "${sheetName}"`);
    console.log(`══════════════════════════════════════════════════\n`);
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Try to read as JSON to get headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 });
    
    if (jsonData.length === 0) {
      console.log('   ⚠️  Sheet is empty\n');
      continue;
    }
    
    // Find header row (usually first row, but might be later)
    let headerRow = null;
    let headerRowIndex = -1;
    
    // Check first few rows for potential headers
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const row = jsonData[i];
      if (Array.isArray(row) && row.length > 0) {
        // Check if this looks like a header row (has text values, not all empty)
        const textCount = row.filter(cell => cell && typeof cell === 'string' && cell.trim().length > 0).length;
        if (textCount > 5) {
          headerRow = row;
          headerRowIndex = i;
          break;
        }
      }
    }
    
    if (!headerRow) {
      console.log('   ⚠️  Could not find header row\n');
      continue;
    }
    
    console.log(`   Header row found at index ${headerRowIndex}\n`);
    console.log(`   Total columns: ${headerRow.length}\n`);
    
    // Check for contract-related columns
    const contractColumns = [];
    const allColumns = [];
    
    headerRow.forEach((header, index) => {
      if (header) {
        const headerStr = String(header).trim();
        allColumns.push({ index, name: headerStr });
        
        // Check for contract-related keywords
        const lowerHeader = headerStr.toLowerCase();
        if (lowerHeader.includes('contract')) {
          contractColumns.push({ index, name: headerStr });
        }
      }
    });
    
    console.log(`   📋 All columns (${allColumns.length}):`);
    allColumns.forEach(({ index, name }) => {
      console.log(`      ${index}: "${name}"`);
    });
    
    if (contractColumns.length > 0) {
      console.log(`\n   ✅ Contract-related columns found:`);
      contractColumns.forEach(({ index, name }) => {
        console.log(`      ${index}: "${name}"`);
      });
    } else {
      console.log(`\n   ❌ No contract-related columns found!`);
      console.log(`      Looking for columns containing "contract"`);
      console.log(`      Expected: "Contract End" or "Contract Start"`);
    }
    
    // Check specifically for "Contract End"
    const contractEndIndex = headerRow.findIndex(h => 
      h && String(h).trim().toLowerCase() === 'contract end'
    );
    
    if (contractEndIndex >= 0) {
      console.log(`\n   ✅ Found "Contract End" at column index ${contractEndIndex}`);
      
      // Check if there's any data in this column
      let dataCount = 0;
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && row[contractEndIndex] && String(row[contractEndIndex]).trim()) {
          dataCount++;
        }
      }
      console.log(`      Found ${dataCount} rows with data in "Contract End" column`);
    } else {
      console.log(`\n   ❌ "Contract End" column NOT FOUND!`);
      console.log(`      The parser expects exactly: "Contract End"`);
      console.log(`      Check if the column name is slightly different`);
    }
    
    // Check for "Contract Start" too
    const contractStartIndex = headerRow.findIndex(h => 
      h && String(h).trim().toLowerCase() === 'contract start'
    );
    
    if (contractStartIndex >= 0) {
      console.log(`\n   ✅ Found "Contract Start" at column index ${contractStartIndex}`);
    } else {
      console.log(`\n   ⚠️  "Contract Start" column NOT FOUND`);
    }
    
    console.log('\n');
  }
  
} catch (error) {
  console.error('❌ Error reading Excel file:', error.message);
  process.exit(1);
}

