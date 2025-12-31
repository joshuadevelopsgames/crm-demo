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

async function checkDuplicateStrategy() {
  console.log('🔍 Checking if duplicate removal strategy is the issue...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, exclude_stats, status, created_at')
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

    const year2025 = 2025;

    // Find all duplicates
    const duplicateMap = new Map();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!duplicateMap.has(est.lmn_estimate_id)) {
          duplicateMap.set(est.lmn_estimate_id, []);
        }
        duplicateMap.get(est.lmn_estimate_id).push(est);
      }
    });

    const actualDuplicates = Array.from(duplicateMap.entries()).filter(([id, ests]) => ests.length > 1);
    console.log(`📊 Total duplicate lmn_estimate_ids: ${actualDuplicates.length}\n`);

    // Our strategy: keep first occurrence (by created_at order)
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

    const ourFiltered = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Our strategy (keep first): ${ourFiltered.length}`);

    // Alternative strategies for duplicate removal
    const strategies = [];

    // Strategy 1: Keep the one with estimate_date in 2025 (if any)
    const strategy1 = [];
    const seen1 = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seen1.has(est.lmn_estimate_id)) {
          const duplicates = duplicateMap.get(est.lmn_estimate_id) || [est];
          // Find one with 2025 date, or keep first
          const with2025 = duplicates.find(d => {
            if (!d.estimate_date) return false;
            const year = extractYearFromDateString(d.estimate_date);
            return year === year2025;
          });
          const toKeep = with2025 || duplicates[0];
          seen1.add(est.lmn_estimate_id);
          strategy1.push(toKeep);
        }
      } else {
        strategy1.push(est);
      }
    });
    const filtered1 = strategy1.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    strategies.push({ name: 'Keep duplicate with 2025 date', count: filtered1.length });

    // Strategy 2: Keep the one without exclude_stats (prefer exclude_stats=false)
    const strategy2 = [];
    const seen2 = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seen2.has(est.lmn_estimate_id)) {
          const duplicates = duplicateMap.get(est.lmn_estimate_id) || [est];
          // Find one without exclude_stats, or keep first
          const withoutExclude = duplicates.find(d => !d.exclude_stats);
          const toKeep = withoutExclude || duplicates[0];
          seen2.add(est.lmn_estimate_id);
          strategy2.push(toKeep);
        }
      } else {
        strategy2.push(est);
      }
    });
    const filtered2 = strategy2.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    strategies.push({ name: 'Keep duplicate without exclude_stats', count: filtered2.length });

    // Strategy 3: Keep the most recent one (by created_at)
    const strategy3 = [];
    const seen3 = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seen3.has(est.lmn_estimate_id)) {
          const duplicates = duplicateMap.get(est.lmn_estimate_id) || [est];
          // Sort by created_at descending, keep first
          const sorted = duplicates.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          });
          seen3.add(est.lmn_estimate_id);
          strategy3.push(sorted[0]);
        }
      } else {
        strategy3.push(est);
      }
    });
    const filtered3 = strategy3.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    strategies.push({ name: 'Keep most recent duplicate', count: filtered3.length });

    // Strategy 4: Keep the one with estimate_date (prefer having date)
    const strategy4 = [];
    const seen4 = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seen4.has(est.lmn_estimate_id)) {
          const duplicates = duplicateMap.get(est.lmn_estimate_id) || [est];
          // Find one with estimate_date, or keep first
          const withDate = duplicates.find(d => d.estimate_date);
          const toKeep = withDate || duplicates[0];
          seen4.add(est.lmn_estimate_id);
          strategy4.push(toKeep);
        }
      } else {
        strategy4.push(est);
      }
    });
    const filtered4 = strategy4.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    strategies.push({ name: 'Keep duplicate with estimate_date', count: filtered4.length });

    console.log(`\n📊 Testing different duplicate removal strategies:\n`);
    strategies.forEach((s, idx) => {
      const diff = Math.abs(s.count - 1839);
      const marker = diff === 0 ? '✅ EXACT MATCH' : diff < 5 ? '⚠️  Very close' : diff < 10 ? '⚠️  Close' : '  ';
      console.log(`${marker} ${idx + 1}. ${s.name}`);
      console.log(`   Count: ${s.count}, Difference: ${diff}\n`);
    });

    // Check if any duplicates have different estimate_date years
    const duplicatesWithDifferentYears = actualDuplicates.filter(([id, ests]) => {
      const years = ests
        .map(e => e.estimate_date ? extractYearFromDateString(e.estimate_date) : null)
        .filter(y => y !== null);
      const uniqueYears = new Set(years);
      return uniqueYears.size > 1;
    });

    console.log(`📊 Duplicates with different estimate_date years: ${duplicatesWithDifferentYears.length}`);
    if (duplicatesWithDifferentYears.length > 0) {
      console.log('   Sample (first 5):');
      duplicatesWithDifferentYears.slice(0, 5).forEach(([id, ests]) => {
        console.log(`   - ${id}:`);
        ests.forEach(e => {
          const year = e.estimate_date ? extractYearFromDateString(e.estimate_date) : 'null';
          console.log(`     ${e.id}: estimate_date=${e.estimate_date} (year=${year}), exclude_stats=${e.exclude_stats}, created_at=${e.created_at}`);
        });
      });
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkDuplicateStrategy();

