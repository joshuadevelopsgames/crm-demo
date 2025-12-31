#!/usr/bin/env node

/**
 * Analyze the Discrepancy Pattern
 * 
 * We have 77 estimates LMN excludes, and LMN has 78 estimates we exclude.
 * The 78 LMN estimates all have empty division in LMN's export.
 * Let's check if they exist in our database and why we exclude them.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';

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

// Read LMN's 78 estimates
const lmnWorkbook = XLSX.readFile('/Users/joshua/Downloads/Estimate List - Detailed Export.xlsx');
const lmnSheet = lmnWorkbook.Sheets[lmnWorkbook.SheetNames[0]];
const lmnRows = XLSX.utils.sheet_to_json(lmnSheet, { header: 1, defval: null });

const lmnHeaders = lmnRows[0];
const idCol = lmnHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
const statusCol = lmnHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
const divCol = lmnHeaders.findIndex(h => h && h.includes('Division'));
const priceCol = lmnHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
const hoursCol = lmnHeaders.findIndex(h => h && (h.includes('Hours') || h.includes('Labor')));

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

// Get LMN's 78 estimates (sold, no division)
const lmn78Estimates = [];
for (let i = 1; i < lmnRows.length; i++) {
  const row = lmnRows[i];
  if (!row || row.length === 0) continue;
  
  const status = (row[statusCol] || '').toString().toLowerCase().trim();
  if (status.includes('sold') || 
      status === 'contract signed' ||
      status === 'work complete' ||
      status === 'billing complete') {
    
    const division = (row[divCol] || '').toString().trim();
    if (!division || division === '') {
      const id = normalizeId(row[idCol]);
      if (id) {
        lmn78Estimates.push({
          id,
          price: parseMoney(row[priceCol]),
          hours: row[hoursCol] ? parseFloat(row[hoursCol]) : null,
          status: row[statusCol]?.toString().trim() || '',
        });
      }
    }
  }
}

console.log(`📊 Found ${lmn78Estimates.length} sold estimates with no division in LMN export\n`);

// Check if these exist in our database
console.log('🔍 Checking if these estimates exist in our database...\n');

const lmn78Ids = lmn78Estimates.map(e => e.id);
const { data: ourEstimates } = await supabase
  .from('estimates')
  .select('id, lmn_estimate_id, estimate_number, estimate_close_date, status, division, total_price, labor_hours, archived, exclude_stats')
  .in('lmn_estimate_id', lmn78Ids);

const ourEstimateMap = new Map();
if (ourEstimates) {
  ourEstimates.forEach(est => {
    const id = normalizeId(est.lmn_estimate_id || est.estimate_number);
    if (id) {
      ourEstimateMap.set(id, est);
    }
  });
}

console.log(`   Found ${ourEstimateMap.size} of ${lmn78Ids.length} in our database\n`);

// Analyze why we exclude them
const found = [];
const notFound = [];

lmn78Estimates.forEach(lmnEst => {
  const ourEst = ourEstimateMap.get(lmnEst.id);
  if (ourEst) {
    found.push({ lmn: lmnEst, ours: ourEst });
  } else {
    notFound.push(lmnEst);
  }
});

console.log(`📊 Analysis:\n`);
console.log(`   In our database: ${found.length}`);
console.log(`   Not in our database: ${notFound.length}\n`);

if (found.length > 0) {
  console.log(`🔍 Why we exclude the ${found.length} that exist in our DB:\n`);
  
  const reasons = {
    noCloseDate: 0,
    wrongYear: 0,
    lostStatus: 0,
    notWonStatus: 0,
    lowPrice: 0,
    highPPH: 0,
    zeroHours: 0,
    archived: 0,
    excludeStats: 0,
  };
  
  const year2025 = 2025;
  const wonStatuses = ['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'won'];
  
  found.forEach(({ lmn, ours }) => {
    const price = parseFloat(ours.total_price) || 0;
    const hours = parseFloat(ours.labor_hours) || 0;
    const status = (ours.status || '').toString().toLowerCase().trim();
    
    if (!ours.estimate_close_date) reasons.noCloseDate++;
    else {
      const closeYear = new Date(ours.estimate_close_date).getFullYear();
      if (closeYear !== year2025) reasons.wrongYear++;
    }
    
    if (status.includes('lost')) reasons.lostStatus++;
    else if (!wonStatuses.includes(status)) reasons.notWonStatus++;
    
    if (price < 100) reasons.lowPrice++;
    
    if (hours > 0) {
      const pph = price / hours;
      if (pph > 5000) reasons.highPPH++;
    } else {
      reasons.zeroHours++;
    }
    
    if (ours.archived) reasons.archived++;
    if (ours.exclude_stats) reasons.excludeStats++;
  });
  
  console.log('Exclusion Reasons:');
  Object.entries(reasons)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`);
    });
  
  // Show examples
  console.log(`\n📋 Examples:\n`);
  found.slice(0, 10).forEach(({ lmn, ours }) => {
    const price = parseFloat(ours.total_price) || 0;
    const hours = parseFloat(ours.labor_hours) || 0;
    const status = (ours.status || '').toString().trim();
    const closeDate = ours.estimate_close_date;
    const closeYear = closeDate ? new Date(closeDate).getFullYear() : null;
    
    let why = [];
    if (!closeDate) why.push('no close date');
    else if (closeYear !== 2025) why.push(`wrong year (${closeYear})`);
    if (status.includes('lost')) why.push('lost status');
    else if (!wonStatuses.includes(status.toLowerCase())) why.push(`not won (${status})`);
    if (price < 100) why.push(`low price ($${price})`);
    if (hours === 0) why.push('zero hours');
    else if (hours > 0 && price / hours > 5000) why.push(`high PPH ($${(price/hours).toFixed(0)}/h)`);
    if (ours.archived) why.push('archived');
    if (ours.exclude_stats) why.push('exclude_stats');
    
    console.log(`  ${lmn.id}: $${price.toLocaleString()}, ${hours}h, Status: ${status}`);
    console.log(`    Why excluded: ${why.join(', ') || 'unknown'}`);
  });
}

if (notFound.length > 0) {
  console.log(`\n📋 Estimates not in our database (${notFound.length}):\n`);
  notFound.slice(0, 10).forEach(est => {
    console.log(`  ${est.id}: $${est.price.toLocaleString()}, Status: ${est.status}`);
  });
}

// Summary
console.log(`\n` + '='.repeat(60));
console.log(`📊 SUMMARY\n`);
console.log(`The $118,625 discrepancy comes from:`);
console.log(`  1. 77 estimates we include but LMN excludes (mostly Maintenance, avg $25,430)`);
console.log(`  2. 78 estimates LMN includes but we exclude (all have empty division in LMN export)`);
console.log(`  3. Net difference: $${(found.reduce((sum, {lmn}) => sum + lmn.price, 0) - found.reduce((sum, {lmn}) => sum + (parseFloat(found.find(f => f.lmn.id === f.lmn.id)?.ours?.total_price) || 0), 0)).toLocaleString()}`);
console.log(`\nPattern: LMN includes estimates with missing division data, we exclude them due to data quality filters.`);

