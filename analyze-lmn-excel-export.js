#!/usr/bin/env node

/**
 * Analyze the LMN Estimates List.xlsx export to understand what data they're including/excluding
 * Compare with our database to see why we have more estimates
 */

import XLSX from 'xlsx';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

// Try to load .env file if it exists
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

function getYearFromDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'number') {
    // Excel serial date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
    return date.getUTCFullYear();
  }
  if (dateValue instanceof Date) {
    return dateValue.getFullYear();
  }
  const dateStr = String(dateValue);
  if (dateStr.length >= 4) {
    return parseInt(dateStr.substring(0, 4));
  }
  return null;
}

function parseExcelDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function analyzeLMNExport() {
  console.log('📊 Analyzing LMN Estimates List.xlsx Export\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Read the Excel file
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');
    console.log(`📁 Reading: ${excelPath}\n`);

    if (!existsSync(excelPath)) {
      console.error(`❌ File not found: ${excelPath}`);
      process.exit(1);
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const lmnData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✅ Loaded ${lmnData.length} rows from LMN export\n`);

    // Identify column names
    const firstRow = lmnData[0];
    const columns = Object.keys(firstRow);
    console.log('📋 Columns in export:', columns.join(', '));
    console.log('');

    // Find key columns
    const estimateIdCol = columns.find(c => 
      c.toLowerCase().includes('estimate id') || 
      c.toLowerCase().includes('estimate_id') ||
      c.toLowerCase().includes('lmn estimate id')
    );
    const estimateDateCol = columns.find(c => 
      c.toLowerCase().includes('estimate date') || 
      c.toLowerCase().includes('estimate_date')
    );
    const closeDateCol = columns.find(c => 
      c.toLowerCase().includes('close date') || 
      c.toLowerCase().includes('close_date') ||
      c.toLowerCase().includes('estimate close date') ||
      c.toLowerCase().includes('estimate_close_date')
    );
    const statusCol = columns.find(c => 
      c.toLowerCase() === 'status' ||
      c.toLowerCase().includes('status')
    );
    const pipelineStatusCol = columns.find(c => 
      c.toLowerCase().includes('sales pipeline status') ||
      c.toLowerCase().includes('pipeline status') ||
      c.toLowerCase().includes('pipeline_status')
    );
    const excludeStatsCol = columns.find(c => 
      c.toLowerCase().includes('exclude stats') ||
      c.toLowerCase().includes('exclude_stats')
    );
    const archivedCol = columns.find(c => 
      c.toLowerCase() === 'archived' ||
      c.toLowerCase().includes('archived')
    );
    const totalPriceCol = columns.find(c => 
      c.toLowerCase().includes('total price') ||
      c.toLowerCase().includes('total_price')
    );
    const totalPriceWithTaxCol = columns.find(c => 
      c.toLowerCase().includes('total price with tax') ||
      c.toLowerCase().includes('total_price_with_tax')
    );

    console.log('🔍 Key columns identified:');
    console.log(`  Estimate ID: ${estimateIdCol || 'NOT FOUND'}`);
    console.log(`  Estimate Date: ${estimateDateCol || 'NOT FOUND'}`);
    console.log(`  Close Date: ${closeDateCol || 'NOT FOUND'}`);
    console.log(`  Status: ${statusCol || 'NOT FOUND'}`);
    console.log(`  Pipeline Status: ${pipelineStatusCol || 'NOT FOUND'}`);
    console.log(`  Exclude Stats: ${excludeStatsCol || 'NOT FOUND'}`);
    console.log(`  Archived: ${archivedCol || 'NOT FOUND'}`);
    console.log(`  Total Price: ${totalPriceCol || 'NOT FOUND'}`);
    console.log(`  Total Price With Tax: ${totalPriceWithTaxCol || 'NOT FOUND'}`);
    console.log('');

    // ============================================
    // FILTER FOR 2024 AND 2025
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📅 FILTERING BY YEAR (using close_date):\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Filter 2024 by close_date
    const lmn2024 = lmnData.filter(row => {
      if (!closeDateCol || !row[closeDateCol]) return false;
      const closeYear = getYearFromDate(row[closeDateCol]);
      return closeYear === 2024;
    });

    // Filter 2025 by close_date
    const lmn2025 = lmnData.filter(row => {
      if (!closeDateCol || !row[closeDateCol]) return false;
      const closeYear = getYearFromDate(row[closeDateCol]);
      return closeYear === 2025;
    });

    console.log(`LMN Export - 2024 (by close_date): ${lmn2024.length}`);
    console.log(`LMN Export - 2025 (by close_date): ${lmn2025.length}`);
    console.log(`LMN Report shows - 2024: 591, 2025: 1086\n`);

    // ============================================
    // APPLY FILTERS
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 APPLYING FILTERS:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Filter by exclude_stats
    const lmn2024Exclude = lmn2024.filter(row => {
      if (!excludeStatsCol) return true; // Include if column doesn't exist
      const exclude = row[excludeStatsCol];
      return !(exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1);
    });

    const lmn2025Exclude = lmn2025.filter(row => {
      if (!excludeStatsCol) return true;
      const exclude = row[excludeStatsCol];
      return !(exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1);
    });

    console.log(`After exclude_stats filter:`);
    console.log(`  2024: ${lmn2024Exclude.length} (removed ${lmn2024.length - lmn2024Exclude.length})`);
    console.log(`  2025: ${lmn2025Exclude.length} (removed ${lmn2025.length - lmn2025Exclude.length})\n`);

    // Filter by archived
    const lmn2024Archived = lmn2024Exclude.filter(row => {
      if (!archivedCol) return true;
      const archived = row[archivedCol];
      return !(archived === true || archived === 'True' || archived === 'true' || archived === 1);
    });

    const lmn2025Archived = lmn2025Exclude.filter(row => {
      if (!archivedCol) return true;
      const archived = row[archivedCol];
      return !(archived === true || archived === 'True' || archived === 'true' || archived === 1);
    });

    console.log(`After archived filter:`);
    console.log(`  2024: ${lmn2024Archived.length} (removed ${lmn2024Exclude.length - lmn2024Archived.length})`);
    console.log(`  2025: ${lmn2025Archived.length} (removed ${lmn2025Exclude.length - lmn2025Archived.length})\n`);

    // Filter by zero/negative prices
    const lmn2024Price = lmn2024Archived.filter(row => {
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      return price > 0;
    });

    const lmn2025Price = lmn2025Archived.filter(row => {
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      return price > 0;
    });

    console.log(`After zero/negative price filter:`);
    console.log(`  2024: ${lmn2024Price.length} (removed ${lmn2024Archived.length - lmn2024Price.length})`);
    console.log(`  2025: ${lmn2025Price.length} (removed ${lmn2025Archived.length - lmn2025Price.length})\n`);

    // Remove duplicates by Estimate ID
    const lmn2024Unique = [];
    const seen2024 = new Set();
    lmn2024Price.forEach(row => {
      const id = row[estimateIdCol];
      if (id) {
        if (!seen2024.has(id)) {
          seen2024.add(id);
          lmn2024Unique.push(row);
        }
      } else {
        lmn2024Unique.push(row);
      }
    });

    const lmn2025Unique = [];
    const seen2025 = new Set();
    lmn2025Price.forEach(row => {
      const id = row[estimateIdCol];
      if (id) {
        if (!seen2025.has(id)) {
          seen2025.add(id);
          lmn2025Unique.push(row);
        }
      } else {
        lmn2025Unique.push(row);
      }
    });

    console.log(`After duplicate removal:`);
    console.log(`  2024: ${lmn2024Unique.length} (removed ${lmn2024Price.length - lmn2024Unique.length})`);
    console.log(`  2025: ${lmn2025Unique.length} (removed ${lmn2025Price.length - lmn2025Unique.length})\n`);

    // ============================================
    // COMPARE WITH OUR DATABASE
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 COMPARING WITH OUR DATABASE:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Fetch our estimates
    let ourEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching estimates:', error);
        process.exit(1);
      }

      if (data && data.length > 0) {
        ourEstimates = ourEstimates.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Filter our estimates the same way
    const our2024 = ourEstimates.filter(e => {
      const closeYear = getYearFromDate(e.estimate_close_date);
      return closeYear === 2024 && !e.exclude_stats && !e.archived && 
             parseFloat(e.total_price_with_tax || e.total_price || 0) > 0;
    });

    const our2025 = ourEstimates.filter(e => {
      const closeYear = getYearFromDate(e.estimate_close_date);
      return closeYear === 2025 && !e.exclude_stats && !e.archived && 
             parseFloat(e.total_price_with_tax || e.total_price || 0) > 0;
    });

    // Remove duplicates
    const our2024Unique = [];
    const ourSeen2024 = new Set();
    our2024.forEach(e => {
      if (e.lmn_estimate_id) {
        if (!ourSeen2024.has(e.lmn_estimate_id)) {
          ourSeen2024.add(e.lmn_estimate_id);
          our2024Unique.push(e);
        }
      } else {
        our2024Unique.push(e);
      }
    });

    const our2025Unique = [];
    const ourSeen2025 = new Set();
    our2025.forEach(e => {
      if (e.lmn_estimate_id) {
        if (!ourSeen2025.has(e.lmn_estimate_id)) {
          ourSeen2025.add(e.lmn_estimate_id);
          our2025Unique.push(e);
        }
      } else {
        our2025Unique.push(e);
      }
    });

    console.log('Comparison:');
    console.log(`  2024:`);
    console.log(`    LMN Export (filtered): ${lmn2024Unique.length}`);
    console.log(`    LMN Report: 591`);
    console.log(`    Our Database: ${our2024Unique.length}`);
    console.log(`    Difference (export vs report): ${lmn2024Unique.length - 591}`);
    console.log(`    Difference (our vs export): ${our2024Unique.length - lmn2024Unique.length}`);
    console.log(`    Difference (our vs report): ${our2024Unique.length - 591}\n`);

    console.log(`  2025:`);
    console.log(`    LMN Export (filtered): ${lmn2025Unique.length}`);
    console.log(`    LMN Report: 1086`);
    console.log(`    Our Database: ${our2025Unique.length}`);
    console.log(`    Difference (export vs report): ${lmn2025Unique.length - 1086}`);
    console.log(`    Difference (our vs export): ${our2025Unique.length - lmn2025Unique.length}`);
    console.log(`    Difference (our vs report): ${our2025Unique.length - 1086}\n`);

    // ============================================
    // FIND ESTIMATES IN OUR DB BUT NOT IN EXPORT
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 ESTIMATES IN OUR DB BUT NOT IN LMN EXPORT:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const lmnEstimateIds = new Set();
    lmnData.forEach(row => {
      const id = row[estimateIdCol];
      if (id) lmnEstimateIds.add(String(id).trim());
    });

    const our2024NotInExport = our2024Unique.filter(e => {
      if (!e.lmn_estimate_id) return true; // Estimates without LMN ID
      return !lmnEstimateIds.has(String(e.lmn_estimate_id).trim());
    });

    const our2025NotInExport = our2025Unique.filter(e => {
      if (!e.lmn_estimate_id) return true;
      return !lmnEstimateIds.has(String(e.lmn_estimate_id).trim());
    });

    console.log(`2024: ${our2024NotInExport.length} estimates in our DB but not in export`);
    if (our2024NotInExport.length > 0 && our2024NotInExport.length <= 10) {
      our2024NotInExport.forEach(e => {
        console.log(`  - ${e.lmn_estimate_id || e.id}: ${e.project_name || 'No name'}, status=${e.status}, close_date=${e.estimate_close_date}`);
      });
    }
    console.log('');

    console.log(`2025: ${our2025NotInExport.length} estimates in our DB but not in export`);
    if (our2025NotInExport.length > 0 && our2025NotInExport.length <= 10) {
      our2025NotInExport.slice(0, 10).forEach(e => {
        console.log(`  - ${e.lmn_estimate_id || e.id}: ${e.project_name || 'No name'}, status=${e.status}, close_date=${e.estimate_close_date}`);
      });
    }
    console.log('');

    // ============================================
    // FIND ESTIMATES IN EXPORT BUT NOT IN OUR DB
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 ESTIMATES IN LMN EXPORT BUT NOT IN OUR DB:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const ourEstimateIds = new Set();
    ourEstimates.forEach(e => {
      if (e.lmn_estimate_id) ourEstimateIds.add(String(e.lmn_estimate_id).trim());
    });

    const lmn2024NotInOur = lmn2024Unique.filter(row => {
      const id = row[estimateIdCol];
      if (!id) return false;
      return !ourEstimateIds.has(String(id).trim());
    });

    const lmn2025NotInOur = lmn2025Unique.filter(row => {
      const id = row[estimateIdCol];
      if (!id) return false;
      return !ourEstimateIds.has(String(id).trim());
    });

    console.log(`2024: ${lmn2024NotInOur.length} estimates in export but not in our DB`);
    console.log(`2025: ${lmn2025NotInOur.length} estimates in export but not in our DB\n`);

    // ============================================
    // STATUS BREAKDOWN
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 STATUS BREAKDOWN:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const lmn2024Status = {};
    lmn2024Unique.forEach(row => {
      const status = (row[statusCol] || 'unknown').toString().toLowerCase();
      lmn2024Status[status] = (lmn2024Status[status] || 0) + 1;
    });

    const our2024Status = {};
    our2024Unique.forEach(e => {
      const status = (e.status || 'unknown').toLowerCase();
      our2024Status[status] = (our2024Status[status] || 0) + 1;
    });

    console.log('2024 Status Comparison:');
    console.log('  LMN Export:');
    Object.entries(lmn2024Status).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`    ${status}: ${count}`);
    });
    console.log('  Our DB:');
    Object.entries(our2024Status).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`    ${status}: ${count}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

analyzeLMNExport();


