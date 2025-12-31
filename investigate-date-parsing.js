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

async function investigateDateParsing() {
  console.log('🔍 Investigating date parsing issues...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date')
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

    // Find estimates where date string contains 2026 but parses to 2025
    const dateIssues = [];
    uniqueEstimates.forEach(e => {
      if (!e.estimate_date) return;
      const dateStr = e.estimate_date;
      const parsed = new Date(dateStr);
      const parsedYear = parsed.getFullYear();
      
      // Check if date string contains 2026 but parses to 2025
      if (dateStr.includes('2026') && parsedYear === 2025) {
        dateIssues.push({
          est: e,
          dateStr,
          parsedYear,
          parsedDate: parsed.toISOString()
        });
      }
    });

    console.log(`📊 Found ${dateIssues.length} estimates with date parsing issues\n`);

    // Analyze these dates more carefully
    console.log('📋 Sample of problematic dates (first 20):');
    dateIssues.slice(0, 20).forEach(issue => {
      console.log(`   ${issue.est.lmn_estimate_id || issue.est.estimate_number || issue.est.id}:`);
      console.log(`      Date string: ${issue.dateStr}`);
      console.log(`      Parsed year: ${issue.parsedYear}`);
      console.log(`      Parsed date: ${issue.parsedDate}`);
      console.log();
    });

    // Check if these are actually 2026 dates that shouldn't be included
    const actually2026 = dateIssues.filter(issue => {
      // Extract year from date string
      const yearMatch = issue.dateStr.match(/202[0-9]/);
      if (yearMatch) {
        const yearFromString = parseInt(yearMatch[0]);
        return yearFromString === 2026;
      }
      return false;
    });

    console.log(`\n📊 Analysis:`);
    console.log(`   Total date issues: ${dateIssues.length}`);
    console.log(`   Actually 2026 dates (should be excluded): ${actually2026.length}`);

    // Check what happens if we exclude these
    const year2025 = 2025;
    const filtered = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      
      // Extract year from date string directly (more reliable)
      const yearMatch = e.estimate_date.match(/202[0-9]/);
      if (yearMatch) {
        const yearFromString = parseInt(yearMatch[0]);
        return yearFromString === year2025;
      }
      
      // Fallback to parsing
      const parsedYear = new Date(e.estimate_date).getFullYear();
      return parsedYear === year2025;
    });

    console.log(`   Filtered count (using string extraction): ${filtered.length}`);
    console.log(`   Expected (LMN): 1,839`);
    console.log(`   Difference: ${filtered.length - 1839}`);

    // Also check for 2024 dates that might be incorrectly included
    const date2024 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      const yearMatch = e.estimate_date.match(/202[0-9]/);
      if (yearMatch) {
        const yearFromString = parseInt(yearMatch[0]);
        return yearFromString === 2024;
      }
      return false;
    });

    console.log(`\n📊 Estimates with 2024 in date string: ${date2024.length}`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

investigateDateParsing();

