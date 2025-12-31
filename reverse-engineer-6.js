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

async function reverseEngineer6() {
  console.log('🔍 Reverse engineering the 6 estimate difference...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status, created_date, created_at, updated_at')
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

    // Remove duplicates (keep first)
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

    // Our current filter
    const ourFiltered = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Our count: ${ourFiltered.length}`);
    console.log(`📊 LMN count: 1,839`);
    console.log(`📊 Missing: ${1839 - ourFiltered.length} estimates\n`);

    // Strategy: What if LMN uses getFullYear() but excludes the false 2025s?
    // Then they'd have: getFullYear() count - false 2025s = ?
    const usingGetFullYear = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });

    const false2025s = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      return yearFromString === 2026; // These are actually 2026
    });

    const excludingFalse2025s = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      return yearFromString !== 2026;
    });

    console.log(`📊 Analysis of getFullYear() method:`);
    console.log(`   - Using getFullYear(): ${usingGetFullYear.length}`);
    console.log(`   - False 2025s (actually 2026): ${false2025s.length}`);
    console.log(`   - After excluding false 2025s: ${excludingFalse2025s.length}`);
    console.log(`   - Difference from LMN: ${excludingFalse2025s.length - 1839}\n`);

    // What if LMN uses getFullYear() but includes some of the false 2025s?
    // Or excludes some estimates we include?
    const needToInclude = 1839 - excludingFalse2025s.length;
    console.log(`📊 If LMN uses getFullYear() and excludes false 2025s:`);
    console.log(`   - They'd need to include ${needToInclude} more estimates\n`);

    // Check if there are estimates where getFullYear() gives 2025 but string extraction gives something else
    const getFullYearButNotString = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      const stringYear = extractYearFromDateString(e.estimate_date);
      return parsedYear === year2025 && stringYear !== year2025;
    });

    console.log(`📊 Estimates where getFullYear()=2025 but string extraction≠2025: ${getFullYearButNotString.length}`);
    if (getFullYearButNotString.length > 0) {
      // Group by what string extraction gives
      const byStringYear = {};
      getFullYearButNotString.forEach(e => {
        const stringYear = extractYearFromDateString(e.estimate_date);
        const key = stringYear || 'null';
        if (!byStringYear[key]) byStringYear[key] = [];
        byStringYear[key].push(e);
      });
      
      console.log(`   Breakdown by string extraction result:`);
      Object.entries(byStringYear).sort((a, b) => b[1].length - a[1].length).forEach(([year, ests]) => {
        console.log(`   - String extraction = ${year}: ${ests.length} estimates`);
        if (year === '2026' && ests.length <= 10) {
          console.log(`     Sample:`);
          ests.slice(0, 5).forEach(e => {
            console.log(`       ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
          });
        }
      });
    }
    console.log();

    // What if LMN includes some estimates based on estimate_close_date when estimate_date is missing?
    const noEstDateButCloseDate2025 = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (!e.estimate_close_date) return false;
      const year = extractYearFromDateString(e.estimate_close_date);
      return year === year2025;
    });
    console.log(`📊 Estimates without estimate_date but estimate_close_date in 2025: ${noEstDateButCloseDate2025.length}`);
    if (noEstDateButCloseDate2025.length > 0) {
      console.log('   All of them:');
      noEstDateButCloseDate2025.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: close_date=${e.estimate_close_date}`);
      });
    }
    console.log();

    // What if LMN uses a different date parsing method for edge cases?
    // Check for dates that might parse differently
    const edgeCaseDates = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const dateStr = e.estimate_date;
      // Check for dates that might have timezone issues
      // Dates like "2025-01-01T00:00:00+00:00" might parse to 2024 in some timezones
      if (dateStr.includes('2025') && dateStr.includes('T00:00:00')) {
        const parsed = new Date(dateStr);
        const parsedYear = parsed.getFullYear();
        const stringYear = extractYearFromDateString(dateStr);
        // If they differ, it's an edge case
        if (parsedYear !== stringYear) {
          return parsedYear === year2025 || stringYear === year2025;
        }
      }
      return false;
    });

    console.log(`📊 Edge case dates (timezone-sensitive): ${edgeCaseDates.length}`);
    if (edgeCaseDates.length > 0 && edgeCaseDates.length <= 20) {
      console.log('   Sample:');
      edgeCaseDates.slice(0, 20).forEach(e => {
        const parsed = new Date(e.estimate_date);
        const stringYear = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${stringYear}, parsed=${parsed.getFullYear()}, UTC=${parsed.getUTCFullYear()}`);
      });
    }
    console.log();

    // Try to find exactly 6 estimates that would get us to 1839
    console.log(`📊 Trying to find the exact 6 missing estimates...\n`);

    // Strategy 1: Include estimates where getFullYear()=2025 but string extraction gives 2024
    const getFullYear2025ButString2024 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      const stringYear = extractYearFromDateString(e.estimate_date);
      return parsedYear === year2025 && stringYear === 2024;
    });

    console.log(`1. Estimates where getFullYear()=2025 but string extraction=2024: ${getFullYear2025ButString2024.length}`);
    if (getFullYear2025ButString2024.length > 0) {
      console.log('   Sample (first 10):');
      getFullYear2025ButString2024.slice(0, 10).forEach(e => {
        const parsed = new Date(e.estimate_date);
        const stringYear = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${stringYear}, parsed=${parsed.getFullYear()}, UTC=${parsed.getUTCFullYear()}`);
      });
    }

    // If we include these, what's the count?
    const includingGetFullYear2024s = new Set([
      ...ourFiltered.map(e => e.id),
      ...getFullYear2025ButString2024.map(e => e.id)
    ]);
    console.log(`   If we include these: ${includingGetFullYear2024s.size} (diff: ${includingGetFullYear2024s.size - 1839})`);
    console.log();

    // Strategy 2: Check if there are estimates with created_date in 2025 but no estimate_date
    const createdDate2025NoEstDate = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (!e.created_date) return false;
      const year = extractYearFromDateString(e.created_date);
      return year === year2025;
    });
    console.log(`2. Estimates without estimate_date but created_date in 2025: ${createdDate2025NoEstDate.length}`);
    if (createdDate2025NoEstDate.length > 0 && createdDate2025NoEstDate.length <= 10) {
      console.log('   All of them:');
      createdDate2025NoEstDate.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: created_date=${e.created_date}`);
      });
    }
    console.log();

    // Strategy 3: What if LMN uses UTC dates?
    const usingUTC = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getUTCFullYear() === year2025;
    });
    console.log(`3. Estimates where UTC year is 2025: ${usingUTC.length}`);
    console.log(`   Difference from our count: ${usingUTC.length - ourFiltered.length}`);
    
    // Find which are in UTC but not in ours
    const ourIds = new Set(ourFiltered.map(e => e.id));
    const utcOnly = usingUTC.filter(e => !ourIds.has(e.id));
    console.log(`   Estimates in UTC filter but not ours: ${utcOnly.length}`);
    if (utcOnly.length > 0 && utcOnly.length <= 10) {
      console.log('   Sample:');
      utcOnly.slice(0, 10).forEach(e => {
        const parsed = new Date(e.estimate_date);
        const localYear = parsed.getFullYear();
        const utcYear = parsed.getUTCFullYear();
        const stringYear = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     local=${localYear}, UTC=${utcYear}, string=${stringYear}`);
      });
    }
    console.log();

    // Final summary
    console.log(`📊 SUMMARY OF POTENTIAL SOURCES FOR THE 6 MISSING ESTIMATES:\n`);
    console.log(`   Our count: ${ourFiltered.length}`);
    console.log(`   LMN count: 1,839`);
    console.log(`   Need: 6 more estimates\n`);
    console.log(`   Potential sources:`);
    console.log(`   1. getFullYear()=2025 but string=2024: ${getFullYear2025ButString2024.length}`);
    console.log(`   2. No estimate_date but created_date=2025: ${createdDate2025NoEstDate.length}`);
    console.log(`   3. UTC year=2025 but not in our filter: ${utcOnly.length}`);
    console.log(`   4. Estimates in LMN but not in our database: Unknown`);

    // Try combinations
    const combo1 = new Set([
      ...ourFiltered.map(e => e.id),
      ...getFullYear2025ButString2024.map(e => e.id)
    ]);
    console.log(`\n   Combo 1 (our filter + getFullYear=2025 but string=2024): ${combo1.size} (diff: ${combo1.size - 1839})`);

    const combo2 = new Set([
      ...ourFiltered.map(e => e.id),
      ...createdDate2025NoEstDate.map(e => e.id)
    ]);
    console.log(`   Combo 2 (our filter + created_date=2025): ${combo2.size} (diff: ${combo2.size - 1839})`);

    const combo3 = new Set([
      ...ourFiltered.map(e => e.id),
      ...utcOnly.map(e => e.id)
    ]);
    console.log(`   Combo 3 (our filter + UTC only): ${combo3.size} (diff: ${combo3.size - 1839})`);

    const combo4 = new Set([
      ...ourFiltered.map(e => e.id),
      ...getFullYear2025ButString2024.map(e => e.id),
      ...createdDate2025NoEstDate.map(e => e.id),
      ...utcOnly.map(e => e.id)
    ]);
    console.log(`   Combo 4 (all of the above): ${combo4.size} (diff: ${combo4.size - 1839})`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

reverseEngineer6();

