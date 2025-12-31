#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
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

async function investigateRemaining9() {
  console.log('🔍 Investigating the remaining 9 estimate difference...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status, created_date, created_at')
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

    // Remove duplicates
    const uniqueEstimates = [];
    const seenLmnIds = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenLmnIds.has(est.lmn_estimate_id)) {
          seenLmnIds.add(est.lmn_estimate_id);
          uniqueEstimates.push(est);
        }
      } else {
        uniqueEstimates.push(est);
      }
    });

    const year2025 = 2025;

    // Our current best filter: estimate_date only (string), include exclude_stats
    const ourFiltered = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Our filtered count: ${ourFiltered.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Missing: ${1839 - ourFiltered.length} estimates\n`);

    // Find estimates that might be counted by LMN but not by us
    console.log('🔍 Checking potential edge cases...\n');

    // 1. Estimates with estimate_date that has unusual format
    const unusualFormats = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      // Check if date string doesn't match standard ISO format
      const isISO = /^\d{4}-\d{2}-\d{2}/.test(e.estimate_date);
      if (isISO) return false;
      // Check if it might still be 2025
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    console.log(`1. Estimates with non-standard date format: ${unusualFormats.length}`);
    if (unusualFormats.length > 0) {
      console.log('   Sample (first 10):');
      unusualFormats.slice(0, 10).forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
      });
    }
    console.log();

    // 2. Estimates where estimate_date is null but estimate_close_date is 2025
    // (LMN might use close_date as fallback)
    const noEstDateButCloseDate2025 = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false; // Must not have estimate_date
      if (!e.estimate_close_date) return false;
      const year = extractYearFromDateString(e.estimate_close_date);
      return year === year2025;
    });
    console.log(`2. Estimates without estimate_date but estimate_close_date in 2025: ${noEstDateButCloseDate2025.length}`);
    if (noEstDateButCloseDate2025.length > 0) {
      console.log('   All of them:');
      noEstDateButCloseDate2025.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: close_date=${e.estimate_close_date}, exclude_stats=${e.exclude_stats}`);
      });
    }
    console.log();

    // 3. Estimates where estimate_date year doesn't match string but parsed year does
    const dateParsingEdgeCases = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const yearFromString = extractYearFromDateString(e.estimate_date);
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      // If string extraction fails but parsing works and gives 2025
      if (yearFromString !== year2025 && parsedYear === year2025) {
        return true;
      }
      return false;
    });
    console.log(`3. Estimates with date parsing edge cases (string≠2025 but parsed=2025): ${dateParsingEdgeCases.length}`);
    if (dateParsingEdgeCases.length > 0) {
      console.log('   Sample (first 20):');
      dateParsingEdgeCases.slice(0, 20).forEach(e => {
        const yearFromString = extractYearFromDateString(e.estimate_date);
        const parsedYear = new Date(e.estimate_date).getFullYear();
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${yearFromString}, parsed=${parsedYear}`);
      });
    }
    console.log();

    // 4. Check if there are estimates with created_date in 2025 but no estimate_date
    const createdDate2025NoEstDate = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (!e.created_date) return false;
      const year = extractYearFromDateString(e.created_date);
      return year === year2025;
    });
    console.log(`4. Estimates without estimate_date but created_date in 2025: ${createdDate2025NoEstDate.length}`);
    if (createdDate2025NoEstDate.length > 0) {
      console.log('   Sample (first 10):');
      createdDate2025NoEstDate.slice(0, 10).forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: created_date=${e.created_date}`);
      });
    }
    console.log();

    // 5. Check for estimates with estimate_date that contains "2025" but our extraction misses it
    const mightBe2025 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      // Check if date string contains "2025" somewhere
      if (!e.estimate_date.includes('2025')) return false;
      const year = extractYearFromDateString(e.estimate_date);
      // But our extraction didn't get 2025
      if (year === year2025) return false;
      return true;
    });
    console.log(`5. Estimates with "2025" in date string but extraction didn't get 2025: ${mightBe2025.length}`);
    if (mightBe2025.length > 0) {
      console.log('   All of them:');
      mightBe2025.forEach(e => {
        const year = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date} (extracted=${year})`);
      });
    }
    console.log();

    // 6. Check for estimates that might be duplicates we're removing but LMN keeps
    // (different duplicate removal logic)
    const duplicateLmnIds = new Map();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!duplicateLmnIds.has(est.lmn_estimate_id)) {
          duplicateLmnIds.set(est.lmn_estimate_id, []);
        }
        duplicateLmnIds.get(est.lmn_estimate_id).push(est);
      }
    });
    const actualDuplicates = Array.from(duplicateLmnIds.entries()).filter(([id, ests]) => ests.length > 1);
    console.log(`6. Duplicate lmn_estimate_ids: ${actualDuplicates.length}`);
    if (actualDuplicates.length > 0) {
      // Check if any of these duplicates have different dates
      const duplicatesWithDifferentDates = actualDuplicates.filter(([id, ests]) => {
        const dates = ests.map(e => e.estimate_date).filter(Boolean);
        const uniqueDates = new Set(dates);
        return uniqueDates.size > 1;
      });
      console.log(`   Duplicates with different estimate_date values: ${duplicatesWithDifferentDates.length}`);
      if (duplicatesWithDifferentDates.length > 0) {
        console.log('   Sample (first 5):');
        duplicatesWithDifferentDates.slice(0, 5).forEach(([id, ests]) => {
          console.log(`   - ${id}:`);
          ests.forEach(e => {
            console.log(`     ${e.id}: estimate_date=${e.estimate_date}, exclude_stats=${e.exclude_stats}`);
          });
        });
      }
    }
    console.log();

    // 7. Summary: Try different combinations to get to 1839
    console.log('📊 Testing combinations to get exactly 1,839:\n');
    
    // Combination 1: Our filter + estimates without estimate_date but with close_date in 2025
    const combo1 = new Set([
      ...ourFiltered.map(e => e.id),
      ...noEstDateButCloseDate2025.map(e => e.id)
    ]);
    console.log(`   Combo 1 (our filter + no est_date but close_date=2025): ${combo1.size} (diff: ${combo1.size - 1839})`);

    // Combination 2: Our filter + date parsing edge cases
    const combo2 = new Set([
      ...ourFiltered.map(e => e.id),
      ...dateParsingEdgeCases.map(e => e.id)
    ]);
    console.log(`   Combo 2 (our filter + date parsing edge cases): ${combo2.size} (diff: ${combo2.size - 1839})`);

    // Combination 3: Our filter + no est_date but created_date=2025
    const combo3 = new Set([
      ...ourFiltered.map(e => e.id),
      ...createdDate2025NoEstDate.map(e => e.id)
    ]);
    console.log(`   Combo 3 (our filter + no est_date but created_date=2025): ${combo3.size} (diff: ${combo3.size - 1839})`);

    // Combination 4: All of the above
    const combo4 = new Set([
      ...ourFiltered.map(e => e.id),
      ...noEstDateButCloseDate2025.map(e => e.id),
      ...dateParsingEdgeCases.map(e => e.id),
      ...createdDate2025NoEstDate.map(e => e.id)
    ]);
    console.log(`   Combo 4 (all of the above): ${combo4.size} (diff: ${combo4.size - 1839})`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

investigateRemaining9();

