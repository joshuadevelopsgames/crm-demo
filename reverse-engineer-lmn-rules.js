#!/usr/bin/env node

/**
 * Reverse-Engineer LMN's Exact Exclusion Rules
 * 
 * We have LMN's exact list of 924 estimates.
 * We know which estimates we include that LMN excludes (77).
 * We know which estimates LMN includes that we exclude (78).
 * 
 * Let's analyze the patterns to find the exact rules.
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

// Load env
try {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^[\"']|[\"']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  }
} catch (e) {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

async function reverseEngineer() {
  console.log('🔍 Reverse-Engineering LMN\'s Exact Exclusion Rules\n');
  console.log('='.repeat(60) + '\n');

  // Read our final kept list (after all exclusions)
  console.log('📖 Reading our final kept list...');
  const ourKeptCsv = readFileSync('optimal_kept.csv', 'utf-8');
  const exact26Csv = readFileSync('exact_26_exclusions.csv', 'utf-8');
  
  const ourKeptMap = new Map();
  ourKeptCsv.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const [id, num, date, status, division, price, hours, pph] = line.split(',');
    if (id && id !== 'Estimate ID') {
      ourKeptMap.set(id, {
        id,
        division: division || '',
        price: parseFloat(price) || 0,
        hours: hours ? parseFloat(hours) : 0,
        pph: pph ? parseFloat(pph) : 0,
      });
    }
  });
  
  const exact26Ids = new Set();
  exact26Csv.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const [id] = line.split(',');
    if (id && id !== 'Estimate ID') {
      exact26Ids.add(id);
    }
  });
  
  // Our final list (excluding the 26)
  const ourFinal = Array.from(ourKeptMap.entries())
    .filter(([id]) => !exact26Ids.has(id))
    .map(([id, est]) => ({ id, ...est }));
  
  console.log(`   Our final list: ${ourFinal.length} estimates\n`);
  
  // Read LMN's exact export
  console.log('📖 Reading LMN\'s exact export...');
  const lmnWorkbook = XLSX.readFile('/Users/joshua/Downloads/Estimate List - Detailed Export.xlsx');
  const lmnSheet = lmnWorkbook.Sheets[lmnWorkbook.SheetNames[0]];
  const lmnRows = XLSX.utils.sheet_to_json(lmnSheet, { header: 1, defval: null });
  
  const lmnHeaders = lmnRows[0];
  const idCol = lmnHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
  const statusCol = lmnHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
  const divCol = lmnHeaders.findIndex(h => h && h.includes('Division'));
  const priceCol = lmnHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
  const hoursCol = lmnHeaders.findIndex(h => h && (h.includes('Hours') || h.includes('Labor')));
  const dateCol = lmnHeaders.findIndex(h => h && (h.includes('Close Date') || h.includes('Sold Date')));
  const typeCol = lmnHeaders.findIndex(h => h && h.includes('Estimate Type'));
  const versionCol = lmnHeaders.findIndex(h => h && h.includes('Version'));
  
  // Get LMN's sold estimates
  const lmnSold = [];
  for (let i = 1; i < lmnRows.length; i++) {
    const row = lmnRows[i];
    if (!row || row.length === 0) continue;
    
    const status = (row[statusCol] || '').toString().toLowerCase().trim();
    if (status.includes('sold') || 
        status === 'contract signed' ||
        status === 'work complete' ||
        status === 'billing complete') {
      
      const id = normalizeId(row[idCol]);
      if (id) {
        lmnSold.push({
          id,
          division: (row[divCol] || '').toString().trim(),
          price: parseMoney(row[priceCol]),
          hours: row[hoursCol] ? parseFloat(row[hoursCol]) : null,
          date: row[dateCol],
          type: (row[typeCol] || '').toString().trim(),
          version: (row[versionCol] || '').toString().trim(),
          status: (row[statusCol] || '').toString().trim(),
        });
      }
    }
  }
  
  console.log(`   LMN sold list: ${lmnSold.length} estimates\n`);
  
  // Create maps
  const ourMap = new Map(ourFinal.map(est => [est.id, est]));
  const lmnMap = new Map(lmnSold.map(est => [est.id, est]));
  
  // Find differences
  const weIncludeButLMNExcludes = ourFinal.filter(est => !lmnMap.has(est.id));
  const lmnIncludesButWeExclude = lmnSold.filter(est => !ourMap.has(est.id));
  
  console.log(`📊 Differences Found:\n`);
  console.log(`   We include but LMN excludes: ${weIncludeButLMNExcludes.length}`);
  console.log(`   LMN includes but we exclude: ${lmnIncludesButWeExclude.length}\n`);
  
  // Fetch full data from our database for analysis
  console.log('📥 Fetching full estimate data from database...');
  const allIds = [...new Set([...weIncludeButLMNExcludes.map(e => e.id), ...lmnIncludesButWeExclude.map(e => e.id)])];
  
  let allEstimates = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .in('lmn_estimate_id', allIds)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      allEstimates = allEstimates.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  const dbMap = new Map();
  allEstimates.forEach(est => {
    const id = normalizeId(est.lmn_estimate_id || est.estimate_number);
    if (id) {
      dbMap.set(id, est);
    }
  });
  
  console.log(`   Found ${dbMap.size} estimates in database\n`);
  
  // Analyze: Why does LMN exclude the ones we include?
  console.log('🔍 Analyzing: Why does LMN exclude estimates we include?\n');
  console.log(`   Analyzing ${weIncludeButLMNExcludes.length} estimates...\n`);
  
  const lmnExclusionPatterns = {
    byDivision: {},
    byPriceRange: { '0-1000': 0, '1000-5000': 0, '5000-10000': 0, '10000-25000': 0, '25000-50000': 0, '50000+': 0 },
    byHours: { '0': 0, '1-2': 0, '3-5': 0, '6-10': 0, '11-20': 0, '21+': 0 },
    byPPH: { '0-1000': 0, '1000-2000': 0, '2000-3000': 0, '3000-4000': 0, '4000-5000': 0, '5000+': 0 },
    byDate: {},
    byType: {},
    byVersion: {},
  };
  
  weIncludeButLMNExcludes.forEach(est => {
    const dbEst = dbMap.get(est.id);
    
    const div = est.division || 'Unknown';
    lmnExclusionPatterns.byDivision[div] = (lmnExclusionPatterns.byDivision[div] || 0) + 1;
    
    const price = est.price;
    if (price < 1000) lmnExclusionPatterns.byPriceRange['0-1000']++;
    else if (price < 5000) lmnExclusionPatterns.byPriceRange['1000-5000']++;
    else if (price < 10000) lmnExclusionPatterns.byPriceRange['5000-10000']++;
    else if (price < 25000) lmnExclusionPatterns.byPriceRange['10000-25000']++;
    else if (price < 50000) lmnExclusionPatterns.byPriceRange['25000-50000']++;
    else lmnExclusionPatterns.byPriceRange['50000+']++;
    
    const hours = est.hours || 0;
    if (hours === 0) lmnExclusionPatterns.byHours['0']++;
    else if (hours <= 2) lmnExclusionPatterns.byHours['1-2']++;
    else if (hours <= 5) lmnExclusionPatterns.byHours['3-5']++;
    else if (hours <= 10) lmnExclusionPatterns.byHours['6-10']++;
    else if (hours <= 20) lmnExclusionPatterns.byHours['11-20']++;
    else lmnExclusionPatterns.byHours['21+']++;
    
    const pph = est.pph || 0;
    if (pph === 0) lmnExclusionPatterns.byPPH['0-1000']++;
    else if (pph < 1000) lmnExclusionPatterns.byPPH['0-1000']++;
    else if (pph < 2000) lmnExclusionPatterns.byPPH['1000-2000']++;
    else if (pph < 3000) lmnExclusionPatterns.byPPH['2000-3000']++;
    else if (pph < 4000) lmnExclusionPatterns.byPPH['3000-4000']++;
    else if (pph < 5000) lmnExclusionPatterns.byPPH['4000-5000']++;
    else lmnExclusionPatterns.byPPH['5000+']++;
    
    if (dbEst) {
      const closeDate = dbEst.estimate_close_date;
      if (closeDate) {
        const date = new Date(closeDate);
        const month = date.toLocaleString('default', { month: 'short' });
        lmnExclusionPatterns.byDate[month] = (lmnExclusionPatterns.byDate[month] || 0) + 1;
      }
      
      const type = dbEst.estimate_type || 'Unknown';
      lmnExclusionPatterns.byType[type] = (lmnExclusionPatterns.byType[type] || 0) + 1;
      
      const version = dbEst.version || 'Unknown';
      lmnExclusionPatterns.byVersion[version] = (lmnExclusionPatterns.byVersion[version] || 0) + 1;
    }
  });
  
  console.log('📊 Patterns in estimates LMN excludes (that we include):\n');
  console.log('By Division:');
  Object.entries(lmnExclusionPatterns.byDivision)
    .sort((a, b) => b[1] - a[1])
    .forEach(([div, count]) => {
      console.log(`  ${div}: ${count}`);
    });
  
  console.log('\nBy Price Range:');
  Object.entries(lmnExclusionPatterns.byPriceRange).forEach(([range, count]) => {
    if (count > 0) console.log(`  $${range}: ${count}`);
  });
  
  console.log('\nBy Hours:');
  Object.entries(lmnExclusionPatterns.byHours).forEach(([range, count]) => {
    if (count > 0) console.log(`  ${range}: ${count}`);
  });
  
  console.log('\nBy Price-Per-Hour:');
  Object.entries(lmnExclusionPatterns.byPPH).forEach(([range, count]) => {
    if (count > 0) console.log(`  $${range}/h: ${count}`);
  });
  
  console.log('\nBy Month (Close Date):');
  Object.entries(lmnExclusionPatterns.byDate)
    .sort((a, b) => b[1] - a[1])
    .forEach(([month, count]) => {
      console.log(`  ${month}: ${count}`);
    });
  
  console.log('\nBy Estimate Type:');
  Object.entries(lmnExclusionPatterns.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  
  console.log('\nBy Version:');
  Object.entries(lmnExclusionPatterns.byVersion)
    .sort((a, b) => b[1] - a[1])
    .forEach(([version, count]) => {
      console.log(`  ${version}: ${count}`);
    });
  
  // Analyze: Why do we exclude the ones LMN includes?
  console.log('\n\n🔍 Analyzing: Why do we exclude estimates LMN includes?\n');
  console.log(`   Analyzing ${lmnIncludesButWeExclude.length} estimates...\n`);
  
  const ourExclusionPatterns = {
    byDivision: {},
    byPriceRange: { '0-100': 0, '100-500': 0, '500-1000': 0, '1000-5000': 0, '5000+': 0 },
    byHours: { '0': 0, '1-2': 0, '3-5': 0, '6-10': 0, '11-20': 0, '21+': 0 },
    byPPH: { '0-1000': 0, '1000-2000': 0, '2000-3000': 0, '3000-4000': 0, '4000-5000': 0, '5000+': 0 },
    byHasDivision: { 'has': 0, 'missing': 0 },
  };
  
  lmnIncludesButWeExclude.forEach(lmnEst => {
    const dbEst = dbMap.get(lmnEst.id);
    
    const div = lmnEst.division || 'Unknown';
    ourExclusionPatterns.byDivision[div] = (ourExclusionPatterns.byDivision[div] || 0) + 1;
    
    if (div === '' || div === 'Unknown') {
      ourExclusionPatterns.byHasDivision['missing']++;
    } else {
      ourExclusionPatterns.byHasDivision['has']++;
    }
    
    const price = lmnEst.price;
    if (price < 100) ourExclusionPatterns.byPriceRange['0-100']++;
    else if (price < 500) ourExclusionPatterns.byPriceRange['100-500']++;
    else if (price < 1000) ourExclusionPatterns.byPriceRange['500-1000']++;
    else if (price < 5000) ourExclusionPatterns.byPriceRange['1000-5000']++;
    else ourExclusionPatterns.byPriceRange['5000+']++;
    
    const hours = lmnEst.hours || 0;
    if (hours === 0) ourExclusionPatterns.byHours['0']++;
    else if (hours <= 2) ourExclusionPatterns.byHours['1-2']++;
    else if (hours <= 5) ourExclusionPatterns.byHours['3-5']++;
    else if (hours <= 10) ourExclusionPatterns.byHours['6-10']++;
    else if (hours <= 20) ourExclusionPatterns.byHours['11-20']++;
    else ourExclusionPatterns.byHours['21+']++;
    
    if (dbEst) {
      const dbHours = parseFloat(dbEst.labor_hours) || 0;
      const dbPrice = parseFloat(dbEst.total_price) || 0;
      const pph = dbHours > 0 ? dbPrice / dbHours : 0;
      
      if (pph === 0) ourExclusionPatterns.byPPH['0-1000']++;
      else if (pph < 1000) ourExclusionPatterns.byPPH['0-1000']++;
      else if (pph < 2000) ourExclusionPatterns.byPPH['1000-2000']++;
      else if (pph < 3000) ourExclusionPatterns.byPPH['2000-3000']++;
      else if (pph < 4000) ourExclusionPatterns.byPPH['3000-4000']++;
      else if (pph < 5000) ourExclusionPatterns.byPPH['4000-5000']++;
      else ourExclusionPatterns.byPPH['5000+']++;
    }
  });
  
  console.log('📊 Patterns in estimates we exclude (that LMN includes):\n');
  console.log('By Division (in LMN export):');
  Object.entries(ourExclusionPatterns.byDivision)
    .sort((a, b) => b[1] - a[1])
    .forEach(([div, count]) => {
      console.log(`  ${div || '(empty)'}: ${count}`);
    });
  
  console.log('\nHas Division in LMN Export:');
  Object.entries(ourExclusionPatterns.byHasDivision).forEach(([has, count]) => {
    console.log(`  ${has}: ${count}`);
  });
  
  console.log('\nBy Price Range:');
  Object.entries(ourExclusionPatterns.byPriceRange).forEach(([range, count]) => {
    if (count > 0) console.log(`  $${range}: ${count}`);
  });
  
  console.log('\nBy Hours (from LMN export):');
  Object.entries(ourExclusionPatterns.byHours).forEach(([range, count]) => {
    if (count > 0) console.log(`  ${range}: ${count}`);
  });
  
  console.log('\nBy Price-Per-Hour (from our DB):');
  Object.entries(ourExclusionPatterns.byPPH).forEach(([range, count]) => {
    if (count > 0) console.log(`  $${range}/h: ${count}`);
  });
  
  // Look for specific patterns
  console.log('\n\n🎯 Looking for Specific Exclusion Patterns...\n');
  
  // Pattern 1: Maintenance division with specific characteristics
  const maintenanceWeInclude = weIncludeButLMNExcludes.filter(e => e.division.includes('Maintenance'));
  console.log(`Maintenance estimates we include but LMN excludes: ${maintenanceWeInclude.length}`);
  
  if (maintenanceWeInclude.length > 0) {
    const maintenancePPH = maintenanceWeInclude.map(e => e.pph).filter(pph => pph > 0).sort((a, b) => a - b);
    const maintenanceHours = maintenanceWeInclude.map(e => e.hours).sort((a, b) => a - b);
    const maintenancePrices = maintenanceWeInclude.map(e => e.price).sort((a, b) => a - b);
    
    console.log(`  PPH range: $${maintenancePPH[0]?.toFixed(2)} - $${maintenancePPH[maintenancePPH.length - 1]?.toFixed(2)}`);
    console.log(`  Hours range: ${maintenanceHours[0]} - ${maintenanceHours[maintenanceHours.length - 1]}`);
    console.log(`  Price range: $${maintenancePrices[0]?.toLocaleString()} - $${maintenancePrices[maintenancePrices.length - 1]?.toLocaleString()}`);
    
    // Check for date clustering
    const maintenanceDates = [];
    maintenanceWeInclude.forEach(est => {
      const dbEst = dbMap.get(est.id);
      if (dbEst?.estimate_close_date) {
        maintenanceDates.push(new Date(dbEst.estimate_close_date));
      }
    });
    
    if (maintenanceDates.length > 0) {
      const datesByMonth = {};
      maintenanceDates.forEach(date => {
        const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        datesByMonth[month] = (datesByMonth[month] || 0) + 1;
      });
      
      console.log(`  Date clustering:`);
      Object.entries(datesByMonth)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([month, count]) => {
          console.log(`    ${month}: ${count}`);
        });
    }
  }
  
  // Export detailed comparison
  console.log('\n💾 Exporting detailed comparison...');
  
  const comparisonCsv = [
    ['Estimate ID', 'In Our List', 'In LMN List', 'Division', 'Price', 'Hours', 'PPH', 'Why Different']
  ];
  
  // Add estimates we include but LMN excludes
  weIncludeButLMNExcludes.forEach(est => {
    comparisonCsv.push([
      est.id,
      'Yes',
      'No',
      est.division,
      est.price,
      est.hours || '',
      est.pph ? est.pph.toFixed(2) : '',
      'We include but LMN excludes'
    ]);
  });
  
  // Add estimates LMN includes but we exclude
  lmnIncludesButWeExclude.forEach(lmnEst => {
    const dbEst = dbMap.get(lmnEst.id);
    const dbHours = dbEst ? (parseFloat(dbEst.labor_hours) || 0) : (lmnEst.hours || 0);
    const dbPrice = dbEst ? (parseFloat(dbEst.total_price) || 0) : lmnEst.price;
    const pph = dbHours > 0 ? dbPrice / dbHours : 0;
    
    comparisonCsv.push([
      lmnEst.id,
      'No',
      'Yes',
      lmnEst.division || '(empty in LMN)',
      lmnEst.price,
      lmnEst.hours || '',
      pph ? pph.toFixed(2) : '',
      'LMN includes but we exclude'
    ]);
  });
  
  writeFileSync('lmn_vs_our_detailed_comparison.csv', comparisonCsv.map(row => row.join(',')).join('\n'));
  console.log('✅ Wrote lmn_vs_our_detailed_comparison.csv\n');
  
  // Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY\n');
  console.log(`We include but LMN excludes: ${weIncludeButLMNExcludes.length} estimates`);
  console.log(`  - ${maintenanceWeInclude.length} are Maintenance division`);
  console.log(`  - Average price: $${(weIncludeButLMNExcludes.reduce((s, e) => s + e.price, 0) / weIncludeButLMNExcludes.length).toLocaleString()}`);
  console.log(`\nLMN includes but we exclude: ${lmnIncludesButWeExclude.length} estimates`);
  console.log(`  - ${ourExclusionPatterns.byHasDivision['missing']} have missing division in LMN export`);
  console.log(`  - Average price: $${(lmnIncludesButWeExclude.reduce((s, e) => s + e.price, 0) / lmnIncludesButWeExclude.length).toLocaleString()}`);
}

reverseEngineer();

