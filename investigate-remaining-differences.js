#!/usr/bin/env node

/**
 * Investigate what else could be making our numbers different from LMN
 * After filtering by estimate_close_date, what additional filters or data issues remain?
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

async function investigateRemainingDifferences() {
  console.log('🔍 Investigating Remaining Differences After Filtering by close_date\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // LMN values for comparison
  const lmn2024 = {
    totalEstimates: 591,
    estimatesSold: 577,
    totalDollar: 7000000
  };

  const lmn2025 = {
    totalEstimates: 1086,
    estimatesSold: 927,
    totalDollar: 14900000
  };

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
    // BASE: Filter by close_date only
    // ============================================

    const base2024 = allEstimates.filter(e => {
      const closeYear = getYearFromDate(e.estimate_close_date);
      return closeYear === 2024;
    });

    const base2025 = allEstimates.filter(e => {
      const closeYear = getYearFromDate(e.estimate_close_date);
      return closeYear === 2025;
    });

    console.log('📊 BASE: Filter by estimate_close_date only\n');
    console.log(`2024: ${base2024.length} estimates (LMN: ${lmn2024.totalEstimates}, diff: ${base2024.length - lmn2024.totalEstimates})`);
    console.log(`2025: ${base2025.length} estimates (LMN: ${lmn2025.totalEstimates}, diff: ${base2025.length - lmn2025.totalEstimates})\n`);

    // ============================================
    // INVESTIGATION 1: Exclude Stats
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('1️⃣  EXCLUDE_STATS FILTER:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const excluded2024 = base2024.filter(e => e.exclude_stats).length;
    const excluded2025 = base2025.filter(e => e.exclude_stats).length;

    const afterExclude2024 = base2024.filter(e => !e.exclude_stats);
    const afterExclude2025 = base2025.filter(e => !e.exclude_stats);

    console.log(`2024: ${excluded2024} estimates excluded (${base2024.length} → ${afterExclude2024.length})`);
    console.log(`2025: ${excluded2025} estimates excluded (${base2025.length} → ${afterExclude2025.length})`);
    console.log(`After exclude_stats filter:`);
    console.log(`  2024: ${afterExclude2024.length} (LMN: ${lmn2024.totalEstimates}, diff: ${afterExclude2024.length - lmn2024.totalEstimates})`);
    console.log(`  2025: ${afterExclude2025.length} (LMN: ${lmn2025.totalEstimates}, diff: ${afterExclude2025.length - lmn2025.totalEstimates})\n`);

    // ============================================
    // INVESTIGATION 2: Archived Estimates
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('2️⃣  ARCHIVED FILTER:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const archived2024 = afterExclude2024.filter(e => e.archived).length;
    const archived2025 = afterExclude2025.filter(e => e.archived).length;

    const afterArchived2024 = afterExclude2024.filter(e => !e.archived);
    const afterArchived2025 = afterExclude2025.filter(e => !e.archived);

    console.log(`2024: ${archived2024} archived estimates`);
    console.log(`2025: ${archived2025} archived estimates`);
    console.log(`After archived filter:`);
    console.log(`  2024: ${afterArchived2024.length} (LMN: ${lmn2024.totalEstimates}, diff: ${afterArchived2024.length - lmn2024.totalEstimates})`);
    console.log(`  2025: ${afterArchived2025.length} (LMN: ${lmn2025.totalEstimates}, diff: ${afterArchived2025.length - lmn2025.totalEstimates})\n`);

    // ============================================
    // INVESTIGATION 3: Price Field Usage
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('3️⃣  PRICE FIELD USAGE:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test using total_price vs total_price_with_tax
    const totalDollarWithTax2024 = afterArchived2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const totalDollarNoTax2024 = afterArchived2024.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);

    const totalDollarWithTax2025 = afterArchived2025.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const totalDollarNoTax2025 = afterArchived2025.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);

    console.log('2024:');
    console.log(`  Using total_price_with_tax: $${(totalDollarWithTax2024 / 1000000).toFixed(2)}M (LMN: $${(lmn2024.totalDollar / 1000000).toFixed(2)}M)`);
    console.log(`  Using total_price (no tax): $${(totalDollarNoTax2024 / 1000000).toFixed(2)}M`);
    console.log(`  Difference: $${((totalDollarWithTax2024 - lmn2024.totalDollar) / 1000000).toFixed(2)}M vs $${((totalDollarNoTax2024 - lmn2024.totalDollar) / 1000000).toFixed(2)}M\n`);

    console.log('2025:');
    console.log(`  Using total_price_with_tax: $${(totalDollarWithTax2025 / 1000000).toFixed(2)}M (LMN: $${(lmn2025.totalDollar / 1000000).toFixed(2)}M)`);
    console.log(`  Using total_price (no tax): $${(totalDollarNoTax2025 / 1000000).toFixed(2)}M`);
    console.log(`  Difference: $${((totalDollarWithTax2025 - lmn2025.totalDollar) / 1000000).toFixed(2)}M vs $${((totalDollarNoTax2025 - lmn2025.totalDollar) / 1000000).toFixed(2)}M\n`);

    // ============================================
    // INVESTIGATION 4: Duplicate Estimates
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('4️⃣  DUPLICATE ESTIMATES (by lmn_estimate_id):\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const duplicates2024 = {};
    afterArchived2024.forEach(e => {
      if (e.lmn_estimate_id) {
        duplicates2024[e.lmn_estimate_id] = (duplicates2024[e.lmn_estimate_id] || 0) + 1;
      }
    });

    const duplicates2025 = {};
    afterArchived2025.forEach(e => {
      if (e.lmn_estimate_id) {
        duplicates2025[e.lmn_estimate_id] = (duplicates2025[e.lmn_estimate_id] || 0) + 1;
      }
    });

    const duplicateCount2024 = Object.values(duplicates2024).filter(count => count > 1).length;
    const duplicateCount2025 = Object.values(duplicates2025).filter(count => count > 1).length;

    console.log(`2024: ${duplicateCount2024} lmn_estimate_ids appear multiple times`);
    console.log(`2025: ${duplicateCount2025} lmn_estimate_ids appear multiple times\n`);

    // Remove duplicates (keep first occurrence)
    const unique2024 = [];
    const seen2024 = new Set();
    afterArchived2024.forEach(e => {
      if (e.lmn_estimate_id) {
        if (!seen2024.has(e.lmn_estimate_id)) {
          seen2024.add(e.lmn_estimate_id);
          unique2024.push(e);
        }
      } else {
        unique2024.push(e);
      }
    });

    const unique2025 = [];
    const seen2025 = new Set();
    afterArchived2025.forEach(e => {
      if (e.lmn_estimate_id) {
        if (!seen2025.has(e.lmn_estimate_id)) {
          seen2025.add(e.lmn_estimate_id);
          unique2025.push(e);
        }
      } else {
        unique2025.push(e);
      }
    });

    console.log(`After removing duplicates:`);
    console.log(`  2024: ${unique2024.length} (was ${afterArchived2024.length}, removed ${afterArchived2024.length - unique2024.length})`);
    console.log(`  2025: ${unique2025.length} (was ${afterArchived2025.length}, removed ${afterArchived2025.length - unique2025.length})`);
    console.log(`  Difference from LMN:`);
    console.log(`    2024: ${unique2024.length - lmn2024.totalEstimates} (${((unique2024.length - lmn2024.totalEstimates) / lmn2024.totalEstimates * 100).toFixed(1)}%)`);
    console.log(`    2025: ${unique2025.length - lmn2025.totalEstimates} (${((unique2025.length - lmn2025.totalEstimates) / lmn2025.totalEstimates * 100).toFixed(1)}%)\n`);

    // ============================================
    // INVESTIGATION 5: Division/Department Filter
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('5️⃣  DIVISION/DEPARTMENT BREAKDOWN:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const divisionBreakdown2024 = {};
    unique2024.forEach(e => {
      const div = e.division || 'Unknown';
      divisionBreakdown2024[div] = (divisionBreakdown2024[div] || 0) + 1;
    });

    const divisionBreakdown2025 = {};
    unique2025.forEach(e => {
      const div = e.division || 'Unknown';
      divisionBreakdown2025[div] = (divisionBreakdown2025[div] || 0) + 1;
    });

    console.log('2024 Divisions:');
    Object.entries(divisionBreakdown2024).sort((a, b) => b[1] - a[1]).forEach(([div, count]) => {
      console.log(`  ${div}: ${count}`);
    });
    console.log('');

    console.log('2025 Divisions:');
    Object.entries(divisionBreakdown2025).sort((a, b) => b[1] - a[1]).forEach(([div, count]) => {
      console.log(`  ${div}: ${count}`);
    });
    console.log('');

    // ============================================
    // INVESTIGATION 6: Zero or Negative Prices
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('6️⃣  ZERO OR NEGATIVE PRICES:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const zeroPrice2024 = unique2024.filter(e => {
      const price = parseFloat(e.total_price_with_tax || e.total_price || 0);
      return price <= 0;
    }).length;

    const zeroPrice2025 = unique2025.filter(e => {
      const price = parseFloat(e.total_price_with_tax || e.total_price || 0);
      return price <= 0;
    }).length;

    console.log(`2024: ${zeroPrice2024} estimates with zero or negative price`);
    console.log(`2025: ${zeroPrice2025} estimates with zero or negative price\n`);

    const afterZeroPrice2024 = unique2024.filter(e => {
      const price = parseFloat(e.total_price_with_tax || e.total_price || 0);
      return price > 0;
    });

    const afterZeroPrice2025 = unique2025.filter(e => {
      const price = parseFloat(e.total_price_with_tax || e.total_price || 0);
      return price > 0;
    });

    console.log(`After removing zero/negative prices:`);
    console.log(`  2024: ${afterZeroPrice2024.length} (was ${unique2024.length})`);
    console.log(`  2025: ${afterZeroPrice2025.length} (was ${unique2025.length})`);
    console.log(`  Difference from LMN:`);
    console.log(`    2024: ${afterZeroPrice2024.length - lmn2024.totalEstimates} (${((afterZeroPrice2024.length - lmn2024.totalEstimates) / lmn2024.totalEstimates * 100).toFixed(1)}%)`);
    console.log(`    2025: ${afterZeroPrice2025.length - lmn2025.totalEstimates} (${((afterZeroPrice2025.length - lmn2025.totalEstimates) / lmn2025.totalEstimates * 100).toFixed(1)}%)\n`);

    // ============================================
    // SUMMARY: Best Match After All Filters
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY: Best Match After All Filters\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Filters Applied:');
    console.log('  1. estimate_close_date in year');
    console.log('  2. exclude_stats = false');
    console.log('  3. archived = false');
    console.log('  4. Remove duplicates by lmn_estimate_id');
    console.log('  5. Remove zero/negative prices\n');

    console.log('Results:');
    console.log(`  2024: ${afterZeroPrice2024.length} estimates (LMN: ${lmn2024.totalEstimates}, diff: ${afterZeroPrice2024.length - lmn2024.totalEstimates}, ${((afterZeroPrice2024.length - lmn2024.totalEstimates) / lmn2024.totalEstimates * 100).toFixed(1)}%)`);
    console.log(`  2025: ${afterZeroPrice2025.length} estimates (LMN: ${lmn2025.totalEstimates}, diff: ${afterZeroPrice2025.length - lmn2025.totalEstimates}, ${((afterZeroPrice2025.length - lmn2025.totalEstimates) / lmn2025.totalEstimates * 100).toFixed(1)}%)\n`);

    // Calculate dollar amounts with best match
    const bestDollar2024 = afterZeroPrice2024.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);
    const bestDollar2025 = afterZeroPrice2025.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);

    console.log('Dollar Amounts (using total_price, no tax):');
    console.log(`  2024: $${(bestDollar2024 / 1000000).toFixed(2)}M (LMN: $${(lmn2024.totalDollar / 1000000).toFixed(2)}M, diff: $${((bestDollar2024 - lmn2024.totalDollar) / 1000000).toFixed(2)}M)`);
    console.log(`  2025: $${(bestDollar2025 / 1000000).toFixed(2)}M (LMN: $${(lmn2025.totalDollar / 1000000).toFixed(2)}M, diff: $${((bestDollar2025 - lmn2025.totalDollar) / 1000000).toFixed(2)}M)\n`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

investigateRemainingDifferences();

