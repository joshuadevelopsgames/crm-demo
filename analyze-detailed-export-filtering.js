#!/usr/bin/env node

/**
 * Analyze "Estimate List - Detailed Export.xlsx" Filtering
 * 
 * This export has 1086 estimates vs 7932 in the general export.
 * Let's figure out what filtering criteria LMN uses to create this detailed export.
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

function analyzeFiltering() {
  console.log('🔍 Analyzing "Estimate List - Detailed Export.xlsx" Filtering\n');
  console.log('='.repeat(60) + '\n');

  // Read both exports
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

  // Analyze what's in detailed vs general
  const inDetailed = Array.from(detailedEstimates.values());
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

  console.log('📊 Analysis:\n');
  console.log(`   In detailed export: ${inDetailed.length}`);
  console.log(`   In general but NOT in detailed: ${inGeneralButNotDetailed.length}`);
  console.log(`   In detailed but NOT in general: ${inDetailedButNotGeneral.length}\n`);

  // Analyze status patterns in detailed export
  console.log('🔍 Analyzing Status Patterns in Detailed Export:\n');
  
  const statusCounts = {};
  inDetailed.forEach(est => {
    const status = est.status || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('   Status distribution in detailed export:');
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
  console.log('');

  // Analyze what's excluded from detailed export
  console.log('🔍 Analyzing What\'s Excluded from Detailed Export:\n');

  const excludedByStatus = {};
  const excludedByArchived = { archived: 0, notArchived: 0 };
  const excludedByExcludeStats = { excludeStats: 0, notExcludeStats: 0 };
  const excludedByPrice = { '0': 0, '1-100': 0, '100-1000': 0, '1000+': 0 };
  const excludedByDate = { hasDate: 0, noDate: 0 };
  const excludedByDivision = {};

  inGeneralButNotDetailed.forEach(est => {
    const status = est.status || 'Unknown';
    excludedByStatus[status] = (excludedByStatus[status] || 0) + 1;

    if (est.archived) excludedByArchived.archived++;
    else excludedByArchived.notArchived++;

    if (est.excludeStats) excludedByExcludeStats.excludeStats++;
    else excludedByExcludeStats.notExcludeStats++;

    const price = est.price;
    if (price === 0) excludedByPrice['0']++;
    else if (price < 100) excludedByPrice['1-100']++;
    else if (price < 1000) excludedByPrice['100-1000']++;
    else excludedByPrice['1000+']++;

    if (est.closeDate) excludedByDate.hasDate++;
    else excludedByDate.noDate++;

    const division = est.division || 'Unknown';
    excludedByDivision[division] = (excludedByDivision[division] || 0) + 1;
  });

  console.log('   Excluded by Status:');
  Object.entries(excludedByStatus)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });

  console.log('\n   Excluded by Archived:');
  Object.entries(excludedByArchived).forEach(([key, count]) => {
    console.log(`     ${key}: ${count}`);
  });

  console.log('\n   Excluded by Exclude Stats:');
  Object.entries(excludedByExcludeStats).forEach(([key, count]) => {
    console.log(`     ${key}: ${count}`);
  });

  console.log('\n   Excluded by Price:');
  Object.entries(excludedByPrice).forEach(([range, count]) => {
    console.log(`     $${range}: ${count}`);
  });

  console.log('\n   Excluded by Close Date:');
  Object.entries(excludedByDate).forEach(([key, count]) => {
    console.log(`     ${key}: ${count}`);
  });

  console.log('\n   Excluded by Division (top 10):');
  Object.entries(excludedByDivision)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([division, count]) => {
      console.log(`     ${division}: ${count}`);
    });

  // Test filtering hypotheses
  console.log('\n\n🧪 Testing Filtering Hypotheses:\n');

  // Hypothesis 1: Only "Sold" status
  const soldOnly = inDetailed.filter(est => {
    const status = (est.status || '').toLowerCase();
    return status.includes('sold') || 
           status === 'contract signed' ||
           status === 'work complete' ||
           status === 'billing complete';
  });
  console.log(`Hypothesis 1: Only "Sold" status`);
  console.log(`   Matches: ${soldOnly.length} of ${inDetailed.length} (${((soldOnly.length / inDetailed.length) * 100).toFixed(1)}%)\n`);

  // Hypothesis 2: Has close date
  const hasCloseDate = inDetailed.filter(est => est.closeDate);
  console.log(`Hypothesis 2: Has close date`);
  console.log(`   Matches: ${hasCloseDate.length} of ${inDetailed.length} (${((hasCloseDate.length / inDetailed.length) * 100).toFixed(1)}%)\n`);

  // Hypothesis 3: Not archived
  const notArchived = inDetailed.filter(est => {
    const generalEst = generalEstimates.get(est.id);
    return !generalEst || !generalEst.archived;
  });
  console.log(`Hypothesis 3: Not archived`);
  console.log(`   Matches: ${notArchived.length} of ${inDetailed.length} (${((notArchived.length / inDetailed.length) * 100).toFixed(1)}%)\n`);

  // Hypothesis 4: Not exclude stats
  const notExcludeStats = inDetailed.filter(est => {
    const generalEst = generalEstimates.get(est.id);
    return !generalEst || !generalEst.excludeStats;
  });
  console.log(`Hypothesis 4: Not exclude stats`);
  console.log(`   Matches: ${notExcludeStats.length} of ${inDetailed.length} (${((notExcludeStats.length / inDetailed.length) * 100).toFixed(1)}%)\n`);

  // Hypothesis 5: Price > 0
  const priceGreaterThanZero = inDetailed.filter(est => est.price > 0);
  console.log(`Hypothesis 5: Price > 0`);
  console.log(`   Matches: ${priceGreaterThanZero.length} of ${inDetailed.length} (${((priceGreaterThanZero.length / inDetailed.length) * 100).toFixed(1)}%)\n`);

  // Combined hypothesis
  console.log('🎯 Combined Filtering Rule:\n');
  
  const combinedFilter = (est) => {
    const status = (est.status || '').toLowerCase();
    const isSold = status.includes('sold') || 
                   status === 'contract signed' ||
                   status === 'work complete' ||
                   status === 'billing complete' ||
                   status === 'email contract award' ||
                   status === 'verbal contract award';
    
    const generalEst = generalEstimates.get(est.id);
    const notArchived = !generalEst || !generalEst.archived;
    const notExcludeStats = !generalEst || !generalEst.excludeStats;
    const hasCloseDate = est.closeDate !== null;
    const priceGreaterThanZero = est.price > 0;
    
    return isSold && notArchived && notExcludeStats && hasCloseDate && priceGreaterThanZero;
  };

  const matchesCombined = inDetailed.filter(combinedFilter);
  console.log(`   Combined rule (Sold + Not Archived + Not Exclude Stats + Has Close Date + Price > 0)`);
  console.log(`   Matches: ${matchesCombined.length} of ${inDetailed.length} (${((matchesCombined.length / inDetailed.length) * 100).toFixed(1)}%)\n`);

  // Test what would be included if we apply this filter to general export
  console.log('🧪 Testing Filter on General Export:\n');
  
  let wouldBeIncluded = 0;
  generalEstimates.forEach(est => {
    if (combinedFilter(est)) {
      wouldBeIncluded++;
    }
  });
  
  console.log(`   If we apply combined filter to general export:`);
  console.log(`   Would include: ${wouldBeIncluded} estimates`);
  console.log(`   Detailed export has: ${inDetailed.length} estimates`);
  console.log(`   Difference: ${Math.abs(wouldBeIncluded - inDetailed.length)} estimates\n`);

  // Export analysis
  const analysisCsv = [
    ['Estimate ID', 'In Detailed Export', 'Status', 'Has Close Date', 'Price', 'Archived', 'Exclude Stats', 'Would Match Filter']
  ];

  generalEstimates.forEach((est, id) => {
    const inDetailed = detailedEstimates.has(id);
    const wouldMatch = combinedFilter(est);
    const generalEst = generalEstimates.get(id);
    
    analysisCsv.push([
      id,
      inDetailed ? 'Yes' : 'No',
      est.status || '',
      est.closeDate ? 'Yes' : 'No',
      est.price,
      generalEst?.archived ? 'Yes' : 'No',
      generalEst?.excludeStats ? 'Yes' : 'No',
      wouldMatch ? 'Yes' : 'No'
    ]);
  });

  writeFileSync('detailed_export_filtering_analysis.csv', analysisCsv.map(row => row.join(',')).join('\n'));
  console.log('✅ Wrote detailed_export_filtering_analysis.csv\n');
}

analyzeFiltering();

