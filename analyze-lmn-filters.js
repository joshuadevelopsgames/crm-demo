#!/usr/bin/env node

/**
 * Analyze potential filtering differences between LMN and our data
 * LMN's "This year" might use different date logic
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file if it exists
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
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getYearFromDate(dateValue) {
  if (!dateValue) return null;
  const dateStr = String(dateValue);
  if (dateStr.length >= 4) {
    return parseInt(dateStr.substring(0, 4));
  }
  return null;
}

const currentYear = new Date().getFullYear();

async function analyzeFilters() {
  console.log('🔍 Analyzing potential filtering differences...\n');
  console.log(`📅 Current year: ${currentYear}\n`);

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching estimates:', error);
        process.exit(1);
      }

      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Loaded ${allEstimates.length} total estimates\n`);

    // Test different filtering strategies
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 TESTING DIFFERENT FILTERING STRATEGIES:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Strategy 1: Filter by estimate_close_date (our current approach)
    const byCloseDate = allEstimates.filter(est => {
      const year = getYearFromDate(est.estimate_close_date);
      return year === currentYear;
    });

    // Strategy 2: Filter by estimate_date only
    const byEstimateDate = allEstimates.filter(est => {
      const year = getYearFromDate(est.estimate_date);
      return year === currentYear;
    });

    // Strategy 3: Filter by created_at (when imported)
    const byCreatedAt = allEstimates.filter(est => {
      const year = getYearFromDate(est.created_at);
      return year === currentYear;
    });

    // Strategy 4: Filter by estimate_close_date OR estimate_date (our current logic)
    const byCloseOrEstimate = allEstimates.filter(est => {
      let dateToUse = est.estimate_close_date || est.estimate_date;
      if (!dateToUse) return false;
      const year = getYearFromDate(dateToUse);
      return year === currentYear;
    });

    // Strategy 5: Only estimates with close_date (sold estimates only)
    const byCloseDateOnly = allEstimates.filter(est => {
      if (!est.estimate_close_date) return false;
      const year = getYearFromDate(est.estimate_close_date);
      return year === currentYear;
    });

    // Strategy 6: Only estimates with estimate_date (not closed)
    const byEstimateDateOnly = allEstimates.filter(est => {
      if (!est.estimate_date) return false;
      if (est.estimate_close_date) return false; // Exclude if closed
      const year = getYearFromDate(est.estimate_date);
      return year === currentYear;
    });

    console.log('1️⃣  Filter by estimate_close_date only:');
    console.log(`   Count: ${byCloseDate.length}`);
    console.log(`   Sold (won): ${byCloseDate.filter(e => e.status === 'won').length}`);
    console.log(`   Total $: $${(byCloseDate.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) / 1000000).toFixed(2)}M\n`);

    console.log('2️⃣  Filter by estimate_date only:');
    console.log(`   Count: ${byEstimateDate.length}`);
    console.log(`   Sold (won): ${byEstimateDate.filter(e => e.status === 'won').length}`);
    console.log(`   Total $: $${(byEstimateDate.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) / 1000000).toFixed(2)}M\n`);

    console.log('3️⃣  Filter by created_at (import date):');
    console.log(`   Count: ${byCreatedAt.length}`);
    console.log(`   Sold (won): ${byCreatedAt.filter(e => e.status === 'won').length}`);
    console.log(`   Total $: $${(byCreatedAt.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) / 1000000).toFixed(2)}M\n`);

    console.log('4️⃣  Filter by close_date OR estimate_date (our current):');
    console.log(`   Count: ${byCloseOrEstimate.length}`);
    console.log(`   Sold (won): ${byCloseOrEstimate.filter(e => e.status === 'won').length}`);
    console.log(`   Total $: $${(byCloseOrEstimate.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) / 1000000).toFixed(2)}M\n`);

    console.log('5️⃣  Filter by close_date only (sold estimates):');
    console.log(`   Count: ${byCloseDateOnly.length}`);
    console.log(`   Sold (won): ${byCloseDateOnly.filter(e => e.status === 'won').length}`);
    console.log(`   Total $: $${(byCloseDateOnly.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) / 1000000).toFixed(2)}M\n`);

    console.log('6️⃣  Filter by estimate_date only (not closed):');
    console.log(`   Count: ${byEstimateDateOnly.length}`);
    console.log(`   Sold (won): ${byEstimateDateOnly.filter(e => e.status === 'won').length}`);
    console.log(`   Total $: $${(byEstimateDateOnly.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) / 1000000).toFixed(2)}M\n`);

    // LMN values
    const lmnTotal = 1086;
    const lmnSold = 927;
    const lmnDollar = 14900000;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎯 CLOSEST MATCH TO LMN VALUES:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const strategies = [
      { name: 'By close_date only', count: byCloseDate.length, sold: byCloseDate.filter(e => e.status === 'won').length, dollar: byCloseDate.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) },
      { name: 'By estimate_date only', count: byEstimateDate.length, sold: byEstimateDate.filter(e => e.status === 'won').length, dollar: byEstimateDate.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) },
      { name: 'By created_at', count: byCreatedAt.length, sold: byCreatedAt.filter(e => e.status === 'won').length, dollar: byCreatedAt.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) },
      { name: 'By close_date OR estimate_date (current)', count: byCloseOrEstimate.length, sold: byCloseOrEstimate.filter(e => e.status === 'won').length, dollar: byCloseOrEstimate.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) },
      { name: 'By close_date only (sold)', count: byCloseDateOnly.length, sold: byCloseDateOnly.filter(e => e.status === 'won').length, dollar: byCloseDateOnly.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0) },
    ];

    strategies.forEach(strategy => {
      const countDiff = Math.abs(strategy.count - lmnTotal);
      const countPct = (countDiff / lmnTotal * 100).toFixed(1);
      const soldDiff = Math.abs(strategy.sold - lmnSold);
      const soldPct = (soldDiff / lmnSold * 100).toFixed(1);
      const dollarDiff = Math.abs(strategy.dollar - lmnDollar);
      const dollarPct = (dollarDiff / lmnDollar * 100).toFixed(1);
      
      console.log(`${strategy.name}:`);
      console.log(`  Total: ${strategy.count} (diff: ${countDiff}, ${countPct}%)`);
      console.log(`  Sold: ${strategy.sold} (diff: ${soldDiff}, ${soldPct}%)`);
      console.log(`  $: $${(strategy.dollar / 1000000).toFixed(2)}M (diff: $${(dollarDiff / 1000000).toFixed(2)}M, ${dollarPct}%)\n`);
    });

    // Check pipeline_status usage
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 PIPELINE_STATUS ANALYSIS:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const withPipelineStatus = allEstimates.filter(e => e.pipeline_status && e.pipeline_status.trim() !== '').length;
    const withoutPipelineStatus = allEstimates.length - withPipelineStatus;
    
    console.log(`Estimates with pipeline_status: ${withPipelineStatus}`);
    console.log(`Estimates without pipeline_status: ${withoutPipelineStatus}\n`);

    if (withPipelineStatus > 0) {
      const pipelineBreakdown = {};
      allEstimates.filter(e => e.pipeline_status).forEach(e => {
        const status = e.pipeline_status.trim().toLowerCase();
        pipelineBreakdown[status] = (pipelineBreakdown[status] || 0) + 1;
      });
      console.log('Pipeline status distribution:');
      Object.entries(pipelineBreakdown).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    } else {
      console.log('⚠️  No estimates have pipeline_status populated!');
      console.log('   This suggests the import is not reading the "Sales Pipeline Status" column.\n');
    }

    // Check if "Sold" in pipeline_status matches "won" in status
    if (withPipelineStatus > 0) {
      const soldByPipeline = allEstimates.filter(e => 
        e.pipeline_status && e.pipeline_status.trim().toLowerCase() === 'sold'
      );
      const soldByStatus = allEstimates.filter(e => e.status === 'won');
      
      console.log(`\nSold estimates by pipeline_status='Sold': ${soldByPipeline.length}`);
      console.log(`Sold estimates by status='won': ${soldByStatus.length}`);
      
      const both = soldByPipeline.filter(e => e.status === 'won').length;
      const onlyPipeline = soldByPipeline.filter(e => e.status !== 'won').length;
      const onlyStatus = soldByStatus.filter(e => !e.pipeline_status || e.pipeline_status.trim().toLowerCase() !== 'sold').length;
      
      console.log(`  Both match: ${both}`);
      console.log(`  Only pipeline_status='Sold': ${onlyPipeline}`);
      console.log(`  Only status='won': ${onlyStatus}\n`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

analyzeFilters();

