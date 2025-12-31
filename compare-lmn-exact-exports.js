#!/usr/bin/env node

/**
 * Compare LMN's Exact Exports with Our Database
 * 
 * This script reads:
 * - "Estimate List - Detailed Export.xlsx" - LMN's exact estimate list
 * - "Sales Pipeline Detail.xlsx" - LMN's pipeline detail with values
 * 
 * And compares with our database to find the exact exclusion rules.
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file
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
} catch (e) {
  console.error('Error loading .env file:', e);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ESTIMATE_LIST_PATH = '/Users/joshua/Downloads/Estimate List - Detailed Export.xlsx';
const PIPELINE_DETAIL_PATH = '/Users/joshua/Downloads/Sales Pipeline Detail.xlsx';

// Helper functions
function normalizeId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase();
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function parseMoney(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function readExcelFile(filePath) {
  console.log(`📖 Reading: ${filePath}`);
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    defval: null,
    raw: false 
  });
  
  if (rows.length < 2) {
    throw new Error('Excel file appears to be empty');
  }
  
  return { headers: rows[0], rows: rows.slice(1), sheetName };
}

async function compareExports() {
  console.log('🔍 Comparing LMN\'s Exact Exports with Our Database\n');
  console.log('='.repeat(60) + '\n');

  try {
    // Read Estimate List - Detailed Export
    console.log('📊 Reading LMN Estimate List...');
    const estimateList = readExcelFile(ESTIMATE_LIST_PATH);
    const estimateHeaders = estimateList.headers;
    
    // Find column indices
    const colMap = {
      estimateId: estimateHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate ID'))),
      estimateNumber: estimateHeaders.findIndex(h => h && h.includes('Estimate #')),
      estimateDate: estimateHeaders.findIndex(h => h && h.includes('Estimate Date')),
      closeDate: estimateHeaders.findIndex(h => h && (h.includes('Close Date') || h.includes('Sold Date'))),
      status: estimateHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status'))),
      division: estimateHeaders.findIndex(h => h && h.includes('Division')),
      totalPrice: estimateHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price'))),
      laborHours: estimateHeaders.findIndex(h => h && (h.includes('Hours') || h.includes('Labor'))),
    };
    
    console.log('   Column mapping:', colMap);
    
    // Parse estimates from LMN export
    const lmnEstimates = new Map();
    for (let i = 0; i < estimateList.rows.length; i++) {
      const row = estimateList.rows[i];
      if (!row || row.length === 0) continue;
      
      const estimateId = normalizeId(row[colMap.estimateId] || row[colMap.estimateNumber]);
      if (!estimateId) continue;
      
      lmnEstimates.set(estimateId, {
        estimateId,
        estimateDate: parseDate(row[colMap.estimateDate]),
        closeDate: parseDate(row[colMap.closeDate]),
        status: row[colMap.status]?.toString().trim() || null,
        division: row[colMap.division]?.toString().trim() || null,
        totalPrice: parseMoney(row[colMap.totalPrice]),
        laborHours: row[colMap.laborHours] ? parseFloat(row[colMap.laborHours]) : null,
      });
    }
    
    console.log(`✅ Found ${lmnEstimates.size} estimates in LMN export\n`);
    
    // Read Sales Pipeline Detail
    console.log('📊 Reading LMN Sales Pipeline Detail...');
    const pipelineDetail = readExcelFile(PIPELINE_DETAIL_PATH);
    const pipelineHeaders = pipelineDetail.headers;
    
    // Find column indices for pipeline
    const pipelineColMap = {
      estimateId: pipelineHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #'))),
      dollarAmount: pipelineHeaders.findIndex(h => h && (h.includes('$') || h.includes('Amount') || h.includes('Value'))),
      count: pipelineHeaders.findIndex(h => h && (h.includes('Count') || h.includes('Number'))),
    };
    
    console.log('   Column mapping:', pipelineColMap);
    
    // Extract totals from pipeline detail (for reference)
    let lmnPipelineDollar = 0;
    let lmnPipelineCount = 0;
    
    // Look for summary rows or totals
    for (let i = 0; i < pipelineDetail.rows.length; i++) {
      const row = pipelineDetail.rows[i];
      if (!row || row.length === 0) continue;
      
      // Check if this is a summary/total row
      const firstCell = row[0]?.toString().toLowerCase() || '';
      if (firstCell.includes('total') || firstCell.includes('sum') || firstCell === '') {
        const dollarValue = parseMoney(row[pipelineColMap.dollarAmount]);
        const countValue = row[pipelineColMap.count] ? parseFloat(row[pipelineColMap.count]) : null;
        
        if (dollarValue && dollarValue > 1000000) {
          lmnPipelineDollar = dollarValue;
        }
        if (countValue && countValue > 100) {
          lmnPipelineCount = countValue;
        }
      }
    }
    
    console.log(`✅ LMN Totals from Pipeline Detail (for reference):`);
    console.log(`   Dollar Amount: $${lmnPipelineDollar.toLocaleString()}`);
    console.log(`   Count: ${lmnPipelineCount}\n`);
    
    // Fetch our database estimates
    console.log('📥 Fetching estimates from our database...');
    let ourEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_close_date, status, division, total_price, labor_hours')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        ourEstimates = ourEstimates.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`✅ Found ${ourEstimates.length} estimates in our database\n`);
    
    // Create map of our estimates by ID
    const ourEstimateMap = new Map();
    ourEstimates.forEach(est => {
      const id = normalizeId(est.lmn_estimate_id || est.estimate_number);
      if (id) {
        ourEstimateMap.set(id, est);
      }
    });
    
    // Compare: Find which estimates are in LMN but not matching our criteria
    console.log('🔍 Comparing estimates...\n');
    
    const inLMN = [];
    const notInOurDB = [];
    const inOurDB = [];
    
    for (const [id, lmnEst] of lmnEstimates) {
      const ourEst = ourEstimateMap.get(id);
      if (ourEst) {
        inOurDB.push({ lmn: lmnEst, ours: ourEst, id });
      } else {
        notInOurDB.push({ lmn: lmnEst, id });
      }
      inLMN.push({ lmn: lmnEst, id });
    }
    
    console.log(`📊 Comparison Results:`);
    console.log(`   In LMN export: ${inLMN.length}`);
    console.log(`   In our database: ${inOurDB.length}`);
    console.log(`   In LMN but not in our DB: ${notInOurDB.length}\n`);
    
    // Filter LMN estimates to only "Sold" status
    const lmnSoldEstimates = Array.from(lmnEstimates.entries())
      .filter(([id, est]) => {
        const status = (est.status || '').toString().toLowerCase().trim();
        return status.includes('sold') || 
               status === 'contract signed' ||
               status === 'work complete' ||
               status === 'billing complete';
      });
    
    const lmnSoldMap = new Map(lmnSoldEstimates);
    
    // Calculate totals from LMN's SOLD list
    const lmnSoldDollarSum = lmnSoldEstimates
      .reduce((sum, [id, est]) => sum + (est.totalPrice || 0), 0);
    const lmnSoldCount = lmnSoldEstimates.length;
    
    // Also calculate total from all estimates
    const lmnTotalDollarSum = Array.from(lmnEstimates.values())
      .reduce((sum, est) => sum + (est.totalPrice || 0), 0);
    const lmnTotalCount = lmnEstimates.size;
    
    console.log(`📊 LMN Export Totals:`);
    console.log(`   Total Count: ${lmnTotalCount}`);
    console.log(`   Total Dollar: $${lmnTotalDollarSum.toLocaleString()}`);
    console.log(`   SOLD Count: ${lmnSoldCount}`);
    console.log(`   SOLD Dollar: $${lmnSoldDollarSum.toLocaleString()}\n`);
    
    // Filter our estimates to match LMN's criteria (2025, not lost, won statuses)
    const year2025 = 2025;
    const wonStatuses = [
      'contract signed',
      'work complete',
      'billing complete',
      'email contract award',
      'verbal contract award',
      'won'
    ];
    
    const ourFiltered = ourEstimates.filter(est => {
      // Must have close_date in 2025
      if (!est.estimate_close_date) return false;
      const closeDate = new Date(est.estimate_close_date);
      const year = closeDate.getFullYear();
      if (year !== year2025) return false;
      
      // Exclude lost
      const status = (est.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      
      // Must be won status
      if (!wonStatuses.includes(status)) return false;
      
      return true;
    });
    
    const ourDollarSum = ourFiltered.reduce((sum, est) => sum + (parseFloat(est.total_price) || 0), 0);
    const ourCount = ourFiltered.length;
    
    console.log(`📊 Our Filtered Totals (2025, not lost, won):`);
    console.log(`   Count: ${ourCount}`);
    console.log(`   Dollar Sum: $${ourDollarSum.toLocaleString()}\n`);
    
    // Find which estimates we have that LMN excludes (comparing SOLD only)
    const ourEstimateIds = new Set(ourFiltered.map(est => 
      normalizeId(est.lmn_estimate_id || est.estimate_number)
    ));
    const lmnSoldEstimateIds = new Set(Array.from(lmnSoldMap.keys()));
    
    const weHaveButLMNExcludes = ourFiltered.filter(est => {
      const id = normalizeId(est.lmn_estimate_id || est.estimate_number);
      return id && !lmnSoldEstimateIds.has(id);
    });
    
    const lmnHasButWeExclude = Array.from(lmnSoldMap.entries())
      .filter(([id]) => {
        const ourEst = ourEstimateMap.get(id);
        if (!ourEst) return false;
        const status = (ourEst.status || '').toString().toLowerCase().trim();
        return !wonStatuses.includes(status) || status.includes('lost');
      });
    
    console.log(`📊 Exclusion Analysis:`);
    console.log(`   We have but LMN excludes: ${weHaveButLMNExcludes.length}`);
    console.log(`   LMN has but we exclude: ${lmnHasButWeExclude.length}\n`);
    
    // Analyze the excluded estimates
    if (weHaveButLMNExcludes.length > 0) {
      console.log(`🔍 Analyzing ${weHaveButLMNExcludes.length} estimates we have but LMN excludes:\n`);
      
      const excludedByDivision = {};
      const excludedByPrice = [];
      const excludedByHours = [];
      const excludedByPPH = [];
      
      weHaveButLMNExcludes.forEach(est => {
        const division = est.division || 'Unknown';
        excludedByDivision[division] = (excludedByDivision[division] || 0) + 1;
        
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const pph = hours > 0 ? price / hours : 0;
        
        excludedByPrice.push({ id: est.lmn_estimate_id, price, division });
        excludedByHours.push({ id: est.lmn_estimate_id, hours, division });
        if (pph > 0) {
          excludedByPPH.push({ id: est.lmn_estimate_id, pph, price, hours, division });
        }
      });
      
      console.log('   By Division:');
      Object.entries(excludedByDivision)
        .sort((a, b) => b[1] - a[1])
        .forEach(([div, count]) => {
          console.log(`     ${div}: ${count}`);
        });
      
      console.log('\n   High Price-Per-Hour (>$10k):');
      excludedByPPH
        .filter(e => e.pph > 10000)
        .sort((a, b) => b.pph - a.pph)
        .slice(0, 10)
        .forEach(e => {
          console.log(`     ${e.id}: $${e.price.toLocaleString()} / ${e.hours}h = $${e.pph.toFixed(0)}/h (${e.division})`);
        });
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY\n');
    console.log(`LMN SOLD Estimates:`);
    console.log(`  Count: ${lmnSoldCount}`);
    console.log(`  Dollar: $${lmnSoldDollarSum.toLocaleString()}`);
    console.log(`\nOur Filtered (2025, not lost, won):`);
    console.log(`  Count: ${ourCount} (diff: ${ourCount - lmnSoldCount})`);
    console.log(`  Dollar: $${ourDollarSum.toLocaleString()} (diff: $${(ourDollarSum - lmnSoldDollarSum).toLocaleString()})`);
    console.log(`\nWe need to exclude ${weHaveButLMNExcludes.length} estimates to match LMN's SOLD list.`);
    
    // Export the excluded estimates for analysis
    console.log(`\n💾 Exporting excluded estimates to CSV...`);
    const csvRows = [
      ['Estimate ID', 'Division', 'Price', 'Hours', 'Price/Hour', 'Status', 'Close Date']
    ];
    
    weHaveButLMNExcludes.forEach(est => {
      const price = parseFloat(est.total_price) || 0;
      const hours = parseFloat(est.labor_hours) || 0;
      const pph = hours > 0 ? (price / hours).toFixed(2) : '';
      csvRows.push([
        est.lmn_estimate_id || est.estimate_number || '',
        est.division || '',
        price,
        hours || '',
        pph,
        est.status || '',
        est.estimate_close_date || ''
      ]);
    });
    
    const csv = csvRows.map(row => row.join(',')).join('\n');
    const fs = await import('fs');
    fs.writeFileSync('lmn_excluded_estimates.csv', csv);
    console.log(`✅ Wrote lmn_excluded_estimates.csv`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

compareExports();

