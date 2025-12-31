#!/usr/bin/env node

/**
 * Analyze the Difference Between Estimates List.xlsx and Estimate List - Detailed Export.xlsx
 * 
 * Creates a comprehensive diff list to understand what LMN excludes and why.
 */

import XLSX from 'xlsx';
import { readFileSync, existsSync, writeFileSync } from 'fs';
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

function analyzeDiff() {
  console.log('🔍 Analyzing Difference Between LMN Exports\n');
  console.log('='.repeat(60) + '\n');

  const generalPath = join(homedir(), 'Downloads', 'Estimates List.xlsx');
  const detailedPath = join(homedir(), 'Downloads', 'Estimate List - Detailed Export.xlsx');

  if (!existsSync(generalPath) || !existsSync(detailedPath)) {
    console.error('❌ Files not found in Downloads folder');
    process.exit(1);
  }

  // Read general export
  console.log('📖 Reading "Estimates List.xlsx"...\n');
  const generalWorkbook = XLSX.readFile(generalPath);
  const generalSheet = generalWorkbook.Sheets[generalWorkbook.SheetNames[0]];
  const generalRows = XLSX.utils.sheet_to_json(generalSheet, { header: 1, defval: null });

  const generalHeaders = generalRows[0];
  const generalIdCol = generalHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
  const generalStatusCol = generalHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
  const generalPriceCol = generalHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
  const generalDateCol = generalHeaders.findIndex(h => h && (h.includes('Close Date') || h.includes('Estimate Close Date')));
  const generalDivisionCol = generalHeaders.findIndex(h => h && h.includes('Division'));
  const generalArchivedCol = generalHeaders.findIndex(h => h && h.includes('Archived'));
  const generalExcludeStatsCol = generalHeaders.findIndex(h => h && h.includes('Exclude Stats'));
  const generalHoursCol = generalHeaders.findIndex(h => h && (h.includes('Hours') || h.includes('Labor Hours')));

  const generalEstimates = new Map();
  for (let i = 1; i < generalRows.length; i++) {
    const row = generalRows[i];
    if (!row || row.length === 0) continue;
    
    const id = normalizeId(row[generalIdCol]);
    if (id) {
      generalEstimates.set(id, {
        id,
        status: (row[generalStatusCol] || '').toString().trim(),
        price: parseMoney(row[generalPriceCol]),
        closeDate: parseDate(row[generalDateCol]),
        division: (row[generalDivisionCol] || '').toString().trim(),
        archived: row[generalArchivedCol]?.toString().toLowerCase().trim() === 'true',
        excludeStats: row[generalExcludeStatsCol]?.toString().toLowerCase().trim() === 'true',
        hours: row[generalHoursCol] ? parseFloat(row[generalHoursCol]) : null,
      });
    }
  }

  console.log(`   Found ${generalEstimates.size} estimates in general export\n`);

  // Read detailed export
  console.log('📖 Reading "Estimate List - Detailed Export.xlsx"...\n');
  const detailedWorkbook = XLSX.readFile(detailedPath);
  const detailedSheet = detailedWorkbook.Sheets[detailedWorkbook.SheetNames[0]];
  const detailedRows = XLSX.utils.sheet_to_json(detailedSheet, { header: 1, defval: null });

  const detailedHeaders = detailedRows[0];
  const detailedIdCol = detailedHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
  const detailedStatusCol = detailedHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
  const detailedPriceCol = detailedHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
  const detailedDateCol = detailedHeaders.findIndex(h => h && (h.includes('Close Date') || h.includes('Estimate Close Date')));
  const detailedDivisionCol = detailedHeaders.findIndex(h => h && h.includes('Division'));

  const detailedEstimates = new Map();
  for (let i = 1; i < detailedRows.length; i++) {
    const row = detailedRows[i];
    if (!row || row.length === 0) continue;
    
    const id = normalizeId(row[detailedIdCol]);
    if (id) {
      detailedEstimates.set(id, {
        id,
        status: (row[detailedStatusCol] || '').toString().trim(),
        price: parseMoney(row[detailedPriceCol]),
        closeDate: parseDate(row[detailedDateCol]),
        division: (row[detailedDivisionCol] || '').toString().trim(),
      });
    }
  }

  console.log(`   Found ${detailedEstimates.size} estimates in detailed export\n`);

  // Find differences
  const inGeneralButNotDetailed = [];
  const inDetailedButNotGeneral = [];

  generalEstimates.forEach((generalEst, id) => {
    if (!detailedEstimates.has(id)) {
      inGeneralButNotDetailed.push(generalEst);
    }
  });

  detailedEstimates.forEach((detailedEst, id) => {
    if (!generalEstimates.has(id)) {
      inDetailedButNotGeneral.push(detailedEst);
    }
  });

  console.log('📊 Differences Found:\n');
  console.log(`   In general export but NOT in detailed: ${inGeneralButNotDetailed.length}`);
  console.log(`   In detailed export but NOT in general: ${inDetailedButNotGeneral.length}\n`);

  // Analyze exclusions
  console.log('🔍 Analyzing Exclusions...\n');

  const exclusionReasons = {
    noCloseDate: [],
    archived: [],
    excludeStats: [],
    zeroPrice: [],
    negativePrice: [],
    lowPrice: [],
    noStatus: [],
    inProgress: [],
    other: [],
  };

  inGeneralButNotDetailed.forEach(est => {
    if (!est.closeDate) {
      exclusionReasons.noCloseDate.push(est);
    } else if (est.archived) {
      exclusionReasons.archived.push(est);
    } else if (est.excludeStats) {
      exclusionReasons.excludeStats.push(est);
    } else if (est.price === 0) {
      exclusionReasons.zeroPrice.push(est);
    } else if (est.price < 0) {
      exclusionReasons.negativePrice.push(est);
    } else if (est.price < 100) {
      exclusionReasons.lowPrice.push(est);
    } else if (!est.status || est.status === '') {
      exclusionReasons.noStatus.push(est);
    } else if (est.status.toLowerCase().includes('in progress')) {
      exclusionReasons.inProgress.push(est);
    } else {
      exclusionReasons.other.push(est);
    }
  });

  console.log('Exclusion Reasons:\n');
  console.log(`   No Close Date: ${exclusionReasons.noCloseDate.length}`);
  console.log(`   Archived: ${exclusionReasons.archived.length}`);
  console.log(`   Exclude Stats: ${exclusionReasons.excludeStats.length}`);
  console.log(`   Zero Price: ${exclusionReasons.zeroPrice.length}`);
  console.log(`   Negative Price: ${exclusionReasons.negativePrice.length}`);
  console.log(`   Low Price (< $100): ${exclusionReasons.lowPrice.length}`);
  console.log(`   No Status: ${exclusionReasons.noStatus.length}`);
  console.log(`   In Progress: ${exclusionReasons.inProgress.length}`);
  console.log(`   Other: ${exclusionReasons.other.length}\n`);

  // Create detailed CSV
  const csvRows = [
    ['Estimate ID', 'Status', 'Price', 'Close Date', 'Division', 'Archived', 'Exclude Stats', 'Hours', 'Exclusion Reason']
  ];

  inGeneralButNotDetailed.forEach(est => {
    let reason = '';
    if (!est.closeDate) reason = 'No Close Date';
    else if (est.archived) reason = 'Archived';
    else if (est.excludeStats) reason = 'Exclude Stats';
    else if (est.price === 0) reason = 'Zero Price';
    else if (est.price < 0) reason = 'Negative Price';
    else if (est.price < 100) reason = 'Low Price (< $100)';
    else if (!est.status || est.status === '') reason = 'No Status';
    else if (est.status.toLowerCase().includes('in progress')) reason = 'In Progress';
    else reason = 'Other';

    csvRows.push([
      est.id,
      est.status,
      est.price,
      est.closeDate ? est.closeDate.toISOString().split('T')[0] : '',
      est.division,
      est.archived ? 'Yes' : 'No',
      est.excludeStats ? 'Yes' : 'No',
      est.hours || '',
      reason
    ]);
  });

  writeFileSync('lmn_exclusion_diff.csv', csvRows.map(row => row.join(',')).join('\n'));
  console.log('✅ Wrote lmn_exclusion_diff.csv\n');

  // Summary statistics
  const totalExcluded = inGeneralButNotDetailed.length;
  const excludedByStatus = {};
  const excludedByDivision = {};
  const excludedByPriceRange = {
    '0': 0,
    '1-100': 0,
    '100-1000': 0,
    '1000-5000': 0,
    '5000-10000': 0,
    '10000+': 0
  };

  inGeneralButNotDetailed.forEach(est => {
    const status = est.status || 'Unknown';
    excludedByStatus[status] = (excludedByStatus[status] || 0) + 1;

    const division = est.division || 'Unknown';
    excludedByDivision[division] = (excludedByDivision[division] || 0) + 1;

    const price = est.price;
    if (price === 0) excludedByPriceRange['0']++;
    else if (price < 100) excludedByPriceRange['1-100']++;
    else if (price < 1000) excludedByPriceRange['100-1000']++;
    else if (price < 5000) excludedByPriceRange['1000-5000']++;
    else if (price < 10000) excludedByPriceRange['5000-10000']++;
    else excludedByPriceRange['10000+']++;
  });

  console.log('📊 Exclusion Statistics:\n');
  console.log('By Status (Top 10):');
  Object.entries(excludedByStatus)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([status, count]) => {
      console.log(`   ${status}: ${count} (${((count / totalExcluded) * 100).toFixed(1)}%)`);
    });

  console.log('\nBy Division (Top 10):');
  Object.entries(excludedByDivision)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([division, count]) => {
      console.log(`   ${division}: ${count} (${((count / totalExcluded) * 100).toFixed(1)}%)`);
    });

  console.log('\nBy Price Range:');
  Object.entries(excludedByPriceRange).forEach(([range, count]) => {
    if (count > 0) {
      console.log(`   $${range}: ${count} (${((count / totalExcluded) * 100).toFixed(1)}%)`);
    }
  });
}

analyzeDiff();

