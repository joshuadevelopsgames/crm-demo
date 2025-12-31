#!/usr/bin/env node

/**
 * Find Exclusion Rules to Match LMN's "Estimates Sold $" Target
 * 
 * This script searches for exclusion rules (division blacklists, low hours + high price,
 * price-per-hour thresholds) that best match LMN's target of $11,050,000 for "Estimates Sold $"
 * 
 * Based on ChatGPT's Python algorithm, converted to JavaScript for Supabase data.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
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

// Configuration
const TARGET = 11_050_000.00;  // LMN "Estimates Sold $" target
const YEAR_START = '2025-01-01';
const YEAR_END = '2025-12-31';

// Won statuses (matching your existing isWonStatus function)
const WON_STATUSES = [
  'contract signed',
  'work complete',
  'billing complete',
  'email contract award',
  'verbal contract award',
  'won'
];

// Helper functions
function norm(s) {
  return (!s || s === null || s === undefined) ? '' : String(s).trim();
}

function contains(s, pat) {
  const regex = new RegExp(pat, 'i');
  return regex.test(norm(s));
}

function parseDate(x) {
  if (!x) return null;
  const date = new Date(x);
  return isNaN(date.getTime()) ? null : date;
}

function money(x) {
  if (!x || x === null || x === undefined) return NaN;
  const s = String(x).replace(/\$/g, '').replace(/,/g, '').trim();
  const num = parseFloat(s);
  return isNaN(num) ? NaN : num;
}

function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  return WON_STATUSES.includes(statusLower);
}

/**
 * Apply exclusion rules to a dataset
 */
function applyRules(df, divBlacklist, hourLt, priceGt, pphGt) {
  const d = [...df]; // Copy array
  
  // Division blacklist exclusion
  const exclDiv = d.map(est => {
    if (!divBlacklist || divBlacklist.length === 0) return false;
    const division = norm(est.division || '');
    return divBlacklist.includes(division);
  });
  
  // Low-hours + high-price exclusion
  const exclLowHrHighPrice = d.map(est => {
    const hours = est._hours || 0;
    const price = est._price || 0;
    return (hours < hourLt) && (price > priceGt);
  });
  
  // Price-per-hour exclusion
  const exclPph = d.map(est => {
    const hours = est._hours || 0;
    const price = est._price || 0;
    if (hours === 0 || hours === null || hours === undefined) return false;
    const pph = price / hours;
    if (!isFinite(pph)) return false;
    return pph > pphGt;
  });
  
  // Combine exclusions
  const excluded = d.map((est, idx) => exclDiv[idx] || exclLowHrHighPrice[idx] || exclPph[idx]);
  const kept = d.filter((est, idx) => !excluded[idx]);
  const excludedList = d.filter((est, idx) => excluded[idx]);
  
  return { kept, excluded: excludedList };
}

async function findExclusionRules() {
  console.log('🔍 Finding exclusion rules to match LMN\'s "Estimates Sold $" target...\n');
  console.log(`Target: $${TARGET.toLocaleString()}\n`);

  try {
    // Fetch all estimates with required fields
    console.log('📥 Fetching estimates from Supabase...');
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_close_date, status, division, total_price, labor_hours')
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

    console.log(`✅ Fetched ${allEstimates.length} estimates\n`);

    // Clean and prepare data
    console.log('🧹 Cleaning data...');
    const df = allEstimates.map(est => ({
      ...est,
      _close: parseDate(est.estimate_close_date),
      _status: norm(est.status),
      _division: norm(est.division),
      _price: money(est.total_price),
      _hours: est.labor_hours ? parseFloat(est.labor_hours) : NaN,
    }));

    // Base CountSet: estimates with close_date in 2025, excluding "Lost" status
    const yearStart = new Date(YEAR_START);
    const yearEnd = new Date(YEAR_END);
    yearEnd.setHours(23, 59, 59, 999); // End of day

    const maskYear = df.filter(est => {
      if (!est._close) return false;
      return est._close >= yearStart && est._close <= yearEnd;
    });

    const maskNotLost = maskYear.filter(est => {
      return !contains(est._status, 'lost');
    });

    const countset = maskNotLost;
    console.log(`📊 CountSet rows (2025, not lost): ${countset.length}\n`);

    // WonSet: estimates with won statuses
    const wonset = countset.filter(est => isWonStatus(est._status));
    const wonSum = wonset.reduce((sum, est) => sum + (est._price || 0), 0);
    console.log(`📊 WonSet rows: ${wonset.length}, Sum: $${wonSum.toLocaleString()}\n`);

    // Get unique divisions for candidate groups
    const divisions = [...new Set(wonset.map(est => est._division).filter(d => d))].sort();
    console.log(`📊 Found ${divisions.length} unique divisions\n`);

    // Candidate division groups to try
    const DIV_GROUPS = [
      [],  // no blacklist
      ['LE Maintenance (Summer/Winter)'],
      ['LE Maintenance (Summer/Winter)', 'LE Maintenance'],
      // Add more division combinations if needed
    ];

    // Add any maintenance-related divisions found
    const maintenanceDivs = divisions.filter(d => 
      contains(d, 'maintenance') || contains(d, 'Maintenance')
    );
    if (maintenanceDivs.length > 0 && !DIV_GROUPS.some(g => g.length === maintenanceDivs.length && g.every((d, i) => d === maintenanceDivs[i]))) {
      DIV_GROUPS.push(maintenanceDivs);
    }

    // Threshold grids
    const HOUR_THRESHOLDS = [0, 1, 2, 5, 10, 15, 20, 25, 40];
    const PRICE_THRESHOLDS = [25000, 50000, 75000, 100000, 150000, 200000];
    const PPH_THRESHOLDS = [2000, 3000, 5000, 7500, 10000, 15000, 20000]; // $ per hour

    console.log('🔍 Searching for best exclusion rules...\n');
    console.log(`   Testing ${DIV_GROUPS.length} division groups`);
    console.log(`   Testing ${HOUR_THRESHOLDS.length} hour thresholds`);
    console.log(`   Testing ${PRICE_THRESHOLDS.length} price thresholds`);
    console.log(`   Testing ${PPH_THRESHOLDS.length} price-per-hour thresholds`);
    console.log(`   Total combinations: ${DIV_GROUPS.length * HOUR_THRESHOLDS.length * PRICE_THRESHOLDS.length * PPH_THRESHOLDS.length}\n`);

    let best = null;
    let tested = 0;

    for (const divBlacklist of DIV_GROUPS) {
      for (const hourLt of HOUR_THRESHOLDS) {
        for (const priceGt of PRICE_THRESHOLDS) {
          for (const pphGt of PPH_THRESHOLDS) {
            tested++;
            if (tested % 100 === 0) {
              process.stdout.write(`\r   Progress: ${tested}/${DIV_GROUPS.length * HOUR_THRESHOLDS.length * PRICE_THRESHOLDS.length * PPH_THRESHOLDS.length}...`);
            }

            const { kept, excluded } = applyRules(wonset, divBlacklist, hourLt, priceGt, pphGt);
            const s = kept.reduce((sum, est) => sum + (est._price || 0), 0);
            const diff = Math.abs(s - TARGET);

            // Score: smaller diff is better, fewer excluded is better, simpler rules are better
            const score = diff + (excluded.length * 10) + (divBlacklist.length * 1000);

            if (best === null || score < best.score) {
              best = {
                score,
                sum: s,
                diff: s - TARGET,
                div_blacklist: divBlacklist,
                hour_lt: hourLt,
                price_gt: priceGt,
                pph_gt: pphGt,
                excluded_count: excluded.length,
                kept_count: kept.length,
              };
            }
          }
        }
      }
    }

    console.log('\n\n✅ BEST FIT FOUND:\n');
    console.log(`   Sum: $${best.sum.toLocaleString()}`);
    console.log(`   Target: $${TARGET.toLocaleString()}`);
    console.log(`   Difference: $${best.diff.toLocaleString()} (${((best.diff / TARGET) * 100).toFixed(2)}%)`);
    console.log(`   Score: ${best.score.toFixed(2)}`);
    console.log(`   Kept: ${best.kept_count} estimates`);
    console.log(`   Excluded: ${best.excluded_count} estimates`);
    console.log(`\n   Rules:`);
    console.log(`     - Division blacklist: ${best.div_blacklist.length > 0 ? best.div_blacklist.join(', ') : 'None'}`);
    console.log(`     - Exclude if hours < ${best.hour_lt} AND price > $${best.price_gt.toLocaleString()}`);
    console.log(`     - Exclude if price-per-hour > $${best.pph_gt.toLocaleString()}`);

    // Re-run with best rules to export excluded estimates
    const { kept, excluded } = applyRules(wonset, best.div_blacklist, best.hour_lt, best.price_gt, best.pph_gt);
    const finalSum = kept.reduce((sum, est) => sum + (est._price || 0), 0);
    console.log(`\n📊 Final kept sum: $${finalSum.toLocaleString()}, Target: $${TARGET.toLocaleString()}, Delta: $${(finalSum - TARGET).toLocaleString()}`);

    // Export review files
    const keptCsv = [
      ['Estimate ID', 'Estimate #', 'Close Date', 'Status', 'Division', 'Price', 'Hours', 'Price/Hour'].join(','),
      ...kept.map(est => [
        est.lmn_estimate_id || est.id || '',
        est.estimate_number || '',
        est.estimate_close_date || '',
        est.status || '',
        est.division || '',
        est._price || 0,
        est._hours || 0,
        est._hours && est._hours > 0 ? (est._price / est._hours).toFixed(2) : ''
      ].join(','))
    ].join('\n');

    const excludedCsv = [
      ['Estimate ID', 'Estimate #', 'Close Date', 'Status', 'Division', 'Price', 'Hours', 'Price/Hour', 'Exclusion Reason'].join(','),
      ...excluded.map(est => {
        let reason = '';
        if (best.div_blacklist.includes(est._division)) {
          reason = 'Division blacklist';
        } else if ((est._hours || 0) < best.hour_lt && (est._price || 0) > best.price_gt) {
          reason = `Low hours (${est._hours || 0}) + high price ($${(est._price || 0).toLocaleString()})`;
        } else {
          const pph = est._hours && est._hours > 0 ? (est._price / est._hours) : 0;
          if (pph > best.pph_gt) {
            reason = `High price-per-hour ($${pph.toFixed(2)})`;
          }
        }
        return [
          est.lmn_estimate_id || est.id || '',
          est.estimate_number || '',
          est.estimate_close_date || '',
          est.status || '',
          est.division || '',
          est._price || 0,
          est._hours || 0,
          est._hours && est._hours > 0 ? (est._price / est._hours).toFixed(2) : '',
          reason
        ].join(',');
      })
    ].join('\n');

    writeFileSync('won_kept.csv', keptCsv);
    writeFileSync('won_excluded.csv', excludedCsv);
    console.log('\n✅ Wrote won_kept.csv and won_excluded.csv for inspection.');

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

findExclusionRules();

