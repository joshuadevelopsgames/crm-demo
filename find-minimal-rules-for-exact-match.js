#!/usr/bin/env node

/**
 * Find Minimal Rules for Exact Match
 * 
 * We have LMN's exact list of 924 estimates.
 * Let's find the minimal set of rules that produces that exact list.
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

function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  return ['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'won'].includes(statusLower);
}

function contains(s, pat) {
  const regex = new RegExp(pat, 'i');
  return regex.test((s || '').toString().trim());
}

async function findMinimalRules() {
  console.log('🔍 Finding Minimal Rules for Exact LMN Match\n');
  console.log('='.repeat(60) + '\n');

  // Get LMN's exact 924 list
  console.log('📖 Reading LMN\'s exact export...');
  const lmnWorkbook = XLSX.readFile('/Users/joshua/Downloads/Estimate List - Detailed Export.xlsx');
  const lmnSheet = lmnWorkbook.Sheets[lmnWorkbook.SheetNames[0]];
  const lmnRows = XLSX.utils.sheet_to_json(lmnSheet, { header: 1, defval: null });

  const lmnHeaders = lmnRows[0];
  const idCol = lmnHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
  const statusCol = lmnHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));

  const lmnSoldIds = new Set();
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
        lmnSoldIds.add(id);
      }
    }
  }

  console.log(`   LMN's exact list: ${lmnSoldIds.size} estimates\n`);

  // Fetch our estimates
  console.log('📥 Fetching our estimates...');
  let allEstimates = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .order('created_at', { ascending: false })
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

  // Base filter: 2025, not lost, won
  const periodStart = new Date('2025-01-01T00:00:00');
  const periodEnd = new Date('2025-12-31T23:59:59');

  const baseFiltered = allEstimates.filter(est => {
    if (!est.estimate_close_date) return false;
    const closeDate = new Date(est.estimate_close_date);
    if (closeDate < periodStart || closeDate > periodEnd) return false;
    
    const status = (est.status || '').toString().toLowerCase().trim();
    if (contains(status, 'lost')) return false;
    if (!isWonStatus(est.status)) return false;
    
    return true;
  });

  console.log(`   Base filtered: ${baseFiltered.length} estimates\n`);

  // Find which ones LMN includes/excludes
  const lmnIncludes = [];
  const lmnExcludes = [];

  baseFiltered.forEach(est => {
    const id = normalizeId(est.lmn_estimate_id || est.estimate_number);
    if (id) {
      if (lmnSoldIds.has(id)) {
        lmnIncludes.push(est);
      } else {
        lmnExcludes.push(est);
      }
    }
  });

  console.log(`📊 Comparison:\n`);
  console.log(`   LMN includes: ${lmnIncludes.length}`);
  console.log(`   LMN excludes: ${lmnExcludes.length}\n`);

  // Analyze what LMN excludes
  console.log('🔍 Analyzing what LMN excludes:\n');

  const exclusionPatterns = {
    byDivision: {},
    byType: {},
    byVersion: {},
    byHours: { '0': 0, '1-5': 0, '6-15': 0, '16-25': 0, '26+': 0 },
    byPrice: { '0-5k': 0, '5k-10k': 0, '10k-25k': 0, '25k-50k': 0, '50k+': 0 },
    byPPH: { '0-1000': 0, '1000-2000': 0, '2000-3000': 0, '3000-4000': 0, '4000-5000': 0, '5000+': 0 },
    maintenanceService: [],
    maintenanceVersion2026or2027: [],
    maintenanceZeroHours: [],
    maintenanceServiceVersion2026or2027: [],
    maintenanceServiceZeroHours: [],
  };

  lmnExcludes.forEach(est => {
    const division = (est.division || '').toString().trim();
    const type = (est.estimate_type || '').toString().trim();
    const version = (est.version || '').toString().trim();
    const price = parseFloat(est.total_price) || 0;
    const hours = parseFloat(est.labor_hours) || 0;
    const pph = hours > 0 ? price / hours : 0;

    exclusionPatterns.byDivision[division] = (exclusionPatterns.byDivision[division] || 0) + 1;
    exclusionPatterns.byType[type] = (exclusionPatterns.byType[type] || 0) + 1;
    exclusionPatterns.byVersion[version] = (exclusionPatterns.byVersion[version] || 0) + 1;

    if (hours === 0) exclusionPatterns.byHours['0']++;
    else if (hours <= 5) exclusionPatterns.byHours['1-5']++;
    else if (hours <= 15) exclusionPatterns.byHours['6-15']++;
    else if (hours <= 25) exclusionPatterns.byHours['16-25']++;
    else exclusionPatterns.byHours['26+']++;

    if (price < 5000) exclusionPatterns.byPrice['0-5k']++;
    else if (price < 10000) exclusionPatterns.byPrice['5k-10k']++;
    else if (price < 25000) exclusionPatterns.byPrice['10k-25k']++;
    else if (price < 50000) exclusionPatterns.byPrice['25k-50k']++;
    else exclusionPatterns.byPrice['50k+']++;

    if (pph === 0 || pph < 1000) exclusionPatterns.byPPH['0-1000']++;
    else if (pph < 2000) exclusionPatterns.byPPH['1000-2000']++;
    else if (pph < 3000) exclusionPatterns.byPPH['2000-3000']++;
    else if (pph < 4000) exclusionPatterns.byPPH['3000-4000']++;
    else if (pph < 5000) exclusionPatterns.byPPH['4000-5000']++;
    else exclusionPatterns.byPPH['5000+']++;

    if (division.includes('Maintenance') && type.toLowerCase().includes('service')) {
      exclusionPatterns.maintenanceService.push(est);
      if (version.includes('2026') || version.includes('2027')) {
        exclusionPatterns.maintenanceServiceVersion2026or2027.push(est);
      }
      if (hours === 0) {
        exclusionPatterns.maintenanceServiceZeroHours.push(est);
      }
    }
    if (division.includes('Maintenance') && (version.includes('2026') || version.includes('2027'))) {
      exclusionPatterns.maintenanceVersion2026or2027.push(est);
    }
    if (division.includes('Maintenance') && hours === 0) {
      exclusionPatterns.maintenanceZeroHours.push(est);
    }
  });

  console.log('By Division:');
  Object.entries(exclusionPatterns.byDivision)
    .sort((a, b) => b[1] - a[1])
    .forEach(([div, count]) => {
      console.log(`  ${div || '(empty)'}: ${count}`);
    });

  console.log('\nBy Type:');
  Object.entries(exclusionPatterns.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type || '(empty)'}: ${count}`);
    });

  console.log('\nBy Version:');
  Object.entries(exclusionPatterns.byVersion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([version, count]) => {
      console.log(`  ${version || '(empty)'}: ${count}`);
    });

  console.log('\n📊 Key Patterns:');
  console.log(`  Maintenance + Service: ${exclusionPatterns.maintenanceService.length}`);
  console.log(`  Maintenance + Version 2026/2027: ${exclusionPatterns.maintenanceVersion2026or2027.length}`);
  console.log(`  Maintenance + Zero Hours: ${exclusionPatterns.maintenanceZeroHours.length}`);
  console.log(`  Maintenance + Service + Version 2026/2027: ${exclusionPatterns.maintenanceServiceVersion2026or2027.length}`);
  console.log(`  Maintenance + Service + Zero Hours: ${exclusionPatterns.maintenanceServiceZeroHours.length}\n`);

  // Test rules to see which produces LMN's exact list
  console.log('🧪 Testing Rules to Match LMN\'s Exact List:\n');

  const testRules = [
    {
      name: 'Base Rules Only (PPH > $5k, Price < $100, Zero Hours + Low Price)',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        return false;
      }
    },
    {
      name: 'Base + Maintenance Service with Version 2026/2027',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const version = (est.version || '').toString().trim();
        
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New: Maintenance Service with Version 2026/2027
        if (division.includes('Maintenance') && 
            type.toLowerCase().includes('service') &&
            (version.includes('2026') || version.includes('2027'))) {
          return true;
        }
        return false;
      }
    },
    {
      name: 'Base + Maintenance Service (all)',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New: All Maintenance Service
        if (division.includes('Maintenance') && type.toLowerCase().includes('service')) {
          return true;
        }
        return false;
      }
    },
  ];

  testRules.forEach(rule => {
    const kept = baseFiltered.filter(est => !rule.exclude(est));
    const keptIds = new Set(kept.map(est => normalizeId(est.lmn_estimate_id || est.estimate_number)));
    
    // Check how many match LMN's list
    let matches = 0;
    let weHaveButLMNDoesnt = 0;
    let lmnHasButWeDont = 0;
    
    keptIds.forEach(id => {
      if (lmnSoldIds.has(id)) matches++;
      else weHaveButLMNDoesnt++;
    });
    
    lmnSoldIds.forEach(id => {
      if (!keptIds.has(id)) lmnHasButWeDont++;
    });
    
    const count = kept.length;
    const dollar = kept.reduce((sum, est) => sum + (parseFloat(est.total_price) || 0), 0);
    
    const countDiff = Math.abs(count - 924);
    const dollarDiff = Math.abs(dollar - 11_049_470.84);
    const countAccuracy = (1 - countDiff / 924) * 100;
    const dollarAccuracy = (1 - dollarDiff / 11_049_470.84) * 100;
    
    console.log(`${rule.name}:`);
    console.log(`  Count: ${count} (target: 924, diff: ${countDiff}, ${countAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Dollar: $${dollar.toLocaleString()} (target: $11,049,470.84, diff: $${dollarDiff.toLocaleString()}, ${dollarAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Matches LMN list: ${matches} estimates`);
    console.log(`  We have but LMN doesn't: ${weHaveButLMNDoesnt}`);
    console.log(`  LMN has but we don't: ${lmnHasButWeDont}\n`);
  });

  // Analyze the exact differences
  console.log('='.repeat(60));
  console.log('🔍 Exact Difference Analysis\n');
  
  // Apply best current rule
  const bestRule = testRules[0]; // Base rules
  const ourKept = baseFiltered.filter(est => !bestRule.exclude(est));
  const ourKeptIds = new Set(ourKept.map(est => normalizeId(est.lmn_estimate_id || est.estimate_number)));
  
  const weHaveButLMNDoesnt = Array.from(ourKeptIds).filter(id => !lmnSoldIds.has(id));
  const lmnHasButWeDont = Array.from(lmnSoldIds).filter(id => !ourKeptIds.has(id));
  
  console.log(`We have but LMN excludes: ${weHaveButLMNDoesnt.length} estimates`);
  console.log(`LMN has but we exclude: ${lmnHasButWeDont.length} estimates\n`);
  
  // Get data for these
  const { data: weHaveData } = await supabase
    .from('estimates')
    .select('*')
    .in('lmn_estimate_id', weHaveButLMNDoesnt);
  
  const { data: lmnHasData } = await supabase
    .from('estimates')
    .select('*')
    .in('lmn_estimate_id', lmnHasButWeDont);
  
  console.log('📊 Analyzing the exact differences:\n');
  
  if (weHaveData && weHaveData.length > 0) {
    console.log(`Estimates we include but LMN excludes (${weHaveData.length}):`);
    const byDivision = {};
    const byType = {};
    const byVersion = {};
    
    weHaveData.forEach(est => {
      const div = (est.division || '').toString().trim();
      const type = (est.estimate_type || '').toString().trim();
      const version = (est.version || '').toString().trim();
      
      byDivision[div] = (byDivision[div] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      byVersion[version] = (byVersion[version] || 0) + 1;
    });
    
    console.log('  By Division:');
    Object.entries(byDivision).sort((a, b) => b[1] - a[1]).forEach(([div, count]) => {
      console.log(`    ${div || '(empty)'}: ${count}`);
    });
    
    console.log('  By Type:');
    Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`    ${type || '(empty)'}: ${count}`);
    });
    
    console.log('  By Version:');
    Object.entries(byVersion).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([version, count]) => {
      console.log(`    ${version || '(empty)'}: ${count}`);
    });
  }
  
  if (lmnHasData && lmnHasData.length > 0) {
    console.log(`\nEstimates LMN includes but we exclude (${lmnHasData.length}):`);
    const byDivision = {};
    const byType = {};
    const byHours = { '0': 0, '1-2': 0, '3+': 0 };
    const byPrice = { '0-100': 0, '100-1000': 0, '1000+': 0 };
    
    lmnHasData.forEach(est => {
      const div = (est.division || '').toString().trim();
      const type = (est.estimate_type || '').toString().trim();
      const hours = parseFloat(est.labor_hours) || 0;
      const price = parseFloat(est.total_price) || 0;
      
      byDivision[div] = (byDivision[div] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      
      if (hours === 0) byHours['0']++;
      else if (hours <= 2) byHours['1-2']++;
      else byHours['3+']++;
      
      if (price < 100) byPrice['0-100']++;
      else if (price < 1000) byPrice['100-1000']++;
      else byPrice['1000+']++;
    });
    
    console.log('  By Division:');
    Object.entries(byDivision).sort((a, b) => b[1] - a[1]).forEach(([div, count]) => {
      console.log(`    ${div || '(empty)'}: ${count}`);
    });
    
    console.log('  By Hours:');
    Object.entries(byHours).forEach(([range, count]) => {
      if (count > 0) console.log(`    ${range}: ${count}`);
    });
    
    console.log('  By Price:');
    Object.entries(byPrice).forEach(([range, count]) => {
      if (count > 0) console.log(`    $${range}: ${count}`);
    });
  }
}

findMinimalRules();

