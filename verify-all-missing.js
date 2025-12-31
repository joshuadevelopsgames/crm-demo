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

async function verifyAllMissing() {
  console.log('🔍 Verifying all 210 missing estimates...\n');

  try {
    // Read LMN export
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List (3).xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const lmnData = XLSX.utils.sheet_to_json(worksheet);

    const dateColumn = 'Estimate Date';
    const estimateIdColumn = 'Estimate ID';
    const excludeStatsColumn = 'Exclude Stats';

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
        .select('id, lmn_estimate_id, estimate_number, estimate_date')
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
    console.log(`📊 Total missing estimates: ${missingIds.length}\n`);

    // Check all missing estimates
    let foundWith2026Date = 0;
    let foundWithOtherDate = 0;
    let notFound = 0;

    for (const missingId of missingIds) {
      const lmnRow = lmn2025Filtered.find(r => String(r[estimateIdColumn]).trim() === missingId);
      if (!lmnRow) {
        notFound++;
        continue;
      }

      // Check if it exists in our database
      const ourEstimate = allEstimates.find(e => 
        e.lmn_estimate_id === missingId || e.estimate_number === missingId
      );

      if (ourEstimate) {
        if (ourEstimate.estimate_date) {
          const ourYear = extractYearFromDateString(ourEstimate.estimate_date);
          if (ourYear === 2026) {
            foundWith2026Date++;
          } else {
            foundWithOtherDate++;
            console.log(`   ⚠️  ${missingId}: LMN=2025, Our=${ourEstimate.estimate_date} (year=${ourYear})`);
          }
        } else {
          foundWithOtherDate++;
        }
      } else {
        notFound++;
        const lmnDate = convertExcelDate(lmnRow[dateColumn]);
        console.log(`   ❌ ${missingId}: Not found in database (LMN date: ${lmnDate})`);
      }
    }

    console.log(`\n📊 VERIFICATION RESULTS:\n`);
    console.log(`   Total missing: ${missingIds.length}`);
    console.log(`   Found with 2026 date: ${foundWith2026Date} (${(foundWith2026Date/missingIds.length*100).toFixed(1)}%)`);
    console.log(`   Found with other date: ${foundWithOtherDate}`);
    console.log(`   Not found at all: ${notFound}\n`);

    if (foundWith2026Date === missingIds.length) {
      console.log(`✅ CONFIRMED: All ${missingIds.length} "missing" estimates exist in our database!`);
      console.log(`   They all have dates of 2026-01-01 instead of 2025-12-31 due to timezone conversion.\n`);
      console.log(`📋 ROOT CAUSE:`);
      console.log(`   During import, dates like "2025-12-31" are being converted to UTC,`);
      console.log(`   which results in "2026-01-01T00:00:00+00:00" for dates near year boundaries.`);
      console.log(`   \n   This is the same issue as the 40 "2025-01-01" dates that were parsed as 2024.`);
      console.log(`   \n   Solution: Use date string extraction (YYYY-MM-DD) instead of Date parsing`);
      console.log(`   to avoid timezone issues during import.`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

verifyAllMissing();

