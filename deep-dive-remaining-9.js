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

async function deepDiveRemaining9() {
  console.log('🔍 Deep dive into the remaining 9 estimates...\n');

  try {
    // Fetch all estimates with all date fields
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, created_date, created_at, updated_at, exclude_stats, status')
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

    // Our current best filter
    const ourFiltered = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Our filtered count: ${ourFiltered.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Missing: ${1839 - ourFiltered.length} estimates\n`);

    // 1. Check if LMN might use created_date for estimates without estimate_date
    const noEstDateButCreatedDate2025 = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (!e.created_date) return false;
      const year = extractYearFromDateString(e.created_date);
      return year === year2025;
    });
    console.log(`1. Estimates without estimate_date but created_date in 2025: ${noEstDateButCreatedDate2025.length}`);
    if (noEstDateButCreatedDate2025.length > 0) {
      console.log('   All of them:');
      noEstDateButCreatedDate2025.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: created_date=${e.created_date}, exclude_stats=${e.exclude_stats}`);
      });
    }
    console.log();

    // 2. Check if LMN might use created_at for estimates without estimate_date
    const noEstDateButCreatedAt2025 = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (!e.created_at) return false;
      const year = extractYearFromDateString(e.created_at);
      return year === year2025;
    });
    console.log(`2. Estimates without estimate_date but created_at in 2025: ${noEstDateButCreatedAt2025.length}`);
    if (noEstDateButCreatedAt2025.length > 0) {
      console.log('   Sample (first 20):');
      noEstDateButCreatedAt2025.slice(0, 20).forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: created_at=${e.created_at}`);
      });
    }
    console.log();

    // 3. Check for estimates where estimate_date exists but might be in a format we're missing
    const withEstDate = uniqueEstimates.filter(e => e.estimate_date);
    const estDateFormats = new Map();
    withEstDate.forEach(e => {
      const dateStr = e.estimate_date;
      // Categorize by format
      let format = 'unknown';
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr)) {
        format = 'ISO with time';
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        format = 'ISO date only';
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
        format = 'MM/DD/YYYY';
      } else if (/^\d{4}\/\d{2}\/\d{2}/.test(dateStr)) {
        format = 'YYYY/MM/DD';
      }
      
      if (!estDateFormats.has(format)) {
        estDateFormats.set(format, []);
      }
      estDateFormats.get(format).push(e);
    });

    console.log(`3. estimate_date format breakdown:`);
    estDateFormats.forEach((estimates, format) => {
      const year2025Count = estimates.filter(e => {
        const year = extractYearFromDateString(e.estimate_date);
        return year === year2025;
      }).length;
      console.log(`   - ${format}: ${estimates.length} total, ${year2025Count} in 2025`);
    });
    console.log();

    // 4. Check for estimates where our string extraction might fail
    const stringExtractionFailures = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      // Try multiple extraction methods
      const yearMatch = e.estimate_date.match(/\b(20[0-9]{2})\b/);
      if (yearMatch) return false; // String extraction worked
      
      // Try parsing
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      return parsedYear === year2025;
    });

    console.log(`4. Estimates where string extraction fails but parsing works (2025): ${stringExtractionFailures.length}`);
    if (stringExtractionFailures.length > 0) {
      console.log('   Sample (first 20):');
      stringExtractionFailures.slice(0, 20).forEach(e => {
        const parsed = new Date(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     parsed=${parsed.toISOString()}, getFullYear()=${parsed.getFullYear()}`);
      });
    }
    console.log();

    // 5. Check if there are estimates with estimate_date that contains "2025" but in a different position
    const mightContain2025 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      // Check if it contains "2025" anywhere
      if (!e.estimate_date.includes('2025')) return false;
      // But our extraction didn't get it
      const year = extractYearFromDateString(e.estimate_date);
      if (year === year2025) return false;
      return true;
    });

    console.log(`5. Estimates with "2025" in date string but extraction didn't get it: ${mightContain2025.length}`);
    if (mightContain2025.length > 0) {
      console.log('   All of them:');
      mightContain2025.forEach(e => {
        const year = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date} (extracted=${year})`);
      });
    }
    console.log();

    // 6. Check for estimates that might be counted by LMN using a hybrid approach
    // (e.g., estimate_date if available, otherwise estimate_close_date, otherwise created_date)
    const hybridApproach = uniqueEstimates.filter(e => {
      const date = e.estimate_date || e.estimate_close_date || e.created_date;
      if (!date) return false;
      const year = extractYearFromDateString(date);
      return year === year2025;
    });

    console.log(`6. Hybrid approach (est_date || close_date || created_date): ${hybridApproach.length}`);
    console.log(`   Difference from our count: ${hybridApproach.length - ourFiltered.length}`);

    // Find which estimates are in hybrid but not in ours
    const ourIds = new Set(ourFiltered.map(e => e.id));
    const hybridOnly = hybridApproach.filter(e => !ourIds.has(e.id));
    console.log(`   Estimates in hybrid but not ours: ${hybridOnly.length}`);
    if (hybridOnly.length > 0 && hybridOnly.length <= 20) {
      console.log('   All of them:');
      hybridOnly.forEach(e => {
        const dateUsed = e.estimate_date || e.estimate_close_date || e.created_date;
        const dateType = e.estimate_date ? 'estimate_date' : (e.estimate_close_date ? 'estimate_close_date' : 'created_date');
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${dateType}=${dateUsed}`);
      });
    }
    console.log();

    // 7. Check if LMN might count estimates based on when they were last updated in 2025
    const updatedAt2025 = uniqueEstimates.filter(e => {
      if (!e.updated_at) return false;
      const year = extractYearFromDateString(e.updated_at);
      return year === year2025;
    });
    console.log(`7. Estimates with updated_at in 2025: ${updatedAt2025.length}`);

    // 8. Try to find exactly 9 estimates that might be the missing ones
    console.log(`\n8. Trying to identify the exact 9 missing estimates...\n`);
    
    // Strategy: Look for estimates that have ANY date field in 2025 but estimate_date is not 2025
    const anyDate2025 = uniqueEstimates.filter(e => {
      // Must NOT have estimate_date in 2025 (we already count those)
      if (e.estimate_date) {
        const estYear = extractYearFromDateString(e.estimate_date);
        if (estYear === year2025) return false; // Already counted
      }
      
      // But has another date field in 2025
      if (e.estimate_close_date) {
        const closeYear = extractYearFromDateString(e.estimate_close_date);
        if (closeYear === year2025) return true;
      }
      if (e.created_date) {
        const createdYear = extractYearFromDateString(e.created_date);
        if (createdYear === year2025) return true;
      }
      if (e.created_at) {
        const createdAtYear = extractYearFromDateString(e.created_at);
        if (createdAtYear === year2025) return true;
      }
      
      return false;
    });

    console.log(`   Estimates with other date fields in 2025 (but estimate_date not 2025): ${anyDate2025.length}`);
    if (anyDate2025.length > 0 && anyDate2025.length <= 20) {
      console.log('   All of them:');
      anyDate2025.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}:`);
        if (e.estimate_date) console.log(`     estimate_date=${e.estimate_date} (${extractYearFromDateString(e.estimate_date)})`);
        if (e.estimate_close_date) console.log(`     estimate_close_date=${e.estimate_close_date} (${extractYearFromDateString(e.estimate_close_date)})`);
        if (e.created_date) console.log(`     created_date=${e.created_date} (${extractYearFromDateString(e.created_date)})`);
        if (e.created_at) console.log(`     created_at=${e.created_at} (${extractYearFromDateString(e.created_at)})`);
      });
    }

    // If we add these, what's the count?
    const withAnyDate2025 = new Set([
      ...ourFiltered.map(e => e.id),
      ...anyDate2025.map(e => e.id)
    ]);
    console.log(`\n   If we include estimates with any date field in 2025: ${withAnyDate2025.size}`);
    console.log(`   Difference from LMN: ${withAnyDate2025.size - 1839}`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

deepDiveRemaining9();

