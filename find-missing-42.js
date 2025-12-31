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

async function findMissing42() {
  console.log('🔍 Finding the missing 42 estimates...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status, created_date')
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

    // Our current filter (string extraction)
    const ourFiltered = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Our filtered count: ${ourFiltered.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Missing: ${1839 - ourFiltered.length} estimates\n`);

    // Find estimates that might be counted by LMN but not by us
    // 1. Estimates with exclude_stats=false but we're excluding them
    const withExcludeStats = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025 && e.exclude_stats === true;
    });
    console.log(`1. Estimates with exclude_stats=true: ${withExcludeStats.length}`);

    // 2. Estimates without estimate_date but with estimate_close_date in 2025
    const noEstDateButCloseDate = uniqueEstimates.filter(e => {
      if (e.estimate_date) return false;
      if (e.exclude_stats) return false;
      if (!e.estimate_close_date) return false;
      const year = extractYearFromDateString(e.estimate_close_date);
      return year === year2025;
    });
    console.log(`2. Estimates without estimate_date but with estimate_close_date in 2025: ${noEstDateButCloseDate.length}`);
    if (noEstDateButCloseDate.length > 0) {
      console.log('   Sample (first 10):');
      noEstDateButCloseDate.slice(0, 10).forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: close_date=${e.estimate_close_date}`);
      });
    }
    console.log();

    // 3. Estimates with estimate_date that doesn't match 2025 in string but might be counted
    const dateFormatIssues = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      // Check if date string doesn't contain 2025 but might still be 2025
      const yearFromString = extractYearFromDateString(e.estimate_date);
      if (yearFromString === 2025) return false; // Already included
      // Check if it's a date format issue
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      const parsedYear = parsed.getFullYear();
      return parsedYear === 2025 && yearFromString !== 2025;
    });
    console.log(`3. Estimates with date format issues (parsed=2025 but string≠2025): ${dateFormatIssues.length}`);
    if (dateFormatIssues.length > 0) {
      console.log('   Sample (first 10):');
      dateFormatIssues.slice(0, 10).forEach(e => {
        const yearFromString = extractYearFromDateString(e.estimate_date);
        const parsedYear = new Date(e.estimate_date).getFullYear();
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     string extraction=${yearFromString}, parsed=${parsedYear}`);
      });
    }
    console.log();

    // 4. Check if LMN might use created_date instead of estimate_date for some estimates
    const createdDate2025 = uniqueEstimates.filter(e => {
      if (e.exclude_stats) return false;
      if (!e.created_date) return false;
      if (e.estimate_date) return false; // Only if no estimate_date
      const year = extractYearFromDateString(e.created_date);
      return year === 2025;
    });
    console.log(`4. Estimates without estimate_date but created_date in 2025: ${createdDate2025.length}`);
    if (createdDate2025.length > 0) {
      console.log('   Sample (first 10):');
      createdDate2025.slice(0, 10).forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: created_date=${e.created_date}`);
      });
    }
    console.log();

    // 5. Summary of potential missing estimates
    const potentialMissing = [
      ...noEstDateButCloseDate,
      ...dateFormatIssues,
      ...createdDate2025
    ];

    console.log(`📊 Summary of potential missing estimates:`);
    console.log(`   Total potential: ${potentialMissing.length}`);
    console.log(`   We need: ${1839 - ourFiltered.length} more`);
    console.log(`   Difference: ${potentialMissing.length - (1839 - ourFiltered.length)}`);

    // If we add these, what's the count?
    const withPotentialMissing = new Set([
      ...ourFiltered.map(e => e.id),
      ...potentialMissing.map(e => e.id)
    ]);
    console.log(`\n📊 If we include potential missing: ${withPotentialMissing.size}`);
    console.log(`   Still need: ${1839 - withPotentialMissing.size} more`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

findMissing42();

