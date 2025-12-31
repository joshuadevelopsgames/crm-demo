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

async function checkGetFullYearExclusions() {
  console.log('🔍 What if LMN uses getFullYear() and excludes specific estimates?\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, exclude_stats, status, pipeline_status, estimate_type, archived')
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

    // Remove duplicates (keep first)
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

    // Using getFullYear() (includes false 2025s)
    const usingGetFullYear = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });

    console.log(`📊 Using getFullYear(): ${usingGetFullYear.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Need to exclude: ${usingGetFullYear.length - 1839} estimates\n`);

    // Find the false 2025s (actually 2026)
    const false2025s = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      return yearFromString === 2026;
    });

    console.log(`📊 False 2025s (actually 2026): ${false2025s.length}`);

    // If we exclude false 2025s
    const excludingFalse2025s = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      return yearFromString !== 2026;
    });

    console.log(`📊 After excluding false 2025s: ${excludingFalse2025s.length}`);
    console.log(`📊 Still need to exclude: ${excludingFalse2025s.length - 1839} more\n`);

    // Try different combinations of exclusions to get exactly 1839
    const tests = [];

    // Test 1: Exclude false 2025s + exclude_stats
    const test1 = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      if (yearFromString === 2026) return false;
      if (e.exclude_stats) return false;
      return true;
    });
    tests.push({ name: 'Exclude false 2025s + exclude_stats', count: test1.length, exclusions: ['false2025s', 'exclude_stats'] });

    // Test 2: Exclude false 2025s + draft status
    const test2 = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      if (yearFromString === 2026) return false;
      const status = (e.status || '').toLowerCase();
      if (status === 'draft') return false;
      return true;
    });
    tests.push({ name: 'Exclude false 2025s + draft status', count: test2.length, exclusions: ['false2025s', 'draft'] });

    // Test 3: Exclude false 2025s + archived
    const test3 = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      if (yearFromString === 2026) return false;
      if (e.archived) return false;
      return true;
    });
    tests.push({ name: 'Exclude false 2025s + archived', count: test3.length, exclusions: ['false2025s', 'archived'] });

    // Test 4: Exclude false 2025s + null status
    const test4 = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      if (yearFromString === 2026) return false;
      if (!e.status || e.status.trim() === '') return false;
      return true;
    });
    tests.push({ name: 'Exclude false 2025s + null status', count: test4.length, exclusions: ['false2025s', 'null_status'] });

    // Test 5: Exclude false 2025s + exclude_stats + draft
    const test5 = usingGetFullYear.filter(e => {
      const yearFromString = extractYearFromDateString(e.estimate_date);
      if (yearFromString === 2026) return false;
      if (e.exclude_stats) return false;
      const status = (e.status || '').toLowerCase();
      if (status === 'draft') return false;
      return true;
    });
    tests.push({ name: 'Exclude false 2025s + exclude_stats + draft', count: test5.length, exclusions: ['false2025s', 'exclude_stats', 'draft'] });

    // Test 6: Exclude exactly 161 estimates (the difference)
    // Try to find which 161 to exclude
    const needToExclude = usingGetFullYear.length - 1839;
    console.log(`📊 Need to exclude exactly ${needToExclude} estimates\n`);

    // Find candidates for exclusion
    const excludeCandidates = {
      false2025s: false2025s.length,
      exclude_stats: usingGetFullYear.filter(e => e.exclude_stats).length,
      draft: usingGetFullYear.filter(e => (e.status || '').toLowerCase() === 'draft').length,
      archived: usingGetFullYear.filter(e => e.archived).length,
      null_status: usingGetFullYear.filter(e => !e.status || e.status.trim() === '').length,
    };

    console.log(`📊 Exclusion candidates:`);
    Object.entries(excludeCandidates).forEach(([key, count]) => {
      console.log(`   - ${key}: ${count} estimates`);
    });
    console.log();

    console.log(`📊 Testing exclusion combinations:\n`);
    tests.forEach((test, idx) => {
      const diff = Math.abs(test.count - 1839);
      const marker = diff === 0 ? '✅ EXACT MATCH' : diff < 5 ? '⚠️  Very close' : diff < 10 ? '⚠️  Close' : '  ';
      console.log(`${marker} ${idx + 1}. ${test.name}`);
      console.log(`   Count: ${test.count}, Difference: ${diff}\n`);
    });

    // If we found an exact match, show what was excluded
    const exactMatch = tests.find(t => t.count === 1839);
    if (exactMatch) {
      console.log(`\n🎉 FOUND EXACT MATCH!`);
      console.log(`   Strategy: ${exactMatch.name}`);
      console.log(`   Exclusions: ${exactMatch.exclusions.join(', ')}`);
    } else {
      // Find closest match
      const closest = tests.reduce((best, current) => {
        return Math.abs(current.count - 1839) < Math.abs(best.count - 1839) ? current : best;
      });
      console.log(`\n✅ Closest match: "${closest.name}"`);
      console.log(`   Count: ${closest.count}, Difference: ${closest.count - 1839}`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkGetFullYearExclusions();

