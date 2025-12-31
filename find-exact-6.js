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

async function findExact6() {
  console.log('🔍 Finding the exact 6 missing estimates...\n');

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

    const year2025 = 2025;

    // Test: What if LMN doesn't remove duplicates at all?
    const noDedup = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    console.log(`📊 Without duplicate removal: ${noDedup.length} (diff: ${noDedup.length - 1839})`);

    // Our method: remove duplicates, string extraction
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

    console.log(`📊 Our method (with duplicate removal): ${ourFiltered.length} (diff: ${ourFiltered.length - 1839})\n`);

    // Check if there are estimates without lmn_estimate_id that might be counted differently
    const withoutLmnId = allEstimates.filter(e => !e.lmn_estimate_id);
    const withoutLmnId2025 = withoutLmnId.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    console.log(`📊 Estimates without lmn_estimate_id: ${withoutLmnId.length}`);
    console.log(`📊 Estimates without lmn_estimate_id in 2025: ${withoutLmnId2025.length}`);
    if (withoutLmnId2025.length > 0) {
      console.log('   Sample (first 10):');
      withoutLmnId2025.slice(0, 10).forEach(e => {
        console.log(`   - ${e.estimate_number || e.id}: ${e.estimate_date}, status=${e.status}`);
      });
    }
    console.log();

    // Check: What if LMN counts ALL duplicates (doesn't remove them)?
    const duplicateCount = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      if (year !== year2025) return false;
      // Check if this is a duplicate
      if (e.lmn_estimate_id) {
        const duplicates = allEstimates.filter(d => d.lmn_estimate_id === e.lmn_estimate_id);
        return duplicates.length > 1;
      }
      return false;
    }).length;

    console.log(`📊 Duplicate estimates (by lmn_estimate_id) with 2025 date: ${duplicateCount}`);
    console.log(`   (If LMN counts all duplicates, this would add ${duplicateCount} to our count)`);
    console.log(`   New total would be: ${ourFiltered.length + duplicateCount} (diff: ${ourFiltered.length + duplicateCount - 1839})`);
    console.log();

    // Check: What if LMN uses a different date field for some estimates?
    // Maybe they use estimate_close_date when estimate_date is missing or null?
    const estDateNullButCloseDate2025 = allEstimates.filter(e => {
      // Must have lmn_estimate_id (to be in LMN)
      if (!e.lmn_estimate_id) return false;
      // estimate_date must be null or empty
      if (e.estimate_date) return false;
      // estimate_close_date must exist and be 2025
      if (!e.estimate_close_date) return false;
      const year = extractYearFromDateString(e.estimate_close_date);
      return year === year2025;
    });

    console.log(`📊 Estimates with null estimate_date but estimate_close_date in 2025: ${estDateNullButCloseDate2025.length}`);
    if (estDateNullButCloseDate2025.length > 0) {
      console.log('   All of them:');
      estDateNullButCloseDate2025.forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: close_date=${e.estimate_close_date}`);
      });
    }
    console.log();

    // Check: What if LMN uses getFullYear() for some edge cases where string extraction fails?
    const getFullYearEdgeCases = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      const stringYear = extractYearFromDateString(e.estimate_date);
      // If string extraction doesn't give 2025, but getFullYear() does
      if (stringYear === year2025) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });

    console.log(`📊 Estimates where getFullYear()=2025 but string extraction≠2025: ${getFullYearEdgeCases.length}`);
    if (getFullYearEdgeCases.length > 0 && getFullYearEdgeCases.length <= 20) {
      console.log('   Sample (first 20):');
      getFullYearEdgeCases.slice(0, 20).forEach(e => {
        const stringYear = extractYearFromDateString(e.estimate_date);
        const parsed = new Date(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${stringYear}, parsed=${parsed.getFullYear()}`);
      });
    }
    console.log();

    // Try combinations to get exactly 1839
    console.log('📊 Testing combinations to get exactly 1,839:\n');

    // Combo 1: Our filter + estimates with null est_date but close_date=2025
    const combo1 = new Set([
      ...ourFiltered.map(e => e.id),
      ...estDateNullButCloseDate2025.map(e => e.id)
    ]);
    console.log(`   Combo 1 (our filter + null est_date but close_date=2025): ${combo1.size} (diff: ${combo1.size - 1839})`);

    // Combo 2: Our filter + getFullYear() edge cases
    const combo2 = new Set([
      ...ourFiltered.map(e => e.id),
      ...getFullYearEdgeCases.map(e => e.id)
    ]);
    console.log(`   Combo 2 (our filter + getFullYear() edge cases): ${combo2.size} (diff: ${combo2.size - 1839})`);

    // Combo 3: Our filter + all duplicates (don't remove)
    const combo3Count = ourFiltered.length + duplicateCount;
    console.log(`   Combo 3 (our filter + count all duplicates): ${combo3Count} (diff: ${combo3Count - 1839})`);

    // Combo 4: No duplicate removal at all
    console.log(`   Combo 4 (no duplicate removal): ${noDedup.length} (diff: ${noDedup.length - 1839})`);

    // Combo 5: All of the above
    const combo5 = new Set([
      ...ourFiltered.map(e => e.id),
      ...estDateNullButCloseDate2025.map(e => e.id),
      ...getFullYearEdgeCases.map(e => e.id)
    ]);
    console.log(`   Combo 5 (all of the above): ${combo5.size} (diff: ${combo5.size - 1839})`);

    // Find the closest match
    const combos = [
      { name: 'Combo 1', count: combo1.size },
      { name: 'Combo 2', count: combo2.size },
      { name: 'Combo 3', count: combo3Count },
      { name: 'Combo 4', count: noDedup.length },
      { name: 'Combo 5', count: combo5.size }
    ];

    const closest = combos.reduce((best, current) => {
      const currentDiff = Math.abs(current.count - 1839);
      const bestDiff = Math.abs(best.count - 1839);
      return currentDiff < bestDiff ? current : best;
    });

    console.log(`\n✅ Closest match: ${closest.name} with ${closest.count} (diff: ${closest.count - 1839})`);

    // If we found an exact match, explain it
    if (closest.count === 1839) {
      console.log(`\n🎉 EXACT MATCH FOUND!`);
      console.log(`   LMN likely uses: ${closest.name}`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

findExact6();

