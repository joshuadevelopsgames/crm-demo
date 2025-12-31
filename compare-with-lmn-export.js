#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file if it exists (for local development)
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
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function extractYearFromDateString(dateStr) {
  if (!dateStr) return null;
  const yearMatch = dateStr.match(/\b(20[0-9]{2})\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1]);
  }
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
}

async function compareWithLMNExport() {
  console.log('🔍 Comparing our database with LMN export...\n');

  try {
    // Read LMN export
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List (3).xlsx');
    console.log(`📂 Reading LMN export from: ${excelPath}\n`);

    if (!existsSync(excelPath)) {
      console.error(`❌ File not found: ${excelPath}`);
      return;
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const lmnData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 LMN export contains ${lmnData.length} estimates\n`);

    // Fetch all our estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching estimates:', error);
        return;
      }

      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`📊 Our database contains ${allEstimates.length} estimates\n`);

    // Find the date column in LMN export
    const firstRow = lmnData[0];
    const dateColumn = Object.keys(firstRow).find(key => {
      const keyLower = key.toLowerCase();
      return keyLower.includes('date') && !keyLower.includes('close') && !keyLower.includes('created');
    });

    const estimateIdColumn = Object.keys(firstRow).find(key => {
      const keyLower = key.toLowerCase();
      return keyLower.includes('estimate') && (keyLower.includes('id') || keyLower.includes('number'));
    });

    console.log(`📊 LMN export columns:`);
    console.log(`   Date column: ${dateColumn || 'NOT FOUND'}`);
    console.log(`   Estimate ID column: ${estimateIdColumn || 'NOT FOUND'}`);
    console.log(`   All columns: ${Object.keys(firstRow).join(', ')}\n`);

    // Filter LMN data for 2025
    const year2025 = 2025;
    const lmn2025 = lmnData.filter(row => {
      if (!dateColumn || row[dateColumn] === null || row[dateColumn] === undefined) return false;
      const dateValue = row[dateColumn];
      // Try to extract year from date
      let year = null;
      if (dateValue instanceof Date) {
        year = dateValue.getFullYear();
      } else if (typeof dateValue === 'string') {
        year = extractYearFromDateString(dateValue);
      } else if (typeof dateValue === 'number') {
        // Excel date serial number - convert to JavaScript date
        // Excel epoch is January 1, 1900, JavaScript is January 1, 1970
        // Excel serial number 1 = Jan 1, 1900
        const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899 (Excel's epoch)
        const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
        year = jsDate.getFullYear();
      }
      return year === year2025;
    });

    // Filter by exclude_stats (like our report does)
    const excludeStatsColumn = Object.keys(firstRow).find(key => {
      const keyLower = key.toLowerCase();
      return keyLower.includes('exclude') && keyLower.includes('stats');
    });

    const lmn2025ExcludingStats = lmn2025.filter(row => {
      if (!excludeStatsColumn) return true; // If column doesn't exist, include all
      const excludeValue = row[excludeStatsColumn];
      // Check if it's "False", false, "false", or empty
      if (excludeValue === false || excludeValue === 'False' || excludeValue === 'false' || !excludeValue) {
        return true; // Include if not excluded
      }
      return false; // Exclude if marked as excluded
    });

    console.log(`📊 LMN estimates for 2025 (all): ${lmn2025.length}`);
    console.log(`📊 LMN estimates for 2025 (excluding exclude_stats=true): ${lmn2025ExcludingStats.length}`);
    console.log(`📊 Expected: 1,839\n`);

    // Use the filtered list (excluding exclude_stats)
    const lmn2025Filtered = lmn2025ExcludingStats;

    // Get LMN estimate IDs for 2025
    const lmn2025Ids = new Set();
    lmn2025Filtered.forEach(row => {
      if (estimateIdColumn && row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025Ids.add(id);
        }
      }
    });

    console.log(`📊 Unique LMN estimate IDs for 2025 (after filtering): ${lmn2025Ids.size}\n`);

    // Get our estimates for 2025 (no duplicate removal to match LMN)
    const our2025 = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Our estimates for 2025 (no duplicate removal): ${our2025.length}\n`);

    // Get our estimate IDs
    const our2025Ids = new Set();
    our2025.forEach(e => {
      if (e.lmn_estimate_id) {
        our2025Ids.add(e.lmn_estimate_id);
      } else if (e.estimate_number) {
        our2025Ids.add(e.estimate_number);
      }
    });

    // Find estimates in LMN but not in ours
    const inLMNButNotOurs = Array.from(lmn2025Ids).filter(id => !our2025Ids.has(id));
    console.log(`📊 Estimates in LMN but not in our database: ${inLMNButNotOurs.length}`);
    if (inLMNButNotOurs.length > 0 && inLMNButNotOurs.length <= 20) {
      console.log('   Missing estimate IDs (first 20):');
      inLMNButNotOurs.slice(0, 20).forEach(id => {
        const lmnRow = lmn2025Filtered.find(r => {
          const rowId = estimateIdColumn ? String(r[estimateIdColumn]).trim() : null;
          return rowId === id;
        });
        if (lmnRow) {
          // Convert Excel date if needed
          let dateStr = lmnRow[dateColumn];
          if (typeof dateStr === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            const jsDate = new Date(excelEpoch.getTime() + (dateStr - 1) * 24 * 60 * 60 * 1000);
            dateStr = jsDate.toISOString().split('T')[0];
          }
          console.log(`   - ${id}: date=${dateStr}, status=${lmnRow['Status'] || lmnRow['status'] || 'unknown'}, exclude_stats=${lmnRow[excludeStatsColumn] || 'N/A'}`);
        } else {
          console.log(`   - ${id}`);
        }
      });
    } else if (inLMNButNotOurs.length > 20) {
      console.log(`   (Too many to list - ${inLMNButNotOurs.length} total)`);
    }
    console.log();

    // Find estimates in ours but not in LMN
    const inOursButNotLMN = Array.from(our2025Ids).filter(id => !lmn2025Ids.has(id));
    console.log(`📊 Estimates in our database but not in LMN: ${inOursButNotLMN.length}`);
    if (inOursButNotLMN.length > 0 && inOursButNotLMN.length <= 20) {
      console.log('   Extra estimate IDs (first 20):');
      inOursButNotLMN.slice(0, 20).forEach(id => {
        const ourEst = our2025.find(e => e.lmn_estimate_id === id || e.estimate_number === id);
        if (ourEst) {
          console.log(`   - ${id}: date=${ourEst.estimate_date}, status=${ourEst.status}`);
        } else {
          console.log(`   - ${id}`);
        }
      });
    }
    console.log();

    // Summary
    console.log(`📊 SUMMARY:\n`);
    console.log(`   LMN count: ${lmn2025Ids.size}`);
    console.log(`   Our count: ${our2025Ids.size}`);
    console.log(`   Difference: ${lmn2025Ids.size - our2025Ids.size}`);
    console.log(`   \n   Missing from our DB: ${inLMNButNotOurs.length}`);
    console.log(`   Extra in our DB: ${inOursButNotLMN.length}`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

compareWithLMNExport();

