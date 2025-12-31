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

async function checkMissing9() {
  console.log('🔍 Checking if the 9 missing estimates are in our database...\n');

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
    console.log(`📊 Difference: ${ourFiltered.length - 1839} (we're missing ${1839 - ourFiltered.length})\n`);

    // Check if there are estimates in our DB that might be the missing 9
    console.log('🔍 Checking potential candidates for the missing 9...\n');

    // 1. Estimates without estimate_date but with estimate_close_date in 2025
    const noEstDateButCloseDate = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (!e.estimate_close_date) return false;
      const year = extractYearFromDateString(e.estimate_close_date);
      return year === year2025;
    });
    console.log(`1. Estimates without estimate_date but estimate_close_date in 2025: ${noEstDateButCloseDate.length}`);
    if (noEstDateButCloseDate.length > 0) {
      console.log('   These might be counted by LMN if they use close_date as fallback:');
      noEstDateButCloseDate.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: close_date=${e.estimate_close_date}`);
      });
    }
    console.log();

    // 2. Estimates where estimate_date year extraction might fail but getFullYear() works
    const extractionMightFail = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const stringYear = extractYearFromDateString(e.estimate_date);
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      // If string extraction returns null or wrong year, but parsing works
      return (stringYear === null || stringYear !== parsedYear) && parsedYear === year2025;
    });
    console.log(`2. Estimates where string extraction might fail but getFullYear()=2025: ${extractionMightFail.length}`);
    if (extractionMightFail.length > 0 && extractionMightFail.length <= 20) {
      console.log('   Sample:');
      extractionMightFail.slice(0, 20).forEach(e => {
        const stringYear = extractYearFromDateString(e.estimate_date);
        const parsedYear = new Date(e.estimate_date).getFullYear();
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${stringYear}, parsed=${parsedYear}`);
      });
    }
    console.log();

    // 3. Check if we're excluding any estimates that LMN might include
    // (e.g., estimates with exclude_stats that LMN still counts)
    const withExcludeStats = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (!e.exclude_stats) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    console.log(`3. Estimates with exclude_stats=true that we're excluding: ${withExcludeStats.length}`);
    console.log(`   (We already include these, so this isn't the issue)`);
    console.log();

    // 4. Summary: What if we include estimates without estimate_date but with close_date?
    const includingCloseDate = new Set([
      ...ourFiltered.map(e => e.id),
      ...noEstDateButCloseDate.map(e => e.id)
    ]);
    console.log(`4. If we include estimates with close_date (when no estimate_date): ${includingCloseDate.size}`);
    console.log(`   Difference from LMN: ${includingCloseDate.size - 1839}`);

    // 5. What if LMN uses getFullYear() for some edge cases?
    const usingGetFullYearForEdgeCases = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const stringYear = extractYearFromDateString(e.estimate_date);
      // If string extraction doesn't work, try getFullYear()
      if (stringYear === null || stringYear !== year2025) {
        const parsed = new Date(e.estimate_date);
        if (isNaN(parsed.getTime())) return false;
        return parsed.getFullYear() === year2025;
      }
      return false;
    });
    console.log(`\n5. Estimates where string extraction fails but getFullYear()=2025: ${usingGetFullYearForEdgeCases.length}`);
    if (usingGetFullYearForEdgeCases.length > 0 && usingGetFullYearForEdgeCases.length <= 20) {
      console.log('   Sample:');
      usingGetFullYearForEdgeCases.slice(0, 20).forEach(e => {
        const stringYear = extractYearFromDateString(e.estimate_date);
        const parsedYear = new Date(e.estimate_date).getFullYear();
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${stringYear}, parsed=${parsedYear}`);
      });
    }

    // Final summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Our count: ${ourFiltered.length}`);
    console.log(`   LMN count: 1,839`);
    console.log(`   Missing: ${1839 - ourFiltered.length} estimates`);
    console.log(`\n   Possible sources of the missing 9:`);
    console.log(`   - Estimates without estimate_date but with estimate_close_date: ${noEstDateButCloseDate.length}`);
    console.log(`   - Estimates where string extraction fails: ${usingGetFullYearForEdgeCases.length}`);
    console.log(`   - Estimates that exist in LMN but not in our database: Unknown`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkMissing9();

