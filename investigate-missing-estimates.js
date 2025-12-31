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

function convertExcelDate(excelSerial) {
  if (typeof excelSerial !== 'number') return null;
  const excelEpoch = new Date(1899, 11, 30);
  const jsDate = new Date(excelEpoch.getTime() + (excelSerial - 1) * 24 * 60 * 60 * 1000);
  return jsDate.toISOString().split('T')[0];
}

async function investigateMissingEstimates() {
  console.log('🔍 Investigating why 210 estimates are missing from our database...\n');

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

    // Find columns
    const firstRow = lmnData[0];
    const dateColumn = 'Estimate Date';
    const estimateIdColumn = 'Estimate ID';
    const excludeStatsColumn = 'Exclude Stats';
    const statusColumn = 'Status';

    // Filter LMN data for 2025
    const year2025 = 2025;
    const lmn2025 = lmnData.filter(row => {
      if (!row[dateColumn] || row[dateColumn] === null || row[dateColumn] === undefined) return false;
      const dateValue = row[dateColumn];
      let year = null;
      if (dateValue instanceof Date) {
        year = dateValue.getFullYear();
      } else if (typeof dateValue === 'string') {
        year = extractYearFromDateString(dateValue);
      } else if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
        year = jsDate.getFullYear();
      }
      return year === year2025;
    });

    // Filter by exclude_stats
    const lmn2025Filtered = lmn2025.filter(row => {
      const excludeValue = row[excludeStatsColumn];
      if (excludeValue === false || excludeValue === 'False' || excludeValue === 'false' || !excludeValue) {
        return true;
      }
      return false;
    });

    // Fetch all our estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status, created_at')
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

    // Get LMN estimate IDs
    const lmn2025Ids = new Set();
    lmn2025Filtered.forEach(row => {
      if (row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025Ids.add(id);
        }
      }
    });

    // Get our estimate IDs (for 2025)
    const our2025 = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    const our2025Ids = new Set();
    our2025.forEach(e => {
      if (e.lmn_estimate_id) {
        our2025Ids.add(e.lmn_estimate_id);
      } else if (e.estimate_number) {
        our2025Ids.add(e.estimate_number);
      }
    });

    // Find missing estimates
    const missingIds = Array.from(lmn2025Ids).filter(id => !our2025Ids.has(id));
    console.log(`📊 Missing estimates: ${missingIds.length}\n`);

    // Check if they exist in our database with different dates
    console.log('🔍 Checking if missing estimates exist in our database with different dates...\n');
    
    let foundWithDifferentDate = 0;
    let foundWithNullDate = 0;
    let notFoundAtAll = 0;
    const analysis = {
      differentDate: [],
      nullDate: [],
      notFound: []
    };

    for (const missingId of missingIds.slice(0, 50)) { // Check first 50
      const lmnRow = lmn2025Filtered.find(r => String(r[estimateIdColumn]).trim() === missingId);
      if (!lmnRow) continue;

      // Check if it exists in our database
      const ourEstimate = allEstimates.find(e => 
        e.lmn_estimate_id === missingId || e.estimate_number === missingId
      );

      if (ourEstimate) {
        // It exists! Check the date
        if (!ourEstimate.estimate_date) {
          foundWithNullDate++;
          analysis.nullDate.push({
            id: missingId,
            lmnDate: convertExcelDate(lmnRow[dateColumn]),
            ourDate: null,
            status: ourEstimate.status
          });
        } else {
          const lmnDate = convertExcelDate(lmnRow[dateColumn]);
          const ourDateYear = extractYearFromDateString(ourEstimate.estimate_date);
          if (ourDateYear !== year2025) {
            foundWithDifferentDate++;
            analysis.differentDate.push({
              id: missingId,
              lmnDate: lmnDate,
              ourDate: ourEstimate.estimate_date,
              ourYear: ourDateYear,
              status: ourEstimate.status
            });
          }
        }
      } else {
        notFoundAtAll++;
        analysis.notFound.push({
          id: missingId,
          lmnDate: convertExcelDate(lmnRow[dateColumn]),
          status: lmnRow[statusColumn]
        });
      }
    }

    console.log(`📊 Analysis of first 50 missing estimates:\n`);
    console.log(`   Found with different date (not 2025): ${foundWithDifferentDate}`);
    console.log(`   Found with null date: ${foundWithNullDate}`);
    console.log(`   Not found at all: ${notFoundAtAll}\n`);

    if (analysis.differentDate.length > 0) {
      console.log(`📋 Examples of estimates with different dates (first 10):`);
      analysis.differentDate.slice(0, 10).forEach(item => {
        console.log(`   - ${item.id}: LMN=${item.lmnDate}, Our=${item.ourDate} (year=${item.ourYear})`);
      });
      console.log();
    }

    if (analysis.nullDate.length > 0) {
      console.log(`📋 Examples of estimates with null dates (first 10):`);
      analysis.nullDate.slice(0, 10).forEach(item => {
        console.log(`   - ${item.id}: LMN=${item.lmnDate}, Our=null`);
      });
      console.log();
    }

    if (analysis.notFound.length > 0) {
      console.log(`📋 Examples of estimates not found at all (first 10):`);
      analysis.notFound.slice(0, 10).forEach(item => {
        console.log(`   - ${item.id}: LMN date=${item.lmnDate}, status=${item.status}`);
      });
      console.log();
    }

    // Check patterns in missing estimates
    console.log('🔍 Analyzing patterns in missing estimates...\n');

    const missingRows = missingIds.slice(0, 100).map(id => 
      lmn2025Filtered.find(r => String(r[estimateIdColumn]).trim() === id)
    ).filter(Boolean);

    // Check status distribution
    const statusCounts = {};
    missingRows.forEach(row => {
      const status = row[statusColumn] || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log(`📊 Status distribution of missing estimates (first 100):`);
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();

    // Check date distribution
    const dateCounts = {};
    missingRows.forEach(row => {
      const date = convertExcelDate(row[dateColumn]);
      if (date) {
        const month = date.substring(0, 7); // YYYY-MM
        dateCounts[month] = (dateCounts[month] || 0) + 1;
      }
    });

    console.log(`📊 Date distribution of missing estimates (first 100):`);
    Object.entries(dateCounts).sort().forEach(([month, count]) => {
      console.log(`   ${month}: ${count}`);
    });
    console.log();

    // Check if they might be archived
    const archivedColumn = 'Archived';
    const archivedCount = missingRows.filter(r => 
      r[archivedColumn] === true || r[archivedColumn] === 'True' || r[archivedColumn] === 'true'
    ).length;
    console.log(`📊 Archived estimates in missing list: ${archivedCount} out of ${missingRows.length}\n`);

    // Summary
    console.log(`📊 SUMMARY:\n`);
    console.log(`   Total missing: ${missingIds.length}`);
    console.log(`   \n   Of first 50 checked:`);
    console.log(`   - Found with different date: ${foundWithDifferentDate} (${(foundWithDifferentDate/50*100).toFixed(1)}%)`);
    console.log(`   - Found with null date: ${foundWithNullDate} (${(foundWithNullDate/50*100).toFixed(1)}%)`);
    console.log(`   - Not found at all: ${notFoundAtAll} (${(notFoundAtAll/50*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

investigateMissingEstimates();

