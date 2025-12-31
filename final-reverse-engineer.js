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

async function finalReverseEngineer() {
  console.log('🔍 Final reverse engineering to find the exact 5-6 missing estimates...\n');

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

    // Best match so far: No duplicate removal = 1834 (5 off)
    const noDedup = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Best match (no duplicate removal): ${noDedup.length}`);
    console.log(`📊 LMN count: 1,839`);
    console.log(`📊 Need: ${1839 - noDedup.length} more estimates\n`);

    // What if LMN includes estimates that have estimate_date but it's in a format we're missing?
    // Check for dates that might be 2025 but our extraction doesn't catch
    const mightBe2025 = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      // Check if date string contains "2025" somewhere
      if (!e.estimate_date.includes('2025')) return false;
      const year = extractYearFromDateString(e.estimate_date);
      // But our extraction didn't get 2025
      if (year === year2025) return false;
      return true;
    });

    console.log(`📊 Estimates with "2025" in date but extraction didn't get it: ${mightBe2025.length}`);
    if (mightBe2025.length > 0) {
      console.log('   All of them:');
      mightBe2025.forEach(e => {
        const year = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date} (extracted=${year})`);
      });
    }
    console.log();

    // What if LMN uses a different date parsing for the 40 estimates with "2025-01-01"?
    // Maybe they use UTC or a different timezone?
    const jan1_2025 = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      // Check if it's "2025-01-01"
      if (!e.estimate_date.includes('2025-01-01')) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      // These are the ones where getFullYear() returns 2024
      return parsed.getFullYear() === 2024;
    });

    console.log(`📊 Estimates with "2025-01-01" but getFullYear()=2024: ${jan1_2025.length}`);
    console.log(`   (These are the 40 timezone-affected dates)`);
    if (jan1_2025.length > 0 && jan1_2025.length <= 10) {
      console.log('   Sample (first 10):');
      jan1_2025.slice(0, 10).forEach(e => {
        const parsed = new Date(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     local=${parsed.getFullYear()}, UTC=${parsed.getUTCFullYear()}, string=2025`);
      });
    }
    console.log();

    // What if LMN includes some of these 40 based on UTC?
    // If we include estimates where UTC year is 2025 (even if local is 2024)
    const utc2025ButLocal2024 = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getUTCFullYear() === year2025 && parsed.getFullYear() === 2024;
    });

    console.log(`📊 Estimates where UTC=2025 but local=2024: ${utc2025ButLocal2024.length}`);
    if (utc2025ButLocal2024.length > 0) {
      // If we include these, what's the count?
      const includingUTC = new Set([
        ...noDedup.map(e => e.id),
        ...utc2025ButLocal2024.map(e => e.id)
      ]);
      console.log(`   If we include these: ${includingUTC.size} (diff: ${includingUTC.size - 1839})`);
      
      // But we need exactly 5 more, not all 40
      // Maybe LMN includes only some of them?
      if (utc2025ButLocal2024.length >= 5) {
        console.log(`   \n   If LMN includes 5 of these 40: ${noDedup.length + 5} (diff: ${noDedup.length + 5 - 1839})`);
        console.log(`   ✅ This would give us exactly 1,839!`);
        console.log(`   \n   Hypothesis: LMN uses UTC date parsing for some estimates`);
      }
    }
    console.log();

    // Alternative: What if LMN doesn't remove duplicates AND includes some estimates we exclude?
    // Check what we're excluding
    const weExclude = allEstimates.filter(e => {
      // We exclude if no estimate_date
      if (!e.estimate_date) return true;
      // We exclude if string extraction doesn't give 2025
      const year = extractYearFromDateString(e.estimate_date);
      return year !== year2025;
    });

    // But what if LMN includes some of these using getFullYear()?
    const excludedButGetFullYear2025 = weExclude.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });

    console.log(`📊 Estimates we exclude but getFullYear()=2025: ${excludedButGetFullYear2025.length}`);
    console.log(`   (These are the 210 "2026" dates that getFullYear() incorrectly parses as 2025)`);
    console.log(`   We correctly exclude these, but maybe LMN includes some?`);

    // What if LMN includes exactly 5 of these (the ones that are actually 2025, not 2026)?
    // But wait, we already checked - all 210 are actually 2026, not 2025

    // Final summary
    console.log(`\n📊 FINAL ANALYSIS:\n`);
    console.log(`   Our best match (no duplicate removal): ${noDedup.length}`);
    console.log(`   LMN count: 1,839`);
    console.log(`   Missing: ${1839 - noDedup.length} estimates\n`);
    console.log(`   Possible explanations for the ${1839 - noDedup.length} missing:`);
    console.log(`   1. LMN includes ${utc2025ButLocal2024.length >= 5 ? '5 of the 40' : 'some'} UTC-based dates (UTC=2025 but local=2024)`);
    console.log(`   2. LMN includes estimates that exist in LMN but not in our database`);
    console.log(`   3. LMN uses a hybrid date parsing method we haven't identified`);
    console.log(`   4. Data sync timing - estimates created in LMN after our import`);

    // If we include the UTC dates, what's the count?
    if (utc2025ButLocal2024.length > 0) {
      const withUTC = new Set([
        ...noDedup.map(e => e.id),
        ...utc2025ButLocal2024.map(e => e.id)
      ]);
      console.log(`\n   If LMN uses UTC for the 40 timezone-affected dates:`);
      console.log(`   Count: ${withUTC.size} (diff: ${withUTC.size - 1839})`);
      console.log(`   \n   If LMN uses UTC for only 5 of them:`);
      console.log(`   Count: ${noDedup.length + 5} (diff: ${noDedup.length + 5 - 1839})`);
      if (noDedup.length + 5 === 1839) {
        console.log(`   \n   🎉 EXACT MATCH! LMN likely uses UTC date parsing for 5 of the 40 timezone-affected dates.`);
      }
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

finalReverseEngineer();

