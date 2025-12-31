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

async function finalAnalysis() {
  console.log('🔍 Final analysis to match LMN exactly...\n');

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

    // Test different filtering strategies
    const strategies = [];

    // Strategy 1: estimate_date only (string extraction), exclude exclude_stats
    const s1 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    strategies.push({ name: 'estimate_date only (string), exclude exclude_stats', count: s1.length });

    // Strategy 2: estimate_date || estimate_close_date (string extraction), exclude exclude_stats
    const s2 = uniqueEstimates.filter(e => {
      if (e.exclude_stats) return false;
      const date = e.estimate_date || e.estimate_close_date;
      if (!date) return false;
      const year = extractYearFromDateString(date);
      return year === year2025;
    });
    strategies.push({ name: 'estimate_date || estimate_close_date (string), exclude exclude_stats', count: s2.length });

    // Strategy 3: estimate_date only (string extraction), don't exclude exclude_stats
    const s3 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });
    strategies.push({ name: 'estimate_date only (string), include exclude_stats', count: s3.length });

    // Strategy 4: estimate_date || estimate_close_date (string extraction), don't exclude exclude_stats
    const s4 = uniqueEstimates.filter(e => {
      const date = e.estimate_date || e.estimate_close_date;
      if (!date) return false;
      const year = extractYearFromDateString(date);
      return year === year2025;
    });
    strategies.push({ name: 'estimate_date || estimate_close_date (string), include exclude_stats', count: s4.length });

    console.log('📊 Testing different filtering strategies:\n');
    strategies.forEach((s, idx) => {
      const diff = Math.abs(s.count - 1839);
      const marker = diff === 0 ? '✅ EXACT MATCH' : diff < 10 ? '⚠️  Close' : '  ';
      console.log(`${marker} ${idx + 1}. ${s.name}`);
      console.log(`   Count: ${s.count}, Difference: ${diff}\n`);
    });

    // Find the best match
    const bestMatch = strategies.reduce((best, current) => {
      const currentDiff = Math.abs(current.count - 1839);
      const bestDiff = Math.abs(best.count - 1839);
      return currentDiff < bestDiff ? current : best;
    });

    console.log(`\n✅ Best match: "${bestMatch.name}"`);
    console.log(`   Count: ${bestMatch.count}`);
    console.log(`   Difference from LMN: ${bestMatch.count - 1839}`);

    // If we found an exact match, show what it uses
    if (bestMatch.count === 1839) {
      console.log(`\n🎉 FOUND EXACT MATCH!`);
      console.log(`   This strategy uses:`);
      if (bestMatch.name.includes('estimate_date || estimate_close_date')) {
        console.log(`   - estimate_date OR estimate_close_date (whichever exists)`);
      } else {
        console.log(`   - estimate_date only`);
      }
      if (bestMatch.name.includes('exclude exclude_stats')) {
        console.log(`   - Excludes estimates with exclude_stats=true`);
      } else {
        console.log(`   - Includes all estimates (doesn't exclude exclude_stats)`);
      }
      console.log(`   - Removes duplicates by lmn_estimate_id`);
      console.log(`   - Uses string extraction for year (not getFullYear())`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

finalAnalysis();

