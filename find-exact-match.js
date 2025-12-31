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

async function findExactMatch() {
  console.log('🔍 Finding exact match for LMN count (1,839 for 2025)...\n');

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

    // Remove duplicates by lmn_estimate_id (keep first occurrence)
    const uniqueEstimates = [];
    const seenLmnIds = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenLmnIds.has(est.lmn_estimate_id)) {
          seenLmnIds.add(est.lmn_estimate_id);
          uniqueEstimates.push(est);
        }
      } else {
        // Estimates without lmn_estimate_id are included
        uniqueEstimates.push(est);
      }
    });

    console.log(`📊 Total estimates: ${allEstimates.length}`);
    console.log(`📊 Unique estimates (by lmn_estimate_id): ${uniqueEstimates.length}`);
    console.log(`📊 Duplicates removed: ${allEstimates.length - uniqueEstimates.length}\n`);

    // Test: estimate_date only, exclude exclude_stats, remove duplicates
    const filtered = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      return new Date(e.estimate_date).getFullYear() === year2025;
    });

    console.log(`📊 Filtered (estimate_date, exclude exclude_stats, unique): ${filtered.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Difference: ${filtered.length - 1839}\n`);

    // If still not matching, check what else might be different
    if (filtered.length !== 1839) {
      console.log(`🔍 Analyzing remaining difference...\n`);
      
      // Check status breakdown
      const statusCounts = {};
      filtered.forEach(e => {
        const status = e.status || 'null';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log(`📊 Status breakdown:`);
      Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });
    } else {
      console.log(`✅ EXACT MATCH FOUND!`);
      console.log(`   Logic: estimate_date only, exclude exclude_stats=true, remove duplicates by lmn_estimate_id`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

findExactMatch();

