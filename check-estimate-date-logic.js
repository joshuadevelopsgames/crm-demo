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

async function checkEstimateDateLogic() {
  console.log('🔍 Checking which date logic matches LMN (1,839 for 2025)...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_date, estimate_close_date')
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

    // Test different date logic options
    const logic1 = allEstimates.filter(e => {
      // Current logic: estimate_close_date || estimate_date
      const date = e.estimate_close_date || e.estimate_date;
      if (!date) return false;
      return new Date(date).getFullYear() === year2025;
    });

    const logic2 = allEstimates.filter(e => {
      // Prefer estimate_close_date, fallback to estimate_date only if close_date is null
      const date = e.estimate_close_date ? e.estimate_close_date : e.estimate_date;
      if (!date) return false;
      return new Date(date).getFullYear() === year2025;
    });

    const logic3 = allEstimates.filter(e => {
      // Only estimate_close_date
      if (!e.estimate_close_date) return false;
      return new Date(e.estimate_close_date).getFullYear() === year2025;
    });

    const logic4 = allEstimates.filter(e => {
      // Only estimate_date
      if (!e.estimate_date) return false;
      return new Date(e.estimate_date).getFullYear() === year2025;
    });

    console.log(`📊 Testing different date logic for 2025:`);
    console.log(`   1. estimate_close_date || estimate_date: ${logic1.length} (current - WRONG)`);
    console.log(`   2. estimate_close_date ?? estimate_date: ${logic2.length}`);
    console.log(`   3. estimate_close_date only: ${logic3.length}`);
    console.log(`   4. estimate_date only: ${logic4.length}`);
    console.log(`   Expected (LMN): 1,839\n`);

    // Find estimates that are included in logic1 but not in logic2
    const logic1Ids = new Set(logic1.map(e => e.id));
    const logic2Ids = new Set(logic2.map(e => e.id));
    const extraInLogic1 = logic1.filter(e => !logic2Ids.has(e.id));
    
    if (extraInLogic1.length > 0) {
      console.log(`📋 Estimates included in logic1 but not logic2 (${extraInLogic1.length}):`);
      extraInLogic1.slice(0, 10).forEach(e => {
        const closeYear = e.estimate_close_date ? new Date(e.estimate_close_date).getFullYear() : null;
        const estYear = e.estimate_date ? new Date(e.estimate_date).getFullYear() : null;
        console.log(`   - ${e.lmn_estimate_id || e.id}: close_date=${e.estimate_close_date} (${closeYear}), estimate_date=${e.estimate_date} (${estYear})`);
      });
      if (extraInLogic1.length > 10) {
        console.log(`   ... and ${extraInLogic1.length - 10} more`);
      }
      console.log();
    }

    // Check which logic is closest to 1839
    const diffs = [
      { name: 'estimate_close_date || estimate_date', count: logic1.length, diff: Math.abs(logic1.length - 1839) },
      { name: 'estimate_close_date ?? estimate_date', count: logic2.length, diff: Math.abs(logic2.length - 1839) },
      { name: 'estimate_close_date only', count: logic3.length, diff: Math.abs(logic3.length - 1839) },
      { name: 'estimate_date only', count: logic4.length, diff: Math.abs(logic4.length - 1839) }
    ];

    diffs.sort((a, b) => a.diff - b.diff);
    console.log(`📊 Closest match to 1,839:`);
    diffs.forEach((logic, idx) => {
      const marker = idx === 0 ? '✅' : '  ';
      console.log(`   ${marker} ${logic.name}: ${logic.count} (diff: ${logic.diff})`);
    });

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

checkEstimateDateLogic();

