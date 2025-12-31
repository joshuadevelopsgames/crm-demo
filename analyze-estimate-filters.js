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

async function analyzeEstimateFilters() {
  console.log('🔍 Analyzing which filters might match LMN (1,839 for 2025)...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_date, estimate_close_date, status, archived, exclude_stats')
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

    // Base filter: estimate_date only (closest match)
    const baseFilter = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      return new Date(e.estimate_date).getFullYear() === year2025;
    });

    console.log(`📊 Base filter (estimate_date only): ${baseFilter.length}\n`);

    // Test various exclusion filters
    const filters = [
      {
        name: 'No exclusions',
        filter: baseFilter
      },
      {
        name: 'Exclude archived',
        filter: baseFilter.filter(e => !e.archived)
      },
      {
        name: 'Exclude exclude_stats=true',
        filter: baseFilter.filter(e => !e.exclude_stats)
      },
      {
        name: 'Exclude archived AND exclude_stats',
        filter: baseFilter.filter(e => !e.archived && !e.exclude_stats)
      },
      {
        name: 'Exclude null/empty status',
        filter: baseFilter.filter(e => e.status && e.status.trim() !== '')
      },
      {
        name: 'Exclude archived + exclude_stats + valid status',
        filter: baseFilter.filter(e => !e.archived && !e.exclude_stats && e.status && e.status.trim() !== '')
      }
    ];

    console.log(`📊 Testing exclusion filters:`);
    filters.forEach(f => {
      const diff = Math.abs(f.filter.length - 1839);
      const marker = diff < 10 ? '✅' : diff < 50 ? '⚠️' : '  ';
      console.log(`   ${marker} ${f.name}: ${f.filter.length} (diff: ${diff})`);
    });

    // Find the best match
    const bestMatch = filters.reduce((best, current) => {
      const currentDiff = Math.abs(current.filter.length - 1839);
      const bestDiff = Math.abs(best.filter.length - 1839);
      return currentDiff < bestDiff ? current : best;
    });

    console.log(`\n✅ Best match: "${bestMatch.name}" with ${bestMatch.filter.length} estimates (diff: ${Math.abs(bestMatch.filter.length - 1839)})`);

    // Show breakdown of exclusions
    const archived = baseFilter.filter(e => e.archived).length;
    const excludeStats = baseFilter.filter(e => e.exclude_stats).length;
    const noStatus = baseFilter.filter(e => !e.status || e.status.trim() === '').length;

    console.log(`\n📊 Breakdown of exclusions from base (${baseFilter.length}):`);
    console.log(`   - Archived: ${archived}`);
    console.log(`   - exclude_stats=true: ${excludeStats}`);
    console.log(`   - No status: ${noStatus}`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

analyzeEstimateFilters();

