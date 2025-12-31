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

async function findRemaining5() {
  console.log('🔍 Finding the remaining 5 missing estimates...\n');

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

    // Count without duplicate removal (closest match: 1834, only 5 off)
    const noDedup = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Count without duplicate removal: ${noDedup.length}`);
    console.log(`📊 LMN count: 1,839`);
    console.log(`📊 Missing: ${1839 - noDedup.length} estimates\n`);

    // Check: What if LMN uses estimate_close_date for some estimates?
    // Maybe estimates where estimate_date is null but close_date is 2025?
    const noEstDateButCloseDate2025 = allEstimates.filter(e => {
      if (e.estimate_date) return false; // Must not have estimate_date
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

    // Check: What if LMN uses getFullYear() for dates where string extraction gives 2024?
    // (The 40 estimates with "2025-01-01" that getFullYear() incorrectly returns 2024)
    const string2025ButGetFullYear2024 = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const stringYear = extractYearFromDateString(e.estimate_date);
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      return stringYear === year2025 && parsedYear === 2024;
    });

    console.log(`📊 Estimates where string=2025 but getFullYear()=2024: ${string2025ButGetFullYear2024.length}`);
    if (string2025ButGetFullYear2024.length > 0 && string2025ButGetFullYear2024.length <= 10) {
      console.log('   Sample (first 10):');
      string2025ButGetFullYear2024.slice(0, 10).forEach(e => {
        const parsed = new Date(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=2025, parsed=${parsed.getFullYear()}, UTC=${parsed.getUTCFullYear()}`);
      });
    }
    console.log();

    // Check: What if LMN includes estimates based on created_date when estimate_date is missing?
    const noEstDateButCreatedDate2025 = allEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (!e.created_date) return false;
      const year = extractYearFromDateString(e.created_date);
      return year === year2025;
    });

    console.log(`📊 Estimates without estimate_date but created_date in 2025: ${noEstDateButCreatedDate2025.length}`);
    if (noEstDateButCreatedDate2025.length > 0) {
      console.log('   All of them:');
      noEstDateButCreatedDate2025.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: created_date=${e.created_date}`);
      });
    }
    console.log();

    // Try combinations
    console.log('📊 Testing combinations to get exactly 1,839:\n');

    // Combo 1: No dedup + null est_date but close_date=2025
    const combo1 = new Set([
      ...noDedup.map(e => e.id),
      ...noEstDateButCloseDate2025.map(e => e.id)
    ]);
    console.log(`   Combo 1 (no dedup + null est_date but close_date=2025): ${combo1.size} (diff: ${combo1.size - 1839})`);

    // Combo 2: No dedup + null est_date but created_date=2025
    const combo2 = new Set([
      ...noDedup.map(e => e.id),
      ...noEstDateButCreatedDate2025.map(e => e.id)
    ]);
    console.log(`   Combo 2 (no dedup + null est_date but created_date=2025): ${combo2.size} (diff: ${combo2.size - 1839})`);

    // Combo 3: No dedup + both close_date and created_date fallbacks
    const combo3 = new Set([
      ...noDedup.map(e => e.id),
      ...noEstDateButCloseDate2025.map(e => e.id),
      ...noEstDateButCreatedDate2025.map(e => e.id)
    ]);
    console.log(`   Combo 3 (no dedup + both fallbacks): ${combo3.size} (diff: ${combo3.size - 1839})`);

    // Combo 4: What if LMN uses estimate_close_date || estimate_date (not just estimate_date)?
    const usingCloseDateFallback = allEstimates.filter(e => {
      const date = e.estimate_close_date || e.estimate_date;
      if (!date) return false;
      const year = extractYearFromDateString(date);
      return year === year2025;
    });
    // Remove duplicates
    const uniqueUsingCloseDate = [];
    const seenCloseDate = new Set();
    usingCloseDateFallback.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenCloseDate.has(est.lmn_estimate_id)) {
          seenCloseDate.add(est.lmn_estimate_id);
          uniqueUsingCloseDate.push(est);
        }
      } else {
        uniqueUsingCloseDate.push(est);
      }
    });
    const filteredCloseDate = uniqueUsingCloseDate.filter(e => {
      const date = e.estimate_close_date || e.estimate_date;
      if (!date) return false;
      const year = extractYearFromDateString(date);
      return year === year2025;
    });
    console.log(`   Combo 4 (estimate_close_date || estimate_date, with dedup): ${filteredCloseDate.length} (diff: ${filteredCloseDate.length - 1839})`);

    // Combo 5: estimate_close_date || estimate_date, no dedup
    const noDedupCloseDate = allEstimates.filter(e => {
      const date = e.estimate_close_date || e.estimate_date;
      if (!date) return false;
      const year = extractYearFromDateString(date);
      return year === year2025;
    });
    console.log(`   Combo 5 (estimate_close_date || estimate_date, no dedup): ${noDedupCloseDate.length} (diff: ${noDedupCloseDate.length - 1839})`);

    // Find the exact match
    const combos = [
      { name: 'Combo 1', count: combo1.size },
      { name: 'Combo 2', count: combo2.size },
      { name: 'Combo 3', count: combo3.size },
      { name: 'Combo 4', count: filteredCloseDate.length },
      { name: 'Combo 5', count: noDedupCloseDate.length }
    ];

    const exactMatch = combos.find(c => c.count === 1839);
    const closest = combos.reduce((best, current) => {
      const currentDiff = Math.abs(current.count - 1839);
      const bestDiff = Math.abs(best.count - 1839);
      return currentDiff < bestDiff ? current : best;
    });

    if (exactMatch) {
      console.log(`\n🎉 EXACT MATCH FOUND!`);
      console.log(`   Method: ${exactMatch.name}`);
      console.log(`   Count: ${exactMatch.count}`);
    } else {
      console.log(`\n✅ Closest match: ${closest.name}`);
      console.log(`   Count: ${closest.count}`);
      console.log(`   Difference: ${closest.count - 1839}`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

findRemaining5();

