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

async function checkExclusionCriteria() {
  console.log('🔍 Checking if LMN excludes estimates by status or other criteria...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, exclude_stats, status, pipeline_status, estimate_type, archived')
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

    // Base filter: estimate_date in 2025 (string extraction), include exclude_stats
    const baseFilter = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Base filter (estimate_date=2025, include exclude_stats): ${baseFilter.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Difference: ${baseFilter.length - 1839}\n`);

    // Test different exclusion criteria
    const tests = [];

    // Test 1: Exclude archived
    const test1 = baseFilter.filter(e => !e.archived);
    tests.push({ name: 'Exclude archived', count: test1.length, diff: Math.abs(test1.length - 1839) });

    // Test 2: Exclude specific statuses
    const test2 = baseFilter.filter(e => {
      const status = (e.status || '').toLowerCase();
      return status !== 'draft' && status !== 'cancelled' && status !== 'void';
    });
    tests.push({ name: 'Exclude draft/cancelled/void', count: test2.length, diff: Math.abs(test2.length - 1839) });

    // Test 3: Exclude null/empty status
    const test3 = baseFilter.filter(e => e.status && e.status.trim() !== '');
    tests.push({ name: 'Exclude null/empty status', count: test3.length, diff: Math.abs(test3.length - 1839) });

    // Test 4: Exclude specific pipeline_status
    const test4 = baseFilter.filter(e => {
      const pipelineStatus = (e.pipeline_status || '').toLowerCase();
      return pipelineStatus !== 'cancelled' && pipelineStatus !== 'void';
    });
    tests.push({ name: 'Exclude cancelled/void pipeline_status', count: test4.length, diff: Math.abs(test4.length - 1839) });

    // Test 5: Exclude specific estimate_type
    const test5 = baseFilter.filter(e => {
      const estType = (e.estimate_type || '').toLowerCase();
      return estType !== 'draft' && estType !== 'template';
    });
    tests.push({ name: 'Exclude draft/template estimate_type', count: test5.length, diff: Math.abs(test5.length - 1839) });

    // Test 6: Only include won/lost/pending
    const test6 = baseFilter.filter(e => {
      const status = (e.status || '').toLowerCase();
      return status === 'won' || status === 'lost' || status === 'pending';
    });
    tests.push({ name: 'Only won/lost/pending status', count: test6.length, diff: Math.abs(test6.length - 1839) });

    // Test 7: Exclude estimates without estimate_number
    const test7 = baseFilter.filter(e => e.estimate_number && e.estimate_number.trim() !== '');
    tests.push({ name: 'Exclude without estimate_number', count: test7.length, diff: Math.abs(test7.length - 1839) });

    // Test 8: Exclude estimates without lmn_estimate_id
    const test8 = baseFilter.filter(e => e.lmn_estimate_id);
    tests.push({ name: 'Exclude without lmn_estimate_id', count: test8.length, diff: Math.abs(test8.length - 1839) });

    console.log('📊 Testing exclusion criteria:\n');
    tests.forEach((test, idx) => {
      const marker = test.diff === 0 ? '✅ EXACT MATCH' : test.diff < 5 ? '⚠️  Very close' : test.diff < 10 ? '⚠️  Close' : '  ';
      console.log(`${marker} ${idx + 1}. ${test.name}`);
      console.log(`   Count: ${test.count}, Difference: ${test.diff}\n`);
    });

    // Find the best match
    const bestMatch = tests.reduce((best, current) => {
      return current.diff < best.diff ? current : best;
    });

    if (bestMatch.diff === 0) {
      console.log(`\n🎉 FOUND EXACT MATCH!`);
      console.log(`   Criteria: ${bestMatch.name}`);
      console.log(`   Count: ${bestMatch.count}`);
    } else {
      console.log(`\n✅ Best match: "${bestMatch.name}"`);
      console.log(`   Count: ${bestMatch.count}`);
      console.log(`   Difference: ${bestMatch.diff}`);
    }

    // Show breakdown of what's being excluded
    if (bestMatch.diff < 10) {
      console.log(`\n📊 Breakdown of exclusions for best match:`);
      const excluded = baseFilter.filter(e => {
        if (bestMatch.name.includes('archived')) return e.archived;
        if (bestMatch.name.includes('draft/cancelled/void')) {
          const status = (e.status || '').toLowerCase();
          return status === 'draft' || status === 'cancelled' || status === 'void';
        }
        if (bestMatch.name.includes('null/empty status')) return !e.status || e.status.trim() === '';
        if (bestMatch.name.includes('pipeline_status')) {
          const pipelineStatus = (e.pipeline_status || '').toLowerCase();
          return pipelineStatus === 'cancelled' || pipelineStatus === 'void';
        }
        if (bestMatch.name.includes('estimate_type')) {
          const estType = (e.estimate_type || '').toLowerCase();
          return estType === 'draft' || estType === 'template';
        }
        if (bestMatch.name.includes('won/lost/pending')) {
          const status = (e.status || '').toLowerCase();
          return status !== 'won' && status !== 'lost' && status !== 'pending';
        }
        if (bestMatch.name.includes('estimate_number')) return !e.estimate_number || e.estimate_number.trim() === '';
        if (bestMatch.name.includes('lmn_estimate_id')) return !e.lmn_estimate_id;
        return false;
      });

      console.log(`   Excluded: ${excluded.length} estimates`);
      if (excluded.length > 0 && excluded.length <= 20) {
        excluded.forEach(e => {
          console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: status=${e.status}, archived=${e.archived}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkExclusionCriteria();

