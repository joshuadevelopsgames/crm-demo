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

async function finalInvestigation() {
  console.log('🔍 Final investigation: What if LMN uses getFullYear() but excludes some?\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status')
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

    // Strategy: Use getFullYear() (includes the 210 "2026" dates that parse to 2025)
    // Then exclude some to get to 1839
    const usingGetFullYear = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });

    console.log(`📊 Using getFullYear() (includes timezone-affected dates): ${usingGetFullYear.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Difference: ${usingGetFullYear.length - 1839}\n`);

    if (usingGetFullYear.length > 1839) {
      const excess = usingGetFullYear.length - 1839;
      console.log(`📊 Need to exclude ${excess} estimates to get to 1,839\n`);

      // Find the 210 estimates with "2026" dates that getFullYear() incorrectly includes
      const false2025s = usingGetFullYear.filter(e => {
        const yearFromString = extractYearFromDateString(e.estimate_date);
        return yearFromString === 2026; // These are actually 2026
      });

      console.log(`📊 Estimates with "2026" in date but getFullYear()=2025: ${false2025s.length}`);
      
      // If we exclude these, what's the count?
      const excludingFalse2025s = usingGetFullYear.filter(e => {
        const yearFromString = extractYearFromDateString(e.estimate_date);
        return yearFromString !== 2026;
      });
      
      console.log(`📊 After excluding false 2025s: ${excludingFalse2025s.length}`);
      console.log(`📊 Still need to exclude: ${1839 - excludingFalse2025s.length} more\n`);

      // Check what else might need to be excluded
      const stillNeedToExclude = 1839 - excludingFalse2025s.length;
      if (stillNeedToExclude > 0) {
        console.log(`📊 Need to find ${stillNeedToExclude} more estimates to exclude...\n`);
        
        // Maybe exclude exclude_stats?
        const excludingExcludeStats = excludingFalse2025s.filter(e => !e.exclude_stats);
        console.log(`   Excluding exclude_stats=true: ${excludingExcludeStats.length} (diff: ${excludingExcludeStats.length - 1839})`);
        
        // Maybe exclude specific statuses?
        const excludingDraft = excludingFalse2025s.filter(e => {
          const status = (e.status || '').toLowerCase();
          return status !== 'draft';
        });
        console.log(`   Excluding draft status: ${excludingDraft.length} (diff: ${excludingDraft.length - 1839})`);
      }
    } else if (usingGetFullYear.length < 1839) {
      const short = 1839 - usingGetFullYear.length;
      console.log(`📊 Need to include ${short} more estimates\n`);
      
      // Maybe include estimates without estimate_date but with estimate_close_date?
      const noEstDateButCloseDate = uniqueEstimates.filter(e => {
        if (e.estimate_date) return false;
        if (!e.estimate_close_date) return false;
        const parsed = new Date(e.estimate_close_date);
        if (isNaN(parsed.getTime())) return false;
        return parsed.getFullYear() === year2025;
      });
      console.log(`📊 Estimates without estimate_date but estimate_close_date in 2025: ${noEstDateButCloseDate.length}`);
      
      const includingCloseDate = usingGetFullYear.length + noEstDateButCloseDate.length;
      console.log(`📊 Including those: ${includingCloseDate} (diff: ${includingCloseDate - 1839})`);
    }

    // Summary: Compare all methods
    console.log(`\n📊 Summary of all methods:\n`);
    
    const method1 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    console.log(`1. String extraction, include exclude_stats: ${method1.length} (diff: ${method1.length - 1839})`);

    const method2 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    console.log(`2. String extraction, exclude exclude_stats: ${method2.length} (diff: ${method2.length - 1839})`);

    const method3 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });
    console.log(`3. getFullYear(), include exclude_stats: ${method3.length} (diff: ${method3.length - 1839})`);

    const method4 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });
    console.log(`4. getFullYear(), exclude exclude_stats: ${method4.length} (diff: ${method4.length - 1839})`);

    const method5 = uniqueEstimates.filter(e => {
      const date = e.estimate_date || e.estimate_close_date;
      if (!date) return false;
      const year = extractYearFromDateString(date);
      return year === year2025;
    });
    console.log(`5. estimate_date || estimate_close_date (string), include exclude_stats: ${method5.length} (diff: ${method5.length - 1839})`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

finalInvestigation();

