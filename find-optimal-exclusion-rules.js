#!/usr/bin/env node

/**
 * Find Optimal Exclusion Rules - Multi-Objective Optimization
 * 
 * This script searches for exclusion rules that best match BOTH:
 * - LMN's "Estimates Sold $" target: $11,050,000
 * - LMN's "Estimates Sold" count target: 927
 * 
 * Uses a multi-objective scoring function that balances dollar accuracy and count accuracy.
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

// Configuration - Based on LMN Exact Exports
const TARGET_DOLLAR = 11_049_470.84;  // LMN "Estimates Sold $" from Sales Pipeline Detail
const TARGET_COUNT = 924;              // LMN "Estimates Sold" count from Sales Pipeline Detail
// LMN Static Period: 1/1/2025 12:00 AM to 12/31/2025 11:59 PM
const PERIOD_START = '2025-01-01T00:00:00';  // 1/1/2025 12:00 AM
const PERIOD_END = '2025-12-31T23:59:59';    // 12/31/2025 11:59 PM

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
 * Calculate multi-objective score
 * Lower score is better
 * Balances dollar accuracy and count accuracy
 */
function calculateScore(actualDollar, actualCount, targetDollar, targetCount, excludedCount, ruleComplexity) {
  // Dollar accuracy (normalized by target)
  const dollarError = Math.abs(actualDollar - targetDollar) / targetDollar;
  
  // Count accuracy (normalized by target)
  const countError = Math.abs(actualCount - targetCount) / targetCount;
  
  // Combined error (weighted equally)
  const combinedError = (dollarError + countError) / 2;
  
  // Penalty for excluding too many (prefer simpler rules)
  const exclusionPenalty = excludedCount * 0.001;
  
  // Penalty for rule complexity (prefer simpler rules)
  const complexityPenalty = ruleComplexity * 0.01;
  
  // Final score
  return (combinedError * 100) + exclusionPenalty + complexityPenalty;
}

/**
 * Apply exclusion rules to a dataset
 */
function applyRules(df, divBlacklist, hourLt, priceGt, pphGt, minPrice, maxPrice) {
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
    if (hourLt === null || priceGt === null) return false;
    return (hours < hourLt) && (price > priceGt);
  });
  
  // Price-per-hour exclusion
  const exclPph = d.map(est => {
    const hours = est._hours || 0;
    const price = est._price || 0;
    if (pphGt === null || hours === 0 || hours === null || hours === undefined) return false;
    const pph = price / hours;
    if (!isFinite(pph)) return false;
    return pph > pphGt;
  });
  
  // Minimum price exclusion
  const exclMinPrice = d.map(est => {
    const price = est._price || 0;
    if (minPrice === null) return false;
    return price < minPrice;
  });
  
  // Maximum price exclusion
  const exclMaxPrice = d.map(est => {
    const price = est._price || 0;
    if (maxPrice === null) return false;
    return price > maxPrice;
  });
  
  // Combine exclusions
  const excluded = d.map((est, idx) => 
    exclDiv[idx] || exclLowHrHighPrice[idx] || exclPph[idx] || exclMinPrice[idx] || exclMaxPrice[idx]
  );
  const kept = d.filter((est, idx) => !excluded[idx]);
  const excludedList = d.filter((est, idx) => excluded[idx]);
  
  return { kept, excluded: excludedList };
}

async function findOptimalRules() {
  console.log('🔍 Finding optimal exclusion rules to match BOTH dollar amount AND count...\n');
  console.log(`Static Period: ${PERIOD_START} to ${PERIOD_END}`);
  console.log(`Target Dollar: $${TARGET_DOLLAR.toLocaleString()} (update from PDF if different)`);
  console.log(`Target Count: ${TARGET_COUNT} (update from PDF if different)\n`);

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

    // Base CountSet: estimates with close_date in static period (1/1/2025 12:00 AM to 12/31/2025 11:59 PM), excluding "Lost" status
    const periodStart = new Date(PERIOD_START);
    const periodEnd = new Date(PERIOD_END);

    const maskPeriod = df.filter(est => {
      if (!est._close) return false;
      // Include estimates where close_date is within the static period
      return est._close >= periodStart && est._close <= periodEnd;
    });

    const maskNotLost = maskPeriod.filter(est => {
      return !contains(est._status, 'lost');
    });

    const countset = maskNotLost;
    console.log(`📊 CountSet rows (static period ${PERIOD_START} to ${PERIOD_END}, not lost): ${countset.length}\n`);

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
    ];

    // Add any maintenance-related divisions found
    const maintenanceDivs = divisions.filter(d => 
      contains(d, 'maintenance') || contains(d, 'Maintenance')
    );
    if (maintenanceDivs.length > 0 && !DIV_GROUPS.some(g => g.length === maintenanceDivs.length && g.every((d, i) => d === maintenanceDivs[i]))) {
      DIV_GROUPS.push(maintenanceDivs);
    }

    // Threshold grids - expanded ranges
    const HOUR_THRESHOLDS = [null, 0, 1, 2, 5, 10, 15, 20, 25, 40];
    const PRICE_THRESHOLDS = [null, 25000, 50000, 75000, 100000, 150000, 200000];
    const PPH_THRESHOLDS = [null, 2000, 3000, 5000, 7500, 10000, 15000, 20000];
    const MIN_PRICE_THRESHOLDS = [null, 100, 500, 1000, 5000];
    const MAX_PRICE_THRESHOLDS = [null, 100000, 200000, 300000, 500000];

    console.log('🔍 Searching for optimal exclusion rules...\n');
    console.log(`   Testing ${DIV_GROUPS.length} division groups`);
    console.log(`   Testing ${HOUR_THRESHOLDS.length} hour thresholds`);
    console.log(`   Testing ${PRICE_THRESHOLDS.length} price thresholds`);
    console.log(`   Testing ${PPH_THRESHOLDS.length} price-per-hour thresholds`);
    console.log(`   Testing ${MIN_PRICE_THRESHOLDS.length} min price thresholds`);
    console.log(`   Testing ${MAX_PRICE_THRESHOLDS.length} max price thresholds`);
    
    const totalCombinations = DIV_GROUPS.length * HOUR_THRESHOLDS.length * PRICE_THRESHOLDS.length * 
                              PPH_THRESHOLDS.length * MIN_PRICE_THRESHOLDS.length * MAX_PRICE_THRESHOLDS.length;
    console.log(`   Total combinations: ${totalCombinations.toLocaleString()}\n`);

    let best = null;
    let tested = 0;
    const topCandidates = [];

    for (const divBlacklist of DIV_GROUPS) {
      for (const hourLt of HOUR_THRESHOLDS) {
        for (const priceGt of PRICE_THRESHOLDS) {
          for (const pphGt of PPH_THRESHOLDS) {
            for (const minPrice of MIN_PRICE_THRESHOLDS) {
              for (const maxPrice of MAX_PRICE_THRESHOLDS) {
                tested++;
                if (tested % 1000 === 0) {
                  process.stdout.write(`\r   Progress: ${tested}/${totalCombinations} (${((tested/totalCombinations)*100).toFixed(1)}%)...`);
                }

                const { kept, excluded } = applyRules(wonset, divBlacklist, hourLt, priceGt, pphGt, minPrice, maxPrice);
                const dollarSum = kept.reduce((sum, est) => sum + (est._price || 0), 0);
                const count = kept.length;
                
                // Calculate rule complexity (number of active rules)
                let complexity = 0;
                if (divBlacklist && divBlacklist.length > 0) complexity++;
                if (hourLt !== null && priceGt !== null) complexity++;
                if (pphGt !== null) complexity++;
                if (minPrice !== null) complexity++;
                if (maxPrice !== null) complexity++;

                const score = calculateScore(dollarSum, count, TARGET_DOLLAR, TARGET_COUNT, excluded.length, complexity);

                // Keep top candidates
                if (topCandidates.length < 20 || score < topCandidates[topCandidates.length - 1].score) {
                  topCandidates.push({
                    score,
                    dollarSum,
                    count,
                    dollarDiff: dollarSum - TARGET_DOLLAR,
                    countDiff: count - TARGET_COUNT,
                    dollarAccuracy: (1 - Math.abs(dollarSum - TARGET_DOLLAR) / TARGET_DOLLAR) * 100,
                    countAccuracy: (1 - Math.abs(count - TARGET_COUNT) / TARGET_COUNT) * 100,
                    div_blacklist: divBlacklist,
                    hour_lt: hourLt,
                    price_gt: priceGt,
                    pph_gt: pphGt,
                    min_price: minPrice,
                    max_price: maxPrice,
                    excluded_count: excluded.length,
                    kept_count: kept.length,
                    complexity,
                  });
                  topCandidates.sort((a, b) => a.score - b.score);
                  if (topCandidates.length > 20) topCandidates.pop();
                }

                if (best === null || score < best.score) {
                  best = {
                    score,
                    dollarSum,
                    count,
                    dollarDiff: dollarSum - TARGET_DOLLAR,
                    countDiff: count - TARGET_COUNT,
                    dollarAccuracy: (1 - Math.abs(dollarSum - TARGET_DOLLAR) / TARGET_DOLLAR) * 100,
                    countAccuracy: (1 - Math.abs(count - TARGET_COUNT) / TARGET_COUNT) * 100,
                    div_blacklist: divBlacklist,
                    hour_lt: hourLt,
                    price_gt: priceGt,
                    pph_gt: pphGt,
                    min_price: minPrice,
                    max_price: maxPrice,
                    excluded_count: excluded.length,
                    kept_count: kept.length,
                    complexity,
                  };
                }
              }
            }
          }
        }
      }
    }

    console.log('\n\n✅ BEST FIT FOUND:\n');
    console.log(`   Dollar Sum: $${best.dollarSum.toLocaleString()}`);
    console.log(`   Dollar Target: $${TARGET_DOLLAR.toLocaleString()}`);
    console.log(`   Dollar Difference: $${best.dollarDiff.toLocaleString()} (${best.dollarAccuracy.toFixed(2)}% accurate)`);
    console.log(`\n   Count: ${best.count}`);
    console.log(`   Count Target: ${TARGET_COUNT}`);
    console.log(`   Count Difference: ${best.countDiff} (${best.countAccuracy.toFixed(2)}% accurate)`);
    console.log(`\n   Combined Score: ${best.score.toFixed(4)} (lower is better)`);
    console.log(`   Kept: ${best.kept_count} estimates`);
    console.log(`   Excluded: ${best.excluded_count} estimates`);
    console.log(`   Rule Complexity: ${best.complexity} active rules`);
    console.log(`\n   Rules:`);
    if (best.div_blacklist && best.div_blacklist.length > 0) {
      console.log(`     - Division blacklist: ${best.div_blacklist.join(', ')}`);
    }
    if (best.hour_lt !== null && best.price_gt !== null) {
      console.log(`     - Exclude if hours < ${best.hour_lt} AND price > $${best.price_gt.toLocaleString()}`);
    }
    if (best.pph_gt !== null) {
      console.log(`     - Exclude if price-per-hour > $${best.pph_gt.toLocaleString()}`);
    }
    if (best.min_price !== null) {
      console.log(`     - Exclude if price < $${best.min_price.toLocaleString()}`);
    }
    if (best.max_price !== null) {
      console.log(`     - Exclude if price > $${best.max_price.toLocaleString()}`);
    }

    // Show top 5 candidates
    console.log(`\n\n📊 TOP 5 CANDIDATES:\n`);
    topCandidates.slice(0, 5).forEach((candidate, idx) => {
      console.log(`${idx + 1}. Score: ${candidate.score.toFixed(4)}`);
      console.log(`   Dollar: $${candidate.dollarSum.toLocaleString()} (${candidate.dollarAccuracy.toFixed(2)}% accurate)`);
      console.log(`   Count: ${candidate.count} (${candidate.countAccuracy.toFixed(2)}% accurate)`);
      console.log(`   Excluded: ${candidate.excluded_count} estimates`);
      console.log(`   Rules: ${candidate.complexity} active`);
      console.log('');
    });

    // Re-run with best to export excluded
    const { kept, excluded } = applyRules(
      wonset, 
      best.div_blacklist, 
      best.hour_lt, 
      best.price_gt, 
      best.pph_gt,
      best.min_price,
      best.max_price
    );
    
    const finalDollar = kept.reduce((sum, est) => sum + (est._price || 0), 0);
    const finalCount = kept.length;
    
    console.log(`\n📊 Final Results:`);
    console.log(`   Kept: ${finalCount} estimates, $${finalDollar.toLocaleString()}`);
    console.log(`   Target: ${TARGET_COUNT} estimates, $${TARGET_DOLLAR.toLocaleString()}`);
    console.log(`   Delta: ${finalCount - TARGET_COUNT} estimates, $${(finalDollar - TARGET_DOLLAR).toLocaleString()}`);

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
        const reasons = [];
        if (best.div_blacklist && best.div_blacklist.includes(est._division)) {
          reasons.push('Division blacklist');
        }
        if (best.hour_lt !== null && best.price_gt !== null && (est._hours || 0) < best.hour_lt && (est._price || 0) > best.price_gt) {
          reasons.push(`Low hours (${est._hours || 0}) + high price ($${(est._price || 0).toLocaleString()})`);
        }
        if (best.pph_gt !== null) {
          const pph = est._hours && est._hours > 0 ? (est._price / est._hours) : 0;
          if (pph > best.pph_gt) {
            reasons.push(`High price-per-hour ($${pph.toFixed(2)})`);
          }
        }
        if (best.min_price !== null && (est._price || 0) < best.min_price) {
          reasons.push(`Price below minimum ($${(est._price || 0).toLocaleString()})`);
        }
        if (best.max_price !== null && (est._price || 0) > best.max_price) {
          reasons.push(`Price above maximum ($${(est._price || 0).toLocaleString()})`);
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
          reasons.join('; ') || 'Unknown'
        ].join(',');
      })
    ].join('\n');

    writeFileSync('optimal_kept.csv', keptCsv);
    writeFileSync('optimal_excluded.csv', excludedCsv);
    console.log('\n✅ Wrote optimal_kept.csv and optimal_excluded.csv for inspection.');

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

findOptimalRules();

