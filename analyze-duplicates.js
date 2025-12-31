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

async function analyzeDuplicates() {
  console.log('🔍 Analyzing duplicates to find the 6 missing estimates...\n');

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

    // Find duplicates where at least one has 2025 date
    const duplicatesWith2025 = actualDuplicates.filter(([id, ests]) => {
      return ests.some(e => {
        if (!e.estimate_date) return false;
        const year = extractYearFromDateString(e.estimate_date);
        return year === year2025;
      });
    });

    console.log(`📊 Duplicates where at least one has 2025 date: ${duplicatesWith2025.length}\n`);

    if (duplicatesWith2025.length > 0) {
      console.log('📋 Detailed analysis of duplicates with 2025 dates:\n');
      duplicatesWith2025.forEach(([lmnId, duplicates]) => {
        console.log(`   ${lmnId}:`);
        duplicates.forEach(e => {
          const year = e.estimate_date ? extractYearFromDateString(e.estimate_date) : 'null';
          const closeYear = e.estimate_close_date ? extractYearFromDateString(e.estimate_close_date) : 'null';
          console.log(`     - ${e.id}:`);
          console.log(`       estimate_date=${e.estimate_date} (year=${year})`);
          console.log(`       estimate_close_date=${e.estimate_close_date} (year=${closeYear})`);
          console.log(`       exclude_stats=${e.exclude_stats}, status=${e.status}`);
          console.log(`       created_at=${e.created_at}`);
        });
        console.log();
      });
    }

    // Count how many 2025 estimates are in duplicates
    let total2025InDuplicates = 0;
    duplicatesWith2025.forEach(([lmnId, duplicates]) => {
      const count2025 = duplicates.filter(e => {
        if (!e.estimate_date) return false;
        const year = extractYearFromDateString(e.estimate_date);
        return year === year2025;
      }).length;
      total2025InDuplicates += count2025;
    });

    console.log(`📊 Total 2025 estimates in duplicate groups: ${total2025InDuplicates}`);
    console.log(`   (If LMN counts all duplicates, this is how many they'd count)`);
    console.log();

    // Our method: keep first, count unique
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

    console.log(`📊 Our count (removing duplicates): ${ourFiltered.length}`);
    console.log(`📊 If we count all duplicates: ${ourFiltered.length + (total2025InDuplicates - duplicatesWith2025.length)}`);
    console.log(`   (This adds ${total2025InDuplicates - duplicatesWith2025.length} extra 2025 estimates from duplicates)`);
    console.log();

    // What if LMN doesn't remove duplicates at all?
    const noDedup = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Count without any duplicate removal: ${noDedup.length}`);
    console.log(`📊 Difference from LMN: ${noDedup.length - 1839}`);
    console.log();

    // Check if there are estimates that might be counted twice in LMN
    // (e.g., if they have the same lmn_estimate_id but different IDs in our system)
    const duplicateIds = new Set();
    actualDuplicates.forEach(([lmnId, ests]) => {
      ests.forEach(e => duplicateIds.add(e.id));
    });

    const duplicateEstimates2025 = allEstimates.filter(e => {
      if (!duplicateIds.has(e.id)) return false;
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 All duplicate estimates (by ID) with 2025 date: ${duplicateEstimates2025.length}`);
    console.log(`   (These are the ones we're only counting once, but LMN might count multiple times)`);

    // If we count all of these (not just one per lmn_estimate_id), what's the total?
    const countingAllDuplicates = ourFiltered.length + (duplicateEstimates2025.length - duplicatesWith2025.length);
    console.log(`   If we count all duplicates: ${countingAllDuplicates} (diff: ${countingAllDuplicates - 1839})`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

analyzeDuplicates();

