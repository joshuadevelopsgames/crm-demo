#!/usr/bin/env node

/**
 * Compare our data with LMN's Salesperson Performance report
 * Reverse engineer how our data could be different
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

// Extract year from date (handles timestamptz)
function getYearFromDate(dateValue) {
  if (!dateValue) return null;
  const dateStr = String(dateValue);
  if (dateStr.length >= 4) {
    return parseInt(dateStr.substring(0, 4));
  }
  return null;
}

// Get current year
const currentYear = new Date().getFullYear();

async function compareSalespersonPerformance() {
  console.log('📊 Comparing our data with LMN Salesperson Performance report...\n');
  console.log(`📅 Analyzing data for year: ${currentYear}\n`);

  try {
    // Fetch all estimates
    console.log('📥 Fetching estimates from database...');
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

    console.log(`✅ Loaded ${allEstimates.length} estimates\n`);

    // Filter estimates for current year using same logic as Reports page
    // Priority: estimate_close_date -> estimate_date
    const yearEstimates = allEstimates.filter(est => {
      let dateToUse = null;
      if (est.estimate_close_date) {
        dateToUse = est.estimate_close_date;
      } else if (est.estimate_date) {
        dateToUse = est.estimate_date;
      }
      if (!dateToUse) return false;
      
      const year = getYearFromDate(dateToUse);
      return year === currentYear;
    });

    console.log(`📅 Estimates for ${currentYear}: ${yearEstimates.length}\n`);

    // LMN's reported values (from screenshot)
    const lmnValues = {
      estimatesSold: 927,
      totalEstimates: 1086,
      dollarAmountSold: 11050000, // $11.05M
      totalEstimatedDollar: 14900000, // $14.9M
      grossProfitSold: 11.9, // 11.9%
      grossProfitEstimated: 11.2, // 11.2%
      revPerHourSold: 460, // $460
      revPerHourEstimated: 508 // $508
    };

    // Calculate our values
    // "Estimates Sold" = estimates with status='won' OR pipeline_status='Sold'
    const soldEstimates = yearEstimates.filter(est => {
      const status = est.status?.toLowerCase() || '';
      const pipelineStatus = est.pipeline_status?.toLowerCase() || '';
      return status === 'won' || pipelineStatus === 'sold';
    });

    // Total estimates (all estimates for the year)
    const totalEstimates = yearEstimates.length;

    // $ of Estimates Sold = sum of total_price_with_tax for sold estimates
    const dollarAmountSold = soldEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.total_price_with_tax || est.total_price || 0));
    }, 0);

    // Total Estimated $ = sum of total_price_with_tax for all estimates
    const totalEstimatedDollar = yearEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.total_price_with_tax || est.total_price || 0));
    }, 0);

    // Gross Profit calculations
    // Gross Profit = (Total Price - Total Cost) / Total Price * 100
    const soldTotalCost = soldEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.total_cost || 0));
    }, 0);
    const soldTotalPrice = soldEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.total_price || 0));
    }, 0);
    const grossProfitSold = soldTotalPrice > 0 
      ? ((soldTotalPrice - soldTotalCost) / soldTotalPrice * 100) 
      : 0;

    const estimatedTotalCost = yearEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.total_cost || 0));
    }, 0);
    const estimatedTotalPrice = yearEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.total_price || 0));
    }, 0);
    const grossProfitEstimated = estimatedTotalPrice > 0
      ? ((estimatedTotalPrice - estimatedTotalCost) / estimatedTotalPrice * 100)
      : 0;

    // Rev/Hr calculations
    // Rev/Hr = Total Price / Labor Hours
    const soldLaborHours = soldEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.labor_hours || 0));
    }, 0);
    const revPerHourSold = soldLaborHours > 0 
      ? (soldTotalPrice / soldLaborHours) 
      : 0;

    const estimatedLaborHours = yearEstimates.reduce((sum, est) => {
      return sum + (parseFloat(est.labor_hours || 0));
    }, 0);
    const revPerHourEstimated = estimatedLaborHours > 0
      ? (estimatedTotalPrice / estimatedLaborHours)
      : 0;

    // Our calculated values
    const ourValues = {
      estimatesSold: soldEstimates.length,
      totalEstimates: totalEstimates,
      dollarAmountSold: dollarAmountSold,
      totalEstimatedDollar: totalEstimatedDollar,
      grossProfitSold: grossProfitSold,
      grossProfitEstimated: grossProfitEstimated,
      revPerHourSold: revPerHourSold,
      revPerHourEstimated: revPerHourEstimated
    };

    // Compare
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 COMPARISON: LMN vs Our Data');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('1️⃣  # of Estimates Sold:');
    console.log(`   LMN:     ${lmnValues.estimatesSold.toLocaleString()}`);
    console.log(`   Ours:    ${ourValues.estimatesSold.toLocaleString()}`);
    console.log(`   Diff:    ${(ourValues.estimatesSold - lmnValues.estimatesSold).toLocaleString()} (${((ourValues.estimatesSold - lmnValues.estimatesSold) / lmnValues.estimatesSold * 100).toFixed(1)}%)\n`);

    console.log('2️⃣  Total Estimates:');
    console.log(`   LMN:     ${lmnValues.totalEstimates.toLocaleString()}`);
    console.log(`   Ours:    ${ourValues.totalEstimates.toLocaleString()}`);
    console.log(`   Diff:    ${(ourValues.totalEstimates - lmnValues.totalEstimates).toLocaleString()} (${((ourValues.totalEstimates - lmnValues.totalEstimates) / lmnValues.totalEstimates * 100).toFixed(1)}%)\n`);

    console.log('3️⃣  $ of Estimates Sold:');
    console.log(`   LMN:     $${(lmnValues.dollarAmountSold / 1000000).toFixed(2)}M`);
    console.log(`   Ours:    $${(ourValues.dollarAmountSold / 1000000).toFixed(2)}M`);
    console.log(`   Diff:    $${((ourValues.dollarAmountSold - lmnValues.dollarAmountSold) / 1000000).toFixed(2)}M (${((ourValues.dollarAmountSold - lmnValues.dollarAmountSold) / lmnValues.dollarAmountSold * 100).toFixed(1)}%)\n`);

    console.log('4️⃣  Total Estimated $:');
    console.log(`   LMN:     $${(lmnValues.totalEstimatedDollar / 1000000).toFixed(2)}M`);
    console.log(`   Ours:    $${(ourValues.totalEstimatedDollar / 1000000).toFixed(2)}M`);
    console.log(`   Diff:    $${((ourValues.totalEstimatedDollar - lmnValues.totalEstimatedDollar) / 1000000).toFixed(2)}M (${((ourValues.totalEstimatedDollar - lmnValues.totalEstimatedDollar) / lmnValues.totalEstimatedDollar * 100).toFixed(1)}%)\n`);

    console.log('5️⃣  Gross Profit Sold:');
    console.log(`   LMN:     ${lmnValues.grossProfitSold}%`);
    console.log(`   Ours:    ${ourValues.grossProfitSold.toFixed(1)}%`);
    console.log(`   Diff:    ${(ourValues.grossProfitSold - lmnValues.grossProfitSold).toFixed(1)}%\n`);

    console.log('6️⃣  Gross Profit Estimated:');
    console.log(`   LMN:     ${lmnValues.grossProfitEstimated}%`);
    console.log(`   Ours:    ${ourValues.grossProfitEstimated.toFixed(1)}%`);
    console.log(`   Diff:    ${(ourValues.grossProfitEstimated - lmnValues.grossProfitEstimated).toFixed(1)}%\n`);

    console.log('7️⃣  Rev/Hr Sold:');
    console.log(`   LMN:     $${lmnValues.revPerHourSold}`);
    console.log(`   Ours:    $${ourValues.revPerHourSold.toFixed(2)}`);
    console.log(`   Diff:    $${(ourValues.revPerHourSold - lmnValues.revPerHourSold).toFixed(2)}\n`);

    console.log('8️⃣  Rev/Hr Estimated:');
    console.log(`   LMN:     $${lmnValues.revPerHourEstimated}`);
    console.log(`   Ours:    $${ourValues.revPerHourEstimated.toFixed(2)}`);
    console.log(`   Diff:    $${(ourValues.revPerHourEstimated - lmnValues.revPerHourEstimated).toFixed(2)}\n`);

    // Analyze potential differences
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 POTENTIAL REASONS FOR DIFFERENCES:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check date filtering
    const estimatesWithCloseDate = yearEstimates.filter(e => e.estimate_close_date).length;
    const estimatesWithEstimateDate = yearEstimates.filter(e => e.estimate_date && !e.estimate_close_date).length;
    const estimatesWithNoDate = allEstimates.filter(e => {
      return !e.estimate_close_date && !e.estimate_date;
    }).length;

    console.log('📅 Date Filtering:');
    console.log(`   Estimates using close_date: ${estimatesWithCloseDate}`);
    console.log(`   Estimates using estimate_date: ${estimatesWithEstimateDate}`);
    console.log(`   Estimates with no date (excluded): ${estimatesWithNoDate}\n`);

    // Check status distribution
    const statusBreakdown = {};
    yearEstimates.forEach(est => {
      const status = est.status || 'unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    console.log('📊 Status Breakdown:');
    Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('');

    // Check pipeline_status distribution
    const pipelineBreakdown = {};
    yearEstimates.forEach(est => {
      const pipeline = est.pipeline_status || est.status || 'unknown';
      pipelineBreakdown[pipeline] = (pipelineBreakdown[pipeline] || 0) + 1;
    });

    console.log('📊 Pipeline Status Breakdown:');
    Object.entries(pipelineBreakdown).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('');

    // Check exclude_stats
    const excludedCount = yearEstimates.filter(e => e.exclude_stats).length;
    console.log(`🚫 Excluded from stats: ${excludedCount} estimates\n`);

    // Check for missing cost data
    const soldWithoutCost = soldEstimates.filter(e => !e.total_cost || e.total_cost === 0).length;
    const allWithoutCost = yearEstimates.filter(e => !e.total_cost || e.total_cost === 0).length;
    console.log(`💰 Missing cost data:`);
    console.log(`   Sold estimates without cost: ${soldWithoutCost}`);
    console.log(`   All estimates without cost: ${allWithoutCost}\n`);

    // Check for missing labor hours
    const soldWithoutHours = soldEstimates.filter(e => !e.labor_hours || e.labor_hours === 0).length;
    const allWithoutHours = yearEstimates.filter(e => !e.labor_hours || e.labor_hours === 0).length;
    console.log(`⏱️  Missing labor hours:`);
    console.log(`   Sold estimates without hours: ${soldWithoutHours}`);
    console.log(`   All estimates without hours: ${allWithoutHours}\n`);

    // Check price field usage
    const usingTotalPrice = yearEstimates.filter(e => e.total_price && !e.total_price_with_tax).length;
    const usingTotalPriceWithTax = yearEstimates.filter(e => e.total_price_with_tax).length;
    console.log(`💵 Price field usage:`);
    console.log(`   Using total_price (no tax): ${usingTotalPrice}`);
    console.log(`   Using total_price_with_tax: ${usingTotalPriceWithTax}\n`);

    // Sample estimates to check
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 SAMPLE DATA (first 5 sold estimates):');
    console.log('═══════════════════════════════════════════════════════════════\n');
    soldEstimates.slice(0, 5).forEach((est, idx) => {
      console.log(`${idx + 1}. ${est.lmn_estimate_id || est.estimate_number || est.id}:`);
      console.log(`   Status: ${est.status}, Pipeline: ${est.pipeline_status || 'N/A'}`);
      console.log(`   Price: ${est.total_price_with_tax || est.total_price || 0}`);
      console.log(`   Cost: ${est.total_cost || 0}`);
      console.log(`   Hours: ${est.labor_hours || 0}`);
      console.log(`   Date: ${est.estimate_close_date || est.estimate_date || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

compareSalespersonPerformance();

