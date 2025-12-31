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

async function deepReverseEngineer() {
  console.log('🔍 Deep reverse engineering the 6 estimate difference...\n');

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

    // Our strategy: keep first occurrence
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

    console.log(`📊 Our count: ${ourFiltered.length}`);
    console.log(`📊 LMN count: 1,839`);
    console.log(`📊 Missing: ${1839 - ourFiltered.length} estimates\n`);

    // Check if LMN might keep a different duplicate (one with 2025 date)
    console.log('🔍 Checking duplicate removal strategies...\n');

    const duplicatesWith2025 = actualDuplicates.filter(([id, ests]) => {
      return ests.some(e => {
        if (!e.estimate_date) return false;
        const year = extractYearFromDateString(e.estimate_date);
        return year === year2025;
      });
    });

    console.log(`📊 Duplicates where at least one has estimate_date in 2025: ${duplicatesWith2025.length}`);

    if (duplicatesWith2025.length > 0) {
      console.log('   Checking if we kept the wrong one...\n');
      let switchedCount = 0;
      const switchedEstimates = [];

      duplicatesWith2025.forEach(([lmnId, duplicates]) => {
        const kept = ourUnique.find(e => e.lmn_estimate_id === lmnId);
        const keptYear = kept?.estimate_date ? extractYearFromDateString(kept.estimate_date) : null;
        
        // Find one with 2025 date
        const with2025 = duplicates.find(e => {
          if (!e.estimate_date) return false;
          const year = extractYearFromDateString(e.estimate_date);
          return year === year2025;
        });

        if (keptYear !== year2025 && with2025) {
          switchedCount++;
          switchedEstimates.push({ lmnId, kept, with2025 });
        }
      });

      console.log(`   Duplicates where we kept non-2025 but 2025 exists: ${switchedCount}`);
      if (switchedCount > 0) {
        console.log('   Sample (first 10):');
        switchedEstimates.slice(0, 10).forEach(({ lmnId, kept, with2025 }) => {
          const keptYear = kept?.estimate_date ? extractYearFromDateString(kept.estimate_date) : null;
          console.log(`   - ${lmnId}:`);
          console.log(`     Kept: ${kept.id} (year=${keptYear}, exclude_stats=${kept.exclude_stats})`);
          console.log(`     Should keep: ${with2025.id} (year=2025, exclude_stats=${with2025.exclude_stats})`);
        });

        // If we switch to keeping the 2025 one, what's the count?
        const switchedUnique = [];
        const switchedSeen = new Set();
        allEstimates.forEach(est => {
          if (est.lmn_estimate_id) {
            if (!switchedSeen.has(est.lmn_estimate_id)) {
              // Check if this is a duplicate where we should keep the 2025 one
              const switched = switchedEstimates.find(s => s.lmnId === est.lmn_estimate_id);
              if (switched && est.id === switched.with2025.id) {
                switchedSeen.add(est.lmn_estimate_id);
                switchedUnique.push(est);
              } else if (!switched) {
                switchedSeen.add(est.lmn_estimate_id);
                switchedUnique.push(est);
              }
            } else if (switchedEstimates.find(s => s.lmnId === est.lmn_estimate_id && est.id === switchedEstimates.find(s => s.lmnId === est.lmn_estimate_id).with2025.id)) {
              // Replace the kept one with the 2025 one
              const index = switchedUnique.findIndex(e => e.lmn_estimate_id === est.lmn_estimate_id);
              if (index >= 0) {
                switchedUnique[index] = est;
              }
            }
          } else {
            switchedUnique.push(est);
          }
        });

        const switchedFiltered = switchedUnique.filter(e => {
          if (!e.estimate_date) return false;
          const year = extractYearFromDateString(e.estimate_date);
          return year === year2025;
        });

        console.log(`\n   If we keep 2025 duplicates instead: ${switchedFiltered.length} (diff: ${switchedFiltered.length - 1839})`);
      }
    }
    console.log();

    // Check for estimates that might be counted by LMN using different date logic
    // What if LMN uses getFullYear() for dates that our string extraction doesn't catch?
    const stringExtractionMisses = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      const stringYear = extractYearFromDateString(e.estimate_date);
      // If string extraction returns null or wrong year, but getFullYear() works
      if (stringYear === null) {
        const parsed = new Date(e.estimate_date);
        if (isNaN(parsed.getTime())) return false;
        return parsed.getFullYear() === year2025;
      }
      return false;
    });

    console.log(`📊 Estimates where string extraction fails but getFullYear()=2025: ${stringExtractionMisses.length}`);
    if (stringExtractionMisses.length > 0 && stringExtractionMisses.length <= 20) {
      console.log('   Sample:');
      stringExtractionMisses.slice(0, 20).forEach(e => {
        const parsed = new Date(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=null, parsed=${parsed.getFullYear()}`);
      });
    }
    console.log();

    // Check if there are estimates with dates in formats our regex doesn't catch
    const unusualDateFormats = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      // Check if date string doesn't match our regex pattern
      const hasYearMatch = /\b(20[0-9]{2})\b/.test(e.estimate_date);
      if (hasYearMatch) return false;
      // But can still be parsed
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });

    console.log(`📊 Estimates with unusual date formats (regex doesn't match): ${unusualDateFormats.length}`);
    if (unusualDateFormats.length > 0 && unusualDateFormats.length <= 20) {
      console.log('   Sample:');
      unusualDateFormats.slice(0, 20).forEach(e => {
        const parsed = new Date(e.estimate_date);
        const stringYear = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string=${stringYear}, parsed=${parsed.getFullYear()}`);
      });
    }
    console.log();

    // Final attempt: What if we're missing estimates that were just added?
    // Check estimates created/updated very recently
    const recentEstimates = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      if (year !== year2025) return false;
      // Check if created or updated in last 24 hours
      if (e.created_at) {
        const created = new Date(e.created_at);
        const hoursAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 24) return true;
      }
      if (e.updated_at) {
        const updated = new Date(e.updated_at);
        const hoursAgo = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 24) return true;
      }
      return false;
    });

    console.log(`📊 Estimates with 2025 date created/updated in last 24 hours: ${recentEstimates.length}`);
    console.log(`   (These might be the ones LMN has but we just imported)`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

deepReverseEngineer();

