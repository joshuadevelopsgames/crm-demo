#!/usr/bin/env node

/**
 * Analyze Yearly Detailed Export Files
 * 
 * Reads each Excel file in "estimates reports lists" folder,
 * determines which year it represents, and prepares data for integration.
 */

import XLSX from 'xlsx';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function normalizeId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase();
}

function parseMoney(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function analyzeFile(filePath, fileName) {
  console.log(`\n📖 Analyzing: ${fileName}\n`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rows.length < 2) {
      console.log('   ⚠️  Empty or invalid file');
      return null;
    }

    const headers = rows[0];
    const idCol = headers.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
    const statusCol = headers.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
    const priceCol = headers.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
    const dateCol = headers.findIndex(h => h && (h.includes('Close Date') || h.includes('Estimate Close Date')));
    const divisionCol = headers.findIndex(h => h && h.includes('Division'));

    const estimates = [];
    const years = new Set();
    const statuses = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const id = normalizeId(row[idCol]);
      if (!id) continue;

      const closeDate = parseDate(row[dateCol]);
      if (closeDate) {
        const year = closeDate.getFullYear();
        years.add(year);
      }

      const status = (row[statusCol] || '').toString().trim();
      statuses[status] = (statuses[status] || 0) + 1;

      estimates.push({
        id,
        status,
        price: parseMoney(row[priceCol]),
        closeDate,
        division: (row[divisionCol] || '').toString().trim(),
      });
    }

    // Determine primary year (most common year in close dates)
    const yearCounts = {};
    estimates.forEach(est => {
      if (est.closeDate) {
        const year = est.closeDate.getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      }
    });

    const primaryYear = Object.entries(yearCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || Array.from(years)[0] || null;

    const soldCount = estimates.filter(e => {
      const status = (e.status || '').toLowerCase();
      return status.includes('sold') || 
             status === 'contract signed' ||
             status === 'work complete' ||
             status === 'billing complete';
    }).length;

    const totalDollar = estimates
      .filter(e => {
        const status = (e.status || '').toLowerCase();
        return status.includes('sold') || 
               status === 'contract signed' ||
               status === 'work complete' ||
               status === 'billing complete';
      })
      .reduce((sum, e) => sum + e.price, 0);

    console.log(`   Total estimates: ${estimates.length}`);
    console.log(`   Sold estimates: ${soldCount}`);
    console.log(`   Sold dollar amount: $${totalDollar.toLocaleString()}`);
    console.log(`   Years found: ${Array.from(years).sort().join(', ')}`);
    console.log(`   Primary year: ${primaryYear || 'Unknown'}`);
    console.log(`   Status distribution:`);
    Object.entries(statuses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });

    return {
      fileName,
      filePath,
      primaryYear: primaryYear ? parseInt(primaryYear) : null,
      years: Array.from(years).map(y => parseInt(y)).sort(),
      estimates,
      soldCount,
      totalDollar,
      statuses,
    };
  } catch (error) {
    console.error(`   ❌ Error reading file: ${error.message}`);
    return null;
  }
}

function analyzeAllFiles() {
  console.log('🔍 Analyzing Yearly Detailed Export Files\n');
  console.log('='.repeat(60) + '\n');

  const folderPath = join(homedir(), 'Downloads', 'estimates reports lists');
  const files = readdirSync(folderPath)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort();

  console.log(`Found ${files.length} Excel files:\n`);

  const results = [];

  files.forEach(fileName => {
    const filePath = join(folderPath, fileName);
    const result = analyzeFile(filePath, fileName);
    if (result) {
      results.push(result);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary\n');

  results.forEach(result => {
    console.log(`${result.fileName}:`);
    console.log(`  Year: ${result.primaryYear || 'Unknown'}`);
    console.log(`  Estimates: ${result.estimates.length}`);
    console.log(`  Sold: ${result.soldCount} ($${result.totalDollar.toLocaleString()})`);
    console.log('');
  });

  // Check for year conflicts
  const yearMap = {};
  results.forEach(result => {
    if (result.primaryYear) {
      if (!yearMap[result.primaryYear]) {
        yearMap[result.primaryYear] = [];
      }
      yearMap[result.primaryYear].push(result.fileName);
    }
  });

  const conflicts = Object.entries(yearMap).filter(([year, files]) => files.length > 1);
  if (conflicts.length > 0) {
    console.log('⚠️  Year Conflicts Detected:\n');
    conflicts.forEach(([year, files]) => {
      console.log(`  Year ${year}: ${files.join(', ')}`);
    });
    console.log('');
  }

  return results;
}

const results = analyzeAllFiles();

// Export results for integration
if (results.length > 0) {
  const summary = {
    files: results.map(r => ({
      fileName: r.fileName,
      filePath: r.filePath,
      year: r.primaryYear,
      estimateCount: r.estimates.length,
      soldCount: r.soldCount,
      totalDollar: r.totalDollar,
    })),
    totalFiles: results.length,
    years: [...new Set(results.map(r => r.primaryYear).filter(Boolean))].sort(),
  };

  console.log('✅ Analysis complete. Ready for integration.\n');
  console.log('Files by year:');
  summary.years.forEach(year => {
    const file = results.find(r => r.primaryYear === year);
    if (file) {
      console.log(`  ${year}: ${file.fileName}`);
    }
  });
}

