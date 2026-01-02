/**
 * Script to check what status values are in Estimates List.xlsx
 * Run: node check_estimates_status.js
 */

import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  console.log('Please make sure "Estimates List.xlsx" is in your Downloads folder');
  process.exit(1);
}

try {
  console.log(`📖 Reading: ${filePath}\n`);
  
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to JSON
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rows.length < 2) {
    console.error('❌ File appears to be empty or has no data rows');
    process.exit(1);
  }
  
  // Find Status column index
  const headers = rows[0];
  const statusColIndex = headers.findIndex(h => 
    h && h.toString().toLowerCase().includes('status') && 
    !h.toString().toLowerCase().includes('pipeline')
  );
  
  if (statusColIndex === -1) {
    console.error('❌ Could not find "Status" column');
    console.log('Available columns:', headers.filter(h => h).join(', '));
    process.exit(1);
  }
  
  console.log(`✅ Found "Status" column at index ${statusColIndex}\n`);
  
  // Collect all status values
  const statusCounts = {};
  const statusValues = new Set();
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length <= statusColIndex) continue;
    
    const status = row[statusColIndex];
    if (status && status.toString().trim()) {
      const statusStr = status.toString().trim();
      statusCounts[statusStr] = (statusCounts[statusStr] || 0) + 1;
      statusValues.add(statusStr);
    }
  }
  
  // Sort by count
  const sortedStatuses = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1]);
  
  console.log('══════════════════════════════════════════════════');
  console.log('📊 STATUS VALUES IN ESTIMATES LIST.XLSX');
  console.log('══════════════════════════════════════════════════\n');
  
  console.log(`Total unique status values: ${statusValues.size}\n`);
  
  console.log('Status values and counts:');
  console.log('──────────────────────────────────────────────────');
  sortedStatuses.forEach(([status, count]) => {
    console.log(`  "${status}": ${count} estimate(s)`);
  });
  
  console.log('\n──────────────────────────────────────────────────');
  console.log('\n🔍 ANALYSIS:\n');
  
  // Check which ones would be recognized as "won" (matches parser logic)
  const recognizedAsWon = [];
  const notRecognized = [];
  
  statusValues.forEach(status => {
    const statusLower = status.toLowerCase().trim();
    let isRecognized = false;
    
    // Check exact matches (matches parser logic)
    if (
      statusLower === 'email contract award' ||
      statusLower === 'verbal contract award' ||
      statusLower === 'work complete' ||
      statusLower === 'work in progress' ||
      statusLower === 'billing complete' ||
      statusLower === 'contract signed' ||
      statusLower === 'contract in progress' ||
      statusLower === 'contract + billing complete'
    ) {
      isRecognized = true;
    }
    
    // Check partial matches (matches parser logic)
    if (
      statusLower.includes('email contract award') ||
      statusLower.includes('verbal contract award') ||
      statusLower.includes('work complete') ||
      statusLower.includes('billing complete') ||
      statusLower.includes('contract signed') ||
      statusLower.includes('contract in progress') ||
      statusLower.includes('contract + billing complete')
    ) {
      isRecognized = true;
    }
    
    if (isRecognized) {
      recognizedAsWon.push(status);
    } else {
      notRecognized.push(status);
    }
  });
  
  if (recognizedAsWon.length > 0) {
    console.log('✅ Status values that WILL be recognized as "won":');
    recognizedAsWon.forEach(status => {
      console.log(`   - "${status}" (${statusCounts[status]} estimates)`);
    });
    console.log('');
  }
  
  if (notRecognized.length > 0) {
    console.log('❌ Status values that will NOT be recognized as "won":');
    notRecognized.forEach(status => {
      console.log(`   - "${status}" (${statusCounts[status]} estimates)`);
    });
    console.log('\n⚠️  These will default to "lost" and won\'t count for revenue!');
    console.log('   We need to add these to the parser.\n');
  }
  
  // Check if there's a "Sales Pipeline Status" column too
  const pipelineColIndex = headers.findIndex(h => 
    h && h.toString().toLowerCase().includes('pipeline')
  );
  
  if (pipelineColIndex !== -1) {
    console.log('\n📋 Also found "Sales Pipeline Status" column');
    console.log('   (Note: Parser currently only uses "Status" column, not Pipeline Status)');
  }
  
} catch (error) {
  console.error('❌ Error reading file:', error.message);
  process.exit(1);
}

