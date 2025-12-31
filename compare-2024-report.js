#!/usr/bin/env node

/**
 * Compare our 2024 data with LMN's 2024 Sales Overview report
 * This will help validate our understanding of their filtering logic
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

async function compare2024Report() {
  console.log('📊 Comparing our 2024 data with LMN\'s 2024 Sales Overview\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // LMN's 2024 values from the screenshot
  const lmn2024 = {
    estimatesSold: 577,
    totalEstimates: 591,
    dollarSold: 6580000, // $6.58M
    totalEstimatedDollar: 7000000, // $7.0M
    grossProfitSold: 12.4, // 12.4%
    grossProfitEstimated: 12.9, // 12.9%
    revPerHourSold: 539, // $539
    revPerHourEstimated: 530 // $530
  };

  console.log('LMN\'s 2024 Sales Overview:');
  console.log(`  Total Estimates: ${lmn2024.totalEstimates}`);
  console.log(`  Estimates Sold: ${lmn2024.estimatesSold} (${((lmn2024.estimatesSold / lmn2024.totalEstimates) * 100).toFixed(0)}%)`);
  console.log(`  $ of Estimates Sold: $${(lmn2024.dollarSold / 1000000).toFixed(2)}M`);
  console.log(`  Total Estimated $: $${(lmn2024.totalEstimatedDollar / 1000000).toFixed(2)}M`);
  console.log(`  Gross Profit Sold: ${lmn2024.grossProfitSold}%`);
  console.log(`  Gross Profit Estimated: ${lmn2024.grossProfitEstimated}%`);
  console.log(`  Rev/Hr Sold: $${lmn2024.revPerHourSold}`);
  console.log(`  Rev/Hr Estimated: $${lmn2024.revPerHourEstimated}\n`);

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

    // ============================================
    // TEST DIFFERENT FILTERING STRATEGIES FOR 2024
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 Testing Different Filtering Strategies for 2024:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Strategy 1: Filter by estimate_close_date only (LMN's likely approach)
    const byCloseDate2024 = allEstimates.filter(e => {
      const closeYear = getYearFromDate(e.estimate_close_date);
      return closeYear === 2024;
    });

    const wonByCloseDate2024 = byCloseDate2024.filter(e => e.status === 'won');
    const lostByCloseDate2024 = byCloseDate2024.filter(e => e.status === 'lost');

    const dollarSoldCloseDate = wonByCloseDate2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const totalDollarCloseDate = byCloseDate2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);

    console.log('1️⃣  Filter by estimate_close_date only (2024):');
    console.log(`   Total Estimates: ${byCloseDate2024.length}`);
    console.log(`   Estimates Sold (won): ${wonByCloseDate2024.length}`);
    console.log(`   Estimates Lost: ${lostByCloseDate2024.length}`);
    console.log(`   $ of Estimates Sold: $${(dollarSoldCloseDate / 1000000).toFixed(2)}M`);
    console.log(`   Total Estimated $: $${(totalDollarCloseDate / 1000000).toFixed(2)}M`);
    console.log(`   Difference from LMN: ${byCloseDate2024.length - lmn2024.totalEstimates} estimates, $${((totalDollarCloseDate - lmn2024.totalEstimatedDollar) / 1000000).toFixed(2)}M\n`);

    // Strategy 2: Filter by estimate_date only
    const byEstimateDate2024 = allEstimates.filter(e => {
      const estYear = getYearFromDate(e.estimate_date);
      return estYear === 2024;
    });

    const wonByEstimateDate2024 = byEstimateDate2024.filter(e => e.status === 'won');
    const dollarSoldEstimateDate = wonByEstimateDate2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const totalDollarEstimateDate = byEstimateDate2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);

    console.log('2️⃣  Filter by estimate_date only (2024):');
    console.log(`   Total Estimates: ${byEstimateDate2024.length}`);
    console.log(`   Estimates Sold (won): ${wonByEstimateDate2024.length}`);
    console.log(`   $ of Estimates Sold: $${(dollarSoldEstimateDate / 1000000).toFixed(2)}M`);
    console.log(`   Total Estimated $: $${(totalDollarEstimateDate / 1000000).toFixed(2)}M`);
    console.log(`   Difference from LMN: ${byEstimateDate2024.length - lmn2024.totalEstimates} estimates, $${((totalDollarEstimateDate - lmn2024.totalEstimatedDollar) / 1000000).toFixed(2)}M\n`);

    // Strategy 3: Filter by close_date OR estimate_date (our current approach)
    const byCloseOrEstimate2024 = allEstimates.filter(e => {
      let dateToUse = e.estimate_close_date || e.estimate_date;
      if (!dateToUse) return false;
      const year = getYearFromDate(dateToUse);
      return year === 2024;
    });

    const wonByCloseOrEstimate2024 = byCloseOrEstimate2024.filter(e => e.status === 'won');
    const dollarSoldCloseOrEstimate = wonByCloseOrEstimate2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const totalDollarCloseOrEstimate = byCloseOrEstimate2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);

    console.log('3️⃣  Filter by close_date OR estimate_date (our current, 2024):');
    console.log(`   Total Estimates: ${byCloseOrEstimate2024.length}`);
    console.log(`   Estimates Sold (won): ${wonByCloseOrEstimate2024.length}`);
    console.log(`   $ of Estimates Sold: $${(dollarSoldCloseOrEstimate / 1000000).toFixed(2)}M`);
    console.log(`   Total Estimated $: $${(totalDollarCloseOrEstimate / 1000000).toFixed(2)}M`);
    console.log(`   Difference from LMN: ${byCloseOrEstimate2024.length - lmn2024.totalEstimates} estimates, $${((totalDollarCloseOrEstimate - lmn2024.totalEstimatedDollar) / 1000000).toFixed(2)}M\n`);

    // ============================================
    // CALCULATE GROSS PROFIT AND REV/HR
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💰 Calculating Gross Profit and Rev/Hr for 2024:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Using Strategy 1 (close_date only) - closest match
    const soldTotalCost = wonByCloseDate2024.reduce((s, e) => s + (parseFloat(e.total_cost || 0)), 0);
    const soldTotalPrice = wonByCloseDate2024.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);
    const grossProfitSold = soldTotalPrice > 0 
      ? ((soldTotalPrice - soldTotalCost) / soldTotalPrice * 100) 
      : 0;

    const estimatedTotalCost = byCloseDate2024.reduce((s, e) => s + (parseFloat(e.total_cost || 0)), 0);
    const estimatedTotalPrice = byCloseDate2024.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);
    const grossProfitEstimated = estimatedTotalPrice > 0
      ? ((estimatedTotalPrice - estimatedTotalCost) / estimatedTotalPrice * 100)
      : 0;

    const soldLaborHours = wonByCloseDate2024.reduce((s, e) => s + (parseFloat(e.labor_hours || 0)), 0);
    const revPerHourSold = soldLaborHours > 0 
      ? (soldTotalPrice / soldLaborHours) 
      : 0;

    const estimatedLaborHours = byCloseDate2024.reduce((s, e) => s + (parseFloat(e.labor_hours || 0)), 0);
    const revPerHourEstimated = estimatedLaborHours > 0
      ? (estimatedTotalPrice / estimatedLaborHours)
      : 0;

    console.log('Using Strategy 1 (close_date only):\n');
    console.log(`  Gross Profit Sold: ${grossProfitSold.toFixed(1)}% (LMN: ${lmn2024.grossProfitSold}%)`);
    console.log(`  Gross Profit Estimated: ${grossProfitEstimated.toFixed(1)}% (LMN: ${lmn2024.grossProfitEstimated}%)`);
    console.log(`  Rev/Hr Sold: $${revPerHourSold.toFixed(0)} (LMN: $${lmn2024.revPerHourSold})`);
    console.log(`  Rev/Hr Estimated: $${revPerHourEstimated.toFixed(0)} (LMN: $${lmn2024.revPerHourEstimated})\n`);

    // ============================================
    // SUMMARY COMPARISON
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY: Closest Match Analysis\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const strategies = [
      {
        name: 'By close_date only',
        total: byCloseDate2024.length,
        sold: wonByCloseDate2024.length,
        dollarSold: dollarSoldCloseDate,
        totalDollar: totalDollarCloseDate,
        totalDiff: Math.abs(byCloseDate2024.length - lmn2024.totalEstimates),
        soldDiff: Math.abs(wonByCloseDate2024.length - lmn2024.estimatesSold),
        dollarDiff: Math.abs(totalDollarCloseDate - lmn2024.totalEstimatedDollar)
      },
      {
        name: 'By estimate_date only',
        total: byEstimateDate2024.length,
        sold: wonByEstimateDate2024.length,
        dollarSold: dollarSoldEstimateDate,
        totalDollar: totalDollarEstimateDate,
        totalDiff: Math.abs(byEstimateDate2024.length - lmn2024.totalEstimates),
        soldDiff: Math.abs(wonByEstimateDate2024.length - lmn2024.estimatesSold),
        dollarDiff: Math.abs(totalDollarEstimateDate - lmn2024.totalEstimatedDollar)
      },
      {
        name: 'By close_date OR estimate_date',
        total: byCloseOrEstimate2024.length,
        sold: wonByCloseOrEstimate2024.length,
        dollarSold: dollarSoldCloseOrEstimate,
        totalDollar: totalDollarCloseOrEstimate,
        totalDiff: Math.abs(byCloseOrEstimate2024.length - lmn2024.totalEstimates),
        soldDiff: Math.abs(wonByCloseOrEstimate2024.length - lmn2024.estimatesSold),
        dollarDiff: Math.abs(totalDollarCloseOrEstimate - lmn2024.totalEstimatedDollar)
      }
    ];

    strategies.forEach(strategy => {
      const totalPct = (strategy.totalDiff / lmn2024.totalEstimates * 100).toFixed(1);
      const soldPct = (strategy.soldDiff / lmn2024.estimatesSold * 100).toFixed(1);
      const dollarPct = (strategy.dollarDiff / lmn2024.totalEstimatedDollar * 100).toFixed(1);
      
      console.log(`${strategy.name}:`);
      console.log(`  Total: ${strategy.total} (diff: ${strategy.totalDiff}, ${totalPct}%)`);
      console.log(`  Sold: ${strategy.sold} (diff: ${strategy.soldDiff}, ${soldPct}%)`);
      console.log(`  $: $${(strategy.totalDollar / 1000000).toFixed(2)}M (diff: $${(strategy.dollarDiff / 1000000).toFixed(2)}M, ${dollarPct}%)\n`);
    });

    // Find closest match
    const closest = strategies.reduce((best, current) => {
      const currentScore = current.totalDiff + current.soldDiff + (current.dollarDiff / 1000000);
      const bestScore = best.totalDiff + best.soldDiff + (best.dollarDiff / 1000000);
      return currentScore < bestScore ? current : best;
    });

    console.log(`✅ Closest match: ${closest.name}`);
    console.log(`   This strategy is ${((closest.totalDiff + closest.soldDiff + (closest.dollarDiff / 1000000)) / (lmn2024.totalEstimates + lmn2024.estimatesSold + (lmn2024.totalEstimatedDollar / 1000000)) * 100).toFixed(1)}% different overall\n`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

compare2024Report();

