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

async function findExact9() {
  console.log('🔍 Finding the exact 9 estimates LMN includes but we don\'t...\n');

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

    // Remove duplicates (keep first occurrence)
    const uniqueEstimates = [];
    const seenLmnIds = new Set();
    const duplicateMap = new Map(); // Track which duplicates exist
    
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenLmnIds.has(est.lmn_estimate_id)) {
          seenLmnIds.add(est.lmn_estimate_id);
          uniqueEstimates.push(est);
        } else {
          // This is a duplicate - track it
          if (!duplicateMap.has(est.lmn_estimate_id)) {
            duplicateMap.set(est.lmn_estimate_id, []);
          }
          duplicateMap.get(est.lmn_estimate_id).push(est);
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

    console.log(`📊 Our filtered count: ${ourFiltered.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Missing: ${1839 - ourFiltered.length} estimates\n`);

    // Check if LMN might be using a different duplicate removal strategy
    // Maybe LMN keeps the duplicate with the 2025 date instead of the first one?
    console.log('🔍 Checking duplicate removal strategy...\n');
    
    const duplicatesWith2025 = [];
    duplicateMap.forEach((duplicates, lmnId) => {
      // Check if any of the duplicates have estimate_date in 2025
      const has2025 = duplicates.some(d => {
        if (!d.estimate_date) return false;
        const year = extractYearFromDateString(d.estimate_date);
        return year === year2025;
      });
      if (has2025) {
        duplicatesWith2025.push({ lmnId, duplicates });
      }
    });

    console.log(`📊 Duplicates where at least one has estimate_date in 2025: ${duplicatesWith2025.length}`);
    if (duplicatesWith2025.length > 0) {
      console.log('   Checking if we kept the wrong one...\n');
      duplicatesWith2025.forEach(({ lmnId, duplicates }) => {
        const kept = uniqueEstimates.find(e => e.lmn_estimate_id === lmnId);
        const keptYear = kept?.estimate_date ? extractYearFromDateString(kept.estimate_date) : null;
        const otherYears = duplicates.map(d => {
          const year = d.estimate_date ? extractYearFromDateString(d.estimate_date) : null;
          return { id: d.id, year, exclude_stats: d.exclude_stats };
        });
        
        if (keptYear !== year2025) {
          console.log(`   - ${lmnId}:`);
          console.log(`     Kept: ${kept.id} (year=${keptYear}, exclude_stats=${kept.exclude_stats})`);
          otherYears.forEach(o => {
            if (o.year === year2025) {
              console.log(`     Other: ${o.id} (year=${o.year}, exclude_stats=${o.exclude_stats}) - THIS ONE IS 2025!`);
            }
          });
        }
      });
    }
    console.log();

    // Check for estimates where string extraction might fail
    // (dates that don't match the regex pattern but are still 2025)
    const stringExtractionFailures = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      // Try to parse it
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      // If parsed year is 2025 but string extraction didn't work
      const stringYear = extractYearFromDateString(e.estimate_date);
      return parsedYear === year2025 && stringYear !== year2025;
    });

    console.log(`📊 Estimates where string extraction failed but parsing works (2025): ${stringExtractionFailures.length}`);
    if (stringExtractionFailures.length > 0) {
      console.log('   Sample (first 20):');
      stringExtractionFailures.slice(0, 20).forEach(e => {
        const stringYear = extractYearFromDateString(e.estimate_date);
        const parsedYear = new Date(e.estimate_date).getFullYear();
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${stringYear}, parsed=${parsedYear}`);
      });
    }
    console.log();

    // Check for estimates with estimate_date that's very close to year boundary
    // (might be timezone issues)
    const yearBoundaryDates = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      // Check if date is Dec 31, 2024 or Jan 1, 2026 (might be counted as 2025 due to timezone)
      const month = parsed.getMonth();
      const date = parsed.getDate();
      const year = parsed.getFullYear();
      if ((year === 2024 && month === 11 && date === 31) || // Dec 31, 2024
          (year === 2026 && month === 0 && date === 1)) {   // Jan 1, 2026
        return true;
      }
      return false;
    });

    console.log(`📊 Estimates on year boundaries (Dec 31, 2024 or Jan 1, 2026): ${yearBoundaryDates.length}`);
    if (yearBoundaryDates.length > 0) {
      console.log('   Sample (first 10):');
      yearBoundaryDates.slice(0, 10).forEach(e => {
        const parsed = new Date(e.estimate_date);
        const stringYear = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     parsed=${parsed.toISOString()}, string=${stringYear}`);
      });
    }
    console.log();

    // Try a different approach: maybe LMN uses getFullYear() but with UTC?
    const usingUTC = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const utcYear = parsed.getUTCFullYear();
      return utcYear === year2025;
    });

    console.log(`📊 Estimates where UTC year is 2025: ${usingUTC.length}`);
    console.log(`   Difference from our count: ${usingUTC.length - ourFiltered.length}`);

    // Check if using UTC gets us closer
    if (Math.abs(usingUTC.length - 1839) < Math.abs(ourFiltered.length - 1839)) {
      console.log(`   ✅ Using UTC gets us closer! (${usingUTC.length} vs ${ourFiltered.length})`);
      
      // Find which estimates are in UTC but not in our filter
      const utcIds = new Set(usingUTC.map(e => e.id));
      const ourIds = new Set(ourFiltered.map(e => e.id));
      const inUTCButNotOurs = usingUTC.filter(e => !ourIds.has(e.id));
      
      console.log(`\n   Estimates in UTC filter but not ours: ${inUTCButNotOurs.length}`);
      if (inUTCButNotOurs.length > 0) {
        console.log('   Sample (first 20):');
        inUTCButNotOurs.slice(0, 20).forEach(e => {
          const parsed = new Date(e.estimate_date);
          const localYear = parsed.getFullYear();
          const utcYear = parsed.getUTCFullYear();
          const stringYear = extractYearFromDateString(e.estimate_date);
          console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
          console.log(`     local=${localYear}, UTC=${utcYear}, string=${stringYear}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

findExact9();

