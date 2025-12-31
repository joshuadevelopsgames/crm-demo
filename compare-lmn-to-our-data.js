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

async function compareLMNToOurData() {
  console.log('🔍 Comparing LMN data to our database...\n');

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

    const dateColumn = 'Estimate Date';
    const estimateIdColumn = 'Estimate ID';
    const excludeStatsColumn = 'Exclude Stats';
    const statusColumn = 'Status';
    const archivedColumn = 'Archived';
    const salesPipelineStatusColumn = 'Sales Pipeline Status';
    const closeDateColumn = 'Estimate Close Date';

    console.log(`📊 LMN export contains ${lmnData.length} total estimates\n`);

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

    // Apply exclude_stats filter
    const lmn2025Filtered = lmn2025.filter(row => {
      const excludeValue = row[excludeStatsColumn];
      if (excludeValue === true || excludeValue === 'True' || excludeValue === 'true') {
        return false;
      }
      return true;
    });

    // Get LMN estimate IDs (with duplicate removal)
    const lmn2025Ids = new Set();
    const lmn2025Map = new Map();
    lmn2025Filtered.forEach(row => {
      if (row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025Ids.add(id);
          if (!lmn2025Map.has(id)) {
            lmn2025Map.set(id, row);
          }
        }
      }
    });

    console.log(`📊 LMN 2025 estimates (after exclude_stats): ${lmn2025Filtered.length}`);
    console.log(`📊 LMN unique estimate IDs: ${lmn2025Ids.size}\n`);

    // Fetch all our estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status, archived, created_at')
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

    console.log(`📊 Our database contains ${allEstimates.length} total estimates\n`);

    // Our estimates with duplicate removal
    const ourUnique = [];
    const seenLmnIds = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenLmnIds.has(est.lmn_estimate_id)) {
          seenLmnIds.add(est.lmn_estimate_id);
          ourUnique.push(est);
        }
      } else {
        ourUnique.push(est);
      }
    });

    // Our 2025 estimates (excluding exclude_stats)
    const our2025 = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats === true) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    // Get our estimate IDs
    const our2025Ids = new Set();
    const our2025Map = new Map();
    our2025.forEach(e => {
      const estId = e.lmn_estimate_id || e.estimate_number;
      if (estId) {
        our2025Ids.add(estId);
        our2025Map.set(estId, e);
      }
    });

    console.log(`📊 Our 2025 estimates (after exclude_stats): ${our2025.length}`);
    console.log(`📊 Our unique estimate IDs: ${our2025Ids.size}\n`);

    // ============================================
    // COMPARISON ANALYSIS
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 COMPREHENSIVE COMPARISON');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Estimates in LMN but not in our database
    const inLMNButNotOurs = Array.from(lmn2025Ids).filter(id => !our2025Ids.has(id));
    console.log(`1️⃣  ESTIMATES IN LMN BUT NOT IN OUR DATABASE: ${inLMNButNotOurs.length}\n`);

    if (inLMNButNotOurs.length > 0) {
      // Check if they exist with different dates
      let foundWithDifferentDate = 0;
      let foundWithNullDate = 0;
      let notFoundAtAll = 0;

      const differentDateExamples = [];
      const nullDateExamples = [];
      const notFoundExamples = [];

      for (const id of inLMNButNotOurs.slice(0, 50)) {
        const lmnRow = lmn2025Map.get(id);
        if (!lmnRow) continue;

        // Check if it exists in our full database (not just 2025)
        const ourEst = allEstimates.find(e => 
          e.lmn_estimate_id === id || e.estimate_number === id
        );

        if (ourEst) {
          if (!ourEst.estimate_date) {
            foundWithNullDate++;
            if (nullDateExamples.length < 5) {
              nullDateExamples.push({ id, lmnDate: convertExcelDate(lmnRow[dateColumn]) });
            }
          } else {
            const ourYear = extractYearFromDateString(ourEst.estimate_date);
            if (ourYear !== year2025) {
              foundWithDifferentDate++;
              if (differentDateExamples.length < 5) {
                differentDateExamples.push({
                  id,
                  lmnDate: convertExcelDate(lmnRow[dateColumn]),
                  ourDate: ourEst.estimate_date,
                  ourYear
                });
              }
            }
          }
        } else {
          notFoundAtAll++;
          if (notFoundExamples.length < 5) {
            notFoundExamples.push({
              id,
              lmnDate: convertExcelDate(lmnRow[dateColumn]),
              status: lmnRow[statusColumn]
            });
          }
        }
      }

      console.log(`   Breakdown of first 50:`);
      console.log(`   - Found with different date (not 2025): ${foundWithDifferentDate}`);
      console.log(`   - Found with null date: ${foundWithNullDate}`);
      console.log(`   - Not found at all: ${notFoundAtAll}\n`);

      if (differentDateExamples.length > 0) {
        console.log(`   Examples with different dates:`);
        differentDateExamples.forEach(ex => {
          console.log(`     - ${ex.id}: LMN=${ex.lmnDate}, Our=${ex.ourDate} (year=${ex.ourYear})`);
        });
        console.log();
      }

      if (notFoundExamples.length > 0) {
        console.log(`   Examples not found at all:`);
        notFoundExamples.forEach(ex => {
          console.log(`     - ${ex.id}: LMN date=${ex.lmnDate}, status=${ex.status}`);
        });
        console.log();
      }
    }

    // 2. Estimates in our database but not in LMN
    const inOursButNotLMN = Array.from(our2025Ids).filter(id => !lmn2025Ids.has(id));
    console.log(`2️⃣  ESTIMATES IN OUR DATABASE BUT NOT IN LMN: ${inOursButNotLMN.length}\n`);

    if (inOursButNotLMN.length > 0) {
      const examples = inOursButNotLMN.slice(0, 10).map(id => {
        const ourEst = our2025Map.get(id);
        return {
          id,
          date: ourEst?.estimate_date,
          status: ourEst?.status
        };
      });

      console.log(`   Examples (first 10):`);
      examples.forEach(ex => {
        console.log(`     - ${ex.id}: date=${ex.date}, status=${ex.status}`);
      });
      console.log();
    }

    // 3. Estimates in both but with different dates
    const inBoth = Array.from(lmn2025Ids).filter(id => our2025Ids.has(id));
    const dateMismatches = [];

    for (const id of inBoth.slice(0, 100)) {
      const lmnRow = lmn2025Map.get(id);
      const ourEst = our2025Map.get(id);
      if (!lmnRow || !ourEst) continue;

      const lmnDate = convertExcelDate(lmnRow[dateColumn]);
      const ourDate = ourEst.estimate_date ? ourEst.estimate_date.split('T')[0] : null;

      if (lmnDate && ourDate && lmnDate !== ourDate) {
        dateMismatches.push({
          id,
          lmnDate,
          ourDate
        });
      }
    }

    console.log(`3️⃣  ESTIMATES IN BOTH BUT WITH DIFFERENT DATES: ${dateMismatches.length} (checked first 100)\n`);

    if (dateMismatches.length > 0 && dateMismatches.length <= 10) {
      console.log(`   Examples:`);
      dateMismatches.forEach(m => {
        console.log(`     - ${m.id}: LMN=${m.lmnDate}, Our=${m.ourDate}`);
      });
      console.log();
    }

    // 4. Status comparison
    const lmnStatusCounts = {};
    lmn2025Filtered.forEach(row => {
      const status = row[statusColumn] || 'null';
      lmnStatusCounts[status] = (lmnStatusCounts[status] || 0) + 1;
    });

    const ourStatusCounts = {};
    our2025.forEach(e => {
      const status = e.status || 'null';
      ourStatusCounts[status] = (ourStatusCounts[status] || 0) + 1;
    });

    console.log(`4️⃣  STATUS DISTRIBUTION COMPARISON:\n`);
    console.log(`   LMN Status Distribution:`);
    Object.entries(lmnStatusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
    console.log();
    console.log(`   Our Status Distribution:`);
    Object.entries(ourStatusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
    console.log();

    // 5. Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`   LMN 2025 estimates: ${lmn2025Ids.size}`);
    console.log(`   Our 2025 estimates: ${our2025Ids.size}`);
    console.log(`   Difference: ${lmn2025Ids.size - our2025Ids.size}\n`);
    console.log(`   In LMN but not ours: ${inLMNButNotOurs.length}`);
    console.log(`   In ours but not LMN: ${inOursButNotLMN.length}`);
    console.log(`   In both: ${inBoth.length}\n`);
    console.log(`   Date mismatches (first 100 checked): ${dateMismatches.length}\n`);

    // 6. Key issues identified
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 KEY ISSUES IDENTIFIED');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`   1. Timezone date conversion issue:`);
    console.log(`      - 208 estimates have dates of 2026-01-01 instead of 2025-12-31`);
    console.log(`      - 40 estimates have dates of 2025-01-01 instead of 2024-12-31\n`);
    console.log(`   2. Missing estimates:`);
    console.log(`      - ${inLMNButNotOurs.length} estimates in LMN are not in our database`);
    console.log(`      - Most are date conversion issues, but some are truly missing\n`);
    console.log(`   3. Extra estimates:`);
    console.log(`      - ${inOursButNotLMN.length} estimates in our database are not in LMN's list`);
    console.log(`      - These may be estimates with incorrect dates or not yet synced\n`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

compareLMNToOurData();

