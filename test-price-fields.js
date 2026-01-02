#!/usr/bin/env node

/**
 * Test if LMN uses total_price (no tax) vs total_price_with_tax
 * The dollar amounts are significantly different, suggesting wrong price field
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

function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  const wonStatuses = [
    'contract signed',
    'work complete',
    'billing complete',
    'email contract award',
    'verbal contract award',
    'won'
  ];
  return wonStatuses.includes(statusLower);
}

async function testPriceFields() {
  console.log('💰 Testing Price Field Usage\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // LMN values from screenshots
  const lmn2024 = {
    dollarSold: 6580000,
    totalEstimatedDollar: 7000000
  };

  const lmn2025 = {
    dollarSold: 11050000,
    totalEstimatedDollar: 14900000
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

    // Filter function
    const filterForYear = (year, soldOnly = false) => {
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

      return uniqueEstimates.filter(estimate => {
        if (estimate.exclude_stats) return false;
        if (estimate.archived) return false;
        const price = parseFloat(estimate.total_price_with_tax || estimate.total_price || 0);
        if (price <= 0) return false;
        if (soldOnly && !isWonStatus(estimate.status)) return false;
        if (!estimate.estimate_close_date) return false;
        const closeYear = getYearFromDate(estimate.estimate_close_date);
        if (closeYear !== year) return false;
        return true;
      });
    };

    const our2024All = filterForYear(2024, false);
    const our2024Sold = filterForYear(2024, true);
    const our2025All = filterForYear(2025, false);
    const our2025Sold = filterForYear(2025, true);

    console.log('2024 - Testing Price Fields:\n');
    
    // Test with total_price_with_tax
    const sold2024WithTax = our2024Sold.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const total2024WithTax = our2024All.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    
    // Test with total_price (no tax)
    const sold2024NoTax = our2024Sold.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);
    const total2024NoTax = our2024All.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);

    console.log('Using total_price_with_tax:');
    console.log(`  Sold: $${(sold2024WithTax / 1000000).toFixed(2)}M (LMN: $${(lmn2024.dollarSold / 1000000).toFixed(2)}M, diff: $${((sold2024WithTax - lmn2024.dollarSold) / 1000000).toFixed(2)}M)`);
    console.log(`  Total: $${(total2024WithTax / 1000000).toFixed(2)}M (LMN: $${(lmn2024.totalEstimatedDollar / 1000000).toFixed(2)}M, diff: $${((total2024WithTax - lmn2024.totalEstimatedDollar) / 1000000).toFixed(2)}M)\n`);

    console.log('Using total_price (no tax):');
    console.log(`  Sold: $${(sold2024NoTax / 1000000).toFixed(2)}M (LMN: $${(lmn2024.dollarSold / 1000000).toFixed(2)}M, diff: $${((sold2024NoTax - lmn2024.dollarSold) / 1000000).toFixed(2)}M)`);
    console.log(`  Total: $${(total2024NoTax / 1000000).toFixed(2)}M (LMN: $${(lmn2024.totalEstimatedDollar / 1000000).toFixed(2)}M, diff: $${((total2024NoTax - lmn2024.totalEstimatedDollar) / 1000000).toFixed(2)}M)\n`);

    const diffWithTax2024 = Math.abs(sold2024WithTax - lmn2024.dollarSold) + Math.abs(total2024WithTax - lmn2024.totalEstimatedDollar);
    const diffNoTax2024 = Math.abs(sold2024NoTax - lmn2024.dollarSold) + Math.abs(total2024NoTax - lmn2024.totalEstimatedDollar);

    console.log(`2024 Closest match: ${diffNoTax2024 < diffWithTax2024 ? 'total_price (no tax)' : 'total_price_with_tax'}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('2025 - Testing Price Fields:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test with total_price_with_tax
    const sold2025WithTax = our2025Sold.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    const total2025WithTax = our2025All.reduce((s, e) => s + (parseFloat(e.total_price_with_tax || 0)), 0);
    
    // Test with total_price (no tax)
    const sold2025NoTax = our2025Sold.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);
    const total2025NoTax = our2025All.reduce((s, e) => s + (parseFloat(e.total_price || 0)), 0);

    console.log('Using total_price_with_tax:');
    console.log(`  Sold: $${(sold2025WithTax / 1000000).toFixed(2)}M (LMN: $${(lmn2025.dollarSold / 1000000).toFixed(2)}M, diff: $${((sold2025WithTax - lmn2025.dollarSold) / 1000000).toFixed(2)}M)`);
    console.log(`  Total: $${(total2025WithTax / 1000000).toFixed(2)}M (LMN: $${(lmn2025.totalEstimatedDollar / 1000000).toFixed(2)}M, diff: $${((total2025WithTax - lmn2025.totalEstimatedDollar) / 1000000).toFixed(2)}M)\n`);

    console.log('Using total_price (no tax):');
    console.log(`  Sold: $${(sold2025NoTax / 1000000).toFixed(2)}M (LMN: $${(lmn2025.dollarSold / 1000000).toFixed(2)}M, diff: $${((sold2025NoTax - lmn2025.dollarSold) / 1000000).toFixed(2)}M)`);
    console.log(`  Total: $${(total2025NoTax / 1000000).toFixed(2)}M (LMN: $${(lmn2025.totalEstimatedDollar / 1000000).toFixed(2)}M, diff: $${((total2025NoTax - lmn2025.totalEstimatedDollar) / 1000000).toFixed(2)}M)\n`);

    const diffWithTax2025 = Math.abs(sold2025WithTax - lmn2025.dollarSold) + Math.abs(total2025WithTax - lmn2025.totalEstimatedDollar);
    const diffNoTax2025 = Math.abs(sold2025NoTax - lmn2025.dollarSold) + Math.abs(total2025NoTax - lmn2025.totalEstimatedDollar);

    console.log(`2025 Closest match: ${diffNoTax2025 < diffWithTax2025 ? 'total_price (no tax)' : 'total_price_with_tax'}\n`);

    // Check how many estimates have both fields and what the difference is
    const estimatesWithBoth2024 = our2024Sold.filter(e => e.total_price && e.total_price_with_tax);
    const avgTax2024 = estimatesWithBoth2024.length > 0
      ? estimatesWithBoth2024.reduce((s, e) => s + (parseFloat(e.total_price_with_tax) - parseFloat(e.total_price)), 0) / estimatesWithBoth2024.length
      : 0;

    const estimatesWithBoth2025 = our2025Sold.filter(e => e.total_price && e.total_price_with_tax);
    const avgTax2025 = estimatesWithBoth2025.length > 0
      ? estimatesWithBoth2025.reduce((s, e) => s + (parseFloat(e.total_price_with_tax) - parseFloat(e.total_price)), 0) / estimatesWithBoth2025.length
      : 0;

    console.log('Tax Analysis:');
    console.log(`  2024: ${estimatesWithBoth2024.length} estimates have both fields, avg tax difference: $${avgTax2024.toFixed(2)}`);
    console.log(`  2025: ${estimatesWithBoth2025.length} estimates have both fields, avg tax difference: $${avgTax2025.toFixed(2)}\n`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

testPriceFields();


