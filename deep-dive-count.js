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

async function deepDiveCount() {
  console.log('🔍 Deep dive into the count discrepancy...\n');

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

    // Get LMN estimate IDs (with duplicate removal)
    const lmn2025Ids = new Set();
    lmn2025Filtered.forEach(row => {
      if (row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025Ids.add(id);
        }
      }
    });

    console.log(`📊 LMN unique estimate IDs for 2025 (after exclude_stats filter): ${lmn2025Ids.size}`);
    console.log(`📊 LMN report shows: 1,839\n`);

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

    // Our current count (with duplicate removal, excluding exclude_stats)
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

    console.log(`📊 Our current count (with duplicate removal, excluding exclude_stats): ${ourCurrent2025.length}\n`);

    // Find estimates in our DB that are in LMN's 2025 list
    const ourInLMN2025 = ourUnique.filter(e => {
      const estId = e.lmn_estimate_id || e.estimate_number;
      if (!estId) return false;
      return lmn2025Ids.has(estId);
    });

    console.log(`📊 Estimates in our DB that are in LMN's 2025 list: ${ourInLMN2025.length}`);

    // Check how many of these have 2025 dates vs other dates
    const ourInLMN2025With2025Date = ourInLMN2025.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    const ourInLMN2025WithOtherDate = ourInLMN2025.filter(e => {
      if (!e.estimate_date) return true;
      const year = extractYearFromDateString(e.estimate_date);
      return year !== year2025;
    });

    console.log(`   - With 2025 date: ${ourInLMN2025With2025Date.length}`);
    console.log(`   - With other date (need fixing): ${ourInLMN2025WithOtherDate.length}\n`);

    // Find estimates in our DB that are NOT in LMN's 2025 list
    const ourNotInLMN2025 = ourCurrent2025.filter(e => {
      const estId = e.lmn_estimate_id || e.estimate_number;
      if (!estId) return true; // If no ID, assume not in LMN
      return !lmn2025Ids.has(estId);
    });

    console.log(`📊 Estimates in our DB with 2025 date that are NOT in LMN's 2025 list: ${ourNotInLMN2025.length}`);
    console.log(`   (These might be why our count is higher after fixing)\n`);

    // After fixing: count would be estimates in LMN's list (regardless of our date) + estimates not in LMN's list with 2025 date
    const afterFixing = ourInLMN2025.length + ourNotInLMN2025.length;
    console.log(`📊 Count after fixing dates:`);
    console.log(`   Estimates in LMN's 2025 list: ${ourInLMN2025.length}`);
    console.log(`   + Estimates not in LMN's list but with 2025 date: ${ourNotInLMN2025.length}`);
    console.log(`   = Total: ${afterFixing}`);
    console.log(`   \n   LMN report count: 1,839`);
    console.log(`   Difference: ${afterFixing - 1839}\n`);

    // Check if LMN might be excluding some of our estimates
    if (ourNotInLMN2025.length > 0) {
      console.log(`📋 Sample of estimates we have that LMN doesn't include (first 10):`);
      ourNotInLMN2025.slice(0, 10).forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}, exclude_stats=${e.exclude_stats}`);
      });
      console.log();
    }

    // Final answer
    console.log(`📊 ANSWER:\n`);
    console.log(`   After fixing the 208 dates, we'd have ${afterFixing} estimates.`);
    console.log(`   LMN shows 1,839, so we'd have ${afterFixing - 1839} more.\n`);
    
    if (afterFixing === 1839) {
      console.log(`✅ YES! After fixing, our count would match LMN's 1,839!`);
    } else if (Math.abs(afterFixing - 1839) <= 10) {
      console.log(`⚠️  Very close! The difference of ${afterFixing - 1839} might be due to:`);
      console.log(`   - Additional filters LMN applies (status, archived, etc.)`);
      console.log(`   - Different duplicate removal strategy`);
      console.log(`   - Estimates that exist in our DB but not in LMN's export`);
    } else {
      console.log(`❌ No, we'd still have ${afterFixing - 1839} more estimates.`);
      console.log(`   This suggests LMN applies additional filters we're not aware of.`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

deepDiveCount();

