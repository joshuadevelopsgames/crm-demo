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

async function calculateFixedCount() {
  console.log('🔍 Calculating what our count would be after fixing dates...\n');

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
        .select('id, lmn_estimate_id, estimate_number, estimate_date, exclude_stats')
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

    // Current count (with duplicate removal)
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

    const ourCurrent2025 = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats === true) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Current count (with duplicate removal, excluding exclude_stats): ${ourCurrent2025.length}`);
    console.log(`📊 LMN count: 1,839\n`);

    // Find estimates that should be 2025 but are stored as 2026
    const estimatesToFix = [];
    const lmn2025Ids = new Set();
    lmn2025Filtered.forEach(row => {
      if (row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025Ids.add(id);
        }
      }
    });

    for (const est of ourUnique) {
      const estId = est.lmn_estimate_id || est.estimate_number;
      if (estId && lmn2025Ids.has(estId)) {
        // This estimate is in LMN's 2025 list
        if (est.estimate_date) {
          const ourYear = extractYearFromDateString(est.estimate_date);
          if (ourYear !== year2025) {
            // It's in LMN's 2025 list but our date is not 2025
            estimatesToFix.push({
              id: est.id,
              lmn_estimate_id: estId,
              currentDate: est.estimate_date,
              currentYear: ourYear
            });
          }
        }
      }
    }

    console.log(`📊 Estimates that need date fixes: ${estimatesToFix.length}`);
    console.log(`   (These are in LMN's 2025 list but have wrong dates in our DB)\n`);

    // Calculate what our count would be after fixing
    // Simulate: if we change those dates to 2025-12-31, they'd be counted as 2025
    const wouldBe2025 = new Set();
    
    // Add current 2025 estimates
    ourCurrent2025.forEach(e => {
      const estId = e.lmn_estimate_id || e.estimate_number;
      if (estId) {
        wouldBe2025.add(estId);
      } else {
        wouldBe2025.add(e.id); // Use DB id if no lmn_estimate_id
      }
    });

    // Add the ones we'd fix
    estimatesToFix.forEach(e => {
      wouldBe2025.add(e.lmn_estimate_id);
    });

    console.log(`📊 Count after fixing dates: ${wouldBe2025.size}`);
    console.log(`📊 LMN count: 1,839`);
    console.log(`📊 Difference: ${wouldBe2025.size - 1839}\n`);

    // Also check: what if we don't remove duplicates (like LMN might not)?
    const noDedup2025 = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats === true) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    // Add the ones we'd fix (without dedup)
    const noDedupWouldBe2025 = noDedup2025.length + estimatesToFix.length;

    console.log(`📊 Count without duplicate removal (after fixing): ${noDedupWouldBe2025}`);
    console.log(`📊 LMN count: 1,839`);
    console.log(`📊 Difference: ${noDedupWouldBe2025 - 1839}\n`);

    // Check for the 2 actually missing estimates
    const ourAllIds = new Set();
    allEstimates.forEach(e => {
      if (e.lmn_estimate_id) {
        ourAllIds.add(e.lmn_estimate_id);
      } else if (e.estimate_number) {
        ourAllIds.add(e.estimate_number);
      }
    });

    const actuallyMissing = Array.from(lmn2025Ids).filter(id => !ourAllIds.has(id));
    console.log(`📊 Actually missing estimates (not in DB at all): ${actuallyMissing.length}`);
    if (actuallyMissing.length > 0) {
      console.log(`   Missing IDs: ${actuallyMissing.join(', ')}\n`);
    }

    // Final calculation
    console.log(`📊 FINAL CALCULATION:\n`);
    console.log(`   Current count: ${ourCurrent2025.length}`);
    console.log(`   + Estimates to fix (208): ${estimatesToFix.length}`);
    console.log(`   - Actually missing (2): ${actuallyMissing.length}`);
    console.log(`   = Expected count: ${ourCurrent2025.length + estimatesToFix.length - actuallyMissing.length}`);
    console.log(`   \n   LMN count: 1,839`);
    console.log(`   Difference: ${(ourCurrent2025.length + estimatesToFix.length - actuallyMissing.length) - 1839}\n`);

    if ((ourCurrent2025.length + estimatesToFix.length - actuallyMissing.length) === 1839) {
      console.log(`✅ YES! After fixing the dates, our count would match LMN's 1,839!`);
    } else {
      console.log(`⚠️  Close but not exact. There may be other factors (duplicate removal, etc.)`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

calculateFixedCount();

