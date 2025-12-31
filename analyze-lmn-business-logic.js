#!/usr/bin/env node

/**
 * Objective analysis of how LMN processes data for Salesperson Performance
 * Understanding the business logic behind their filtering
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

async function analyzeBusinessLogic() {
  console.log('🧠 Objective Analysis: How LMN Processes Salesperson Performance Data\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

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
    // BUSINESS LOGIC ANALYSIS
    // ============================================

    console.log('📊 BUSINESS LOGIC: Understanding "Estimates Sold" vs "Estimates Created"\n');

    // Scenario 1: Estimate created in 2024, sold in 2025
    const created2024Sold2025 = allEstimates.filter(e => {
      const createdYear = getYearFromDate(e.estimate_date);
      const soldYear = getYearFromDate(e.estimate_close_date);
      return createdYear === 2024 && soldYear === currentYear && e.status === 'won';
    });

    // Scenario 2: Estimate created in 2025, sold in 2025
    const created2025Sold2025 = allEstimates.filter(e => {
      const createdYear = getYearFromDate(e.estimate_date);
      const soldYear = getYearFromDate(e.estimate_close_date);
      return createdYear === currentYear && soldYear === currentYear && e.status === 'won';
    });

    // Scenario 3: Estimate created in 2025, not yet sold
    const created2025NotSold = allEstimates.filter(e => {
      const createdYear = getYearFromDate(e.estimate_date);
      return createdYear === currentYear && !e.estimate_close_date && e.status !== 'won';
    });

    // Scenario 4: Estimate created in 2024, not yet sold (still in pipeline)
    const created2024NotSold = allEstimates.filter(e => {
      const createdYear = getYearFromDate(e.estimate_date);
      return createdYear === 2024 && !e.estimate_close_date && e.status !== 'won';
    });

    console.log('📅 Scenario Analysis:\n');
    console.log(`1. Created in 2024, Sold in ${currentYear}: ${created2024Sold2025.length} estimates`);
    console.log(`   → Should appear in "This year" sales performance? YES (sold this year)`);
    console.log(`   → Should appear in "This year" pipeline? NO (created last year)\n`);

    console.log(`2. Created in ${currentYear}, Sold in ${currentYear}: ${created2025Sold2025.length} estimates`);
    console.log(`   → Should appear in "This year" sales performance? YES (sold this year)`);
    console.log(`   → Should appear in "This year" pipeline? YES (created this year)\n`);

    console.log(`3. Created in ${currentYear}, Not yet sold: ${created2025NotSold.length} estimates`);
    console.log(`   → Should appear in "This year" sales performance? NO (not sold yet)`);
    console.log(`   → Should appear in "This year" pipeline? YES (created this year)\n`);

    console.log(`4. Created in 2024, Not yet sold: ${created2024NotSold.length} estimates`);
    console.log(`   → Should appear in "This year" sales performance? NO (not sold yet)`);
    console.log(`   → Should appear in "This year" pipeline? NO (created last year)\n`);

    // ============================================
    // LMN'S LIKELY APPROACH
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎯 LMN\'S LIKELY BUSINESS LOGIC:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('For "Salesperson Performance" report with "This year" filter:\n');
    console.log('1. "All sales figures based on estimates sold"');
    console.log('   → This means: Only count estimates that were SOLD this year');
    console.log('   → Filter: estimate_close_date in current year');
    console.log('   → NOT: estimate_date in current year\n');

    console.log('2. "Estimates Sold" definition:');
    console.log('   → pipeline_status = "Sold" (primary)');
    console.log('   → OR status = "won" AND estimate_close_date exists (fallback)');
    console.log('   → This ensures we only count actual sales, not pipeline\n');

    console.log('3. Why this approach?');
    console.log('   → Sales Performance = What you actually sold this year');
    console.log('   → Pipeline Performance = What you\'re working on');
    console.log('   → These are DIFFERENT metrics for DIFFERENT purposes\n');

    // ============================================
    // TEST LMN'S LIKELY LOGIC
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 TESTING LMN\'S LIKELY LOGIC:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // LMN Logic: Filter by estimate_close_date in current year
    // AND pipeline_status='Sold' OR (status='won' AND estimate_close_date exists)
    const lmnLogicEstimates = allEstimates.filter(e => {
      // Must have close_date in current year
      const soldYear = getYearFromDate(e.estimate_close_date);
      if (soldYear !== currentYear) return false;

      // Must be sold (pipeline_status='Sold' OR status='won')
      const pipelineStatus = (e.pipeline_status || '').toLowerCase().trim();
      const isSoldByPipeline = pipelineStatus === 'sold';
      const isSoldByStatus = e.status === 'won' && e.estimate_close_date;
      
      return isSoldByPipeline || isSoldByStatus;
    });

    // Also test with just status='won' (our current approach)
    const ourCurrentApproach = allEstimates.filter(e => {
      const soldYear = getYearFromDate(e.estimate_close_date);
      return soldYear === currentYear && e.status === 'won';
    });

    // Also test with estimate_date OR estimate_close_date (what we're currently doing)
    const ourCurrentReportsApproach = allEstimates.filter(e => {
      let dateToUse = e.estimate_close_date || e.estimate_date;
      if (!dateToUse) return false;
      const year = getYearFromDate(dateToUse);
      return year === currentYear;
    });

    console.log('Results:\n');
    console.log(`LMN's Likely Logic (close_date + sold): ${lmnLogicEstimates.length} estimates`);
    console.log(`Our Current Approach (close_date + won): ${ourCurrentApproach.length} estimates`);
    console.log(`Our Reports Approach (close_date OR estimate_date): ${ourCurrentReportsApproach.length} estimates\n`);

    // Calculate dollar amounts
    const lmnDollar = lmnLogicEstimates.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const ourDollar = ourCurrentApproach.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const reportsDollar = ourCurrentReportsApproach.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);

    console.log('Dollar Amounts:\n');
    console.log(`LMN's Likely Logic: $${(lmnDollar / 1000000).toFixed(2)}M`);
    console.log(`Our Current Approach: $${(ourDollar / 1000000).toFixed(2)}M`);
    console.log(`Our Reports Approach: $${(reportsDollar / 1000000).toFixed(2)}M\n`);

    // ============================================
    // WHY THIS MAKES BUSINESS SENSE
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💡 WHY THIS MAKES BUSINESS SENSE:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('1. SALES PERFORMANCE vs PIPELINE PERFORMANCE:\n');
    console.log('   Sales Performance (what LMN shows):');
    console.log('   - "What did we actually sell this year?"');
    console.log('   - Based on when the deal closed (estimate_close_date)');
    console.log('   - Measures actual revenue generated');
    console.log('   - Used for: Commission calculations, revenue reporting, year-end analysis\n');

    console.log('   Pipeline Performance (different report):');
    console.log('   - "What are we working on this year?"');
    console.log('   - Based on when estimate was created (estimate_date)');
    console.log('   - Measures potential future revenue');
    console.log('   - Used for: Forecasting, pipeline management, sales planning\n');

    console.log('2. THE "ESTIMATE SOLD" FILTER:\n');
    console.log('   LMN has TWO separate filters:');
    console.log('   - "Estimate Date" → Filters by estimate_date (when created)');
    console.log('   - "Estimate Sold" → Filters by estimate_close_date (when sold)');
    console.log('   - For Salesperson Performance, they use "Estimate Sold" = "This year"');
    console.log('   - This ensures you see performance for deals that closed this year\n');

    console.log('3. PIPELINE_STATUS vs STATUS:\n');
    console.log('   - status = "won" → Estimate was won (could be in any year)');
    console.log('   - pipeline_status = "Sold" → Estimate is in "Sold" stage of pipeline');
    console.log('   - LMN likely uses pipeline_status for reporting because:');
    console.log('     * It\'s more specific to the sales process');
    console.log('     * It can distinguish between "Won" and "Sold" (different stages)');
    console.log('     * It aligns with their pipeline management workflow\n');

    // ============================================
    // WHAT WE SHOULD DO
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ WHAT WE SHOULD DO:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('1. For "Salesperson Performance" reports:');
    console.log('   → Filter by estimate_close_date in selected year');
    console.log('   → Use pipeline_status="Sold" (when available) OR status="won"');
    console.log('   → This matches LMN\'s "All sales figures based on estimates sold"\n');

    console.log('2. For "Pipeline" reports (if we add them):');
    console.log('   → Filter by estimate_date in selected year');
    console.log('   → Include all estimates (won, lost, pending)');
    console.log('   → This shows what was worked on, not what was sold\n');

    console.log('3. For general "Reports" page:');
    console.log('   → Keep current logic (close_date OR estimate_date)');
    console.log('   → This shows all estimates for the year (both sold and created)');
    console.log('   → But add a filter option: "Show only sold estimates"\n');

    // ============================================
    // DATA QUALITY CHECK
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 DATA QUALITY CHECK:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const wonWithoutCloseDate = allEstimates.filter(e => e.status === 'won' && !e.estimate_close_date).length;
    const lostWithCloseDate = allEstimates.filter(e => e.status === 'lost' && e.estimate_close_date).length;
    const wonWithFutureCloseDate = allEstimates.filter(e => {
      if (e.status !== 'won' || !e.estimate_close_date) return false;
      const closeYear = getYearFromDate(e.estimate_close_date);
      return closeYear > currentYear;
    }).length;

    console.log(`Estimates with status='won' but no close_date: ${wonWithoutCloseDate}`);
    console.log(`   → These can't be counted in "sold this year" reports`);
    console.log(`   → May need to backfill close_date from estimate_date\n`);

    console.log(`Estimates with status='lost' but have close_date: ${lostWithCloseDate}`);
    console.log(`   → These shouldn't be counted as "sold"`);
    console.log(`   → Data quality issue - lost estimates shouldn't have close_date\n`);

    console.log(`Estimates with status='won' and future close_date: ${wonWithFutureCloseDate}`);
    console.log(`   → These are won but not yet closed`);
    console.log(`   → Should be excluded from "sold this year" reports\n`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

analyzeBusinessLogic();

