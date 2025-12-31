#!/usr/bin/env node

/**
 * Find Precise LMN Exclusion Rule
 * 
 * We know 69 of 77 estimates we include but LMN excludes are:
 * - Maintenance division
 * - Service type
 * 
 * But excluding ALL Maintenance Service is too aggressive.
 * Let's find the precise pattern within those 69.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

// Load env
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
} catch (e) {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TARGET_COUNT = 924;
const TARGET_DOLLAR = 11_049_470.84;

function normalizeId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase();
}

function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  return ['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'won'].includes(statusLower);
}

function contains(s, pat) {
  const regex = new RegExp(pat, 'i');
  return regex.test((s || '').toString().trim());
}

async function findPreciseRule() {
  console.log('🔍 Finding Precise LMN Exclusion Rule\n');
  console.log('='.repeat(60) + '\n');

  // Read comparison to get the exact 77 estimates
  const comparisonCsv = readFileSync('lmn_vs_our_detailed_comparison.csv', 'utf-8');
  const weIncludeButLMNExcludes = [];
  
  comparisonCsv.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const [id, inOur, inLMN] = line.split(',');
    if (inOur === 'Yes' && inLMN === 'No') {
      weIncludeButLMNExcludes.push(normalizeId(id));
    }
  });

  console.log(`📊 Found ${weIncludeButLMNExcludes.length} estimates we include but LMN excludes\n`);

  // Get full data for these estimates
  const { data: estimates } = await supabase
    .from('estimates')
    .select('*')
    .in('lmn_estimate_id', weIncludeButLMNExcludes);

  const estimateMap = new Map();
  if (estimates) {
    estimates.forEach(est => {
      const id = normalizeId(est.lmn_estimate_id || est.estimate_number);
      if (id) {
        estimateMap.set(id, est);
      }
    });
  }

  console.log(`   Found ${estimateMap.size} in database\n`);

  // Analyze the 69 Maintenance Service estimates
  const maintenanceService = Array.from(estimateMap.values()).filter(est => {
    const division = (est.division || '').toString().trim();
    const type = (est.estimate_type || '').toString().trim();
    return division.includes('Maintenance') && type.toLowerCase().includes('service');
  });

  console.log(`📊 Analyzing ${maintenanceService.length} Maintenance Service estimates:\n`);

  // Group by characteristics
  const byVersion = {};
  const byHours = { '0': 0, '1-5': 0, '6-15': 0, '16-25': 0, '26+': 0 };
  const byPrice = { '0-5k': 0, '5k-10k': 0, '10k-25k': 0, '25k-50k': 0, '50k+': 0 };
  const byPPH = { '0-1000': 0, '1000-2000': 0, '2000-3000': 0, '3000-4000': 0, '4000-5000': 0, '5000+': 0 };
  const byDate = {};

  maintenanceService.forEach(est => {
    const version = (est.version || '').toString().trim();
    byVersion[version] = (byVersion[version] || 0) + 1;

    const hours = parseFloat(est.labor_hours) || 0;
    if (hours === 0) byHours['0']++;
    else if (hours <= 5) byHours['1-5']++;
    else if (hours <= 15) byHours['6-15']++;
    else if (hours <= 25) byHours['16-25']++;
    else byHours['26+']++;

    const price = parseFloat(est.total_price) || 0;
    if (price < 5000) byPrice['0-5k']++;
    else if (price < 10000) byPrice['5k-10k']++;
    else if (price < 25000) byPrice['10k-25k']++;
    else if (price < 50000) byPrice['25k-50k']++;
    else byPrice['50k+']++;

    const pph = hours > 0 ? price / hours : 0;
    if (pph === 0) byPPH['0-1000']++;
    else if (pph < 1000) byPPH['0-1000']++;
    else if (pph < 2000) byPPH['1000-2000']++;
    else if (pph < 3000) byPPH['2000-3000']++;
    else if (pph < 4000) byPPH['3000-4000']++;
    else if (pph < 5000) byPPH['4000-5000']++;
    else byPPH['5000+']++;

    if (est.estimate_close_date) {
      const date = new Date(est.estimate_close_date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      byDate[monthYear] = (byDate[monthYear] || 0) + 1;
    }
  });

  console.log('By Version:');
  Object.entries(byVersion)
    .sort((a, b) => b[1] - a[1])
    .forEach(([version, count]) => {
      console.log(`  ${version || '(empty)'}: ${count}`);
    });

  console.log('\nBy Hours:');
  Object.entries(byHours).forEach(([range, count]) => {
    if (count > 0) console.log(`  ${range}: ${count}`);
  });

  console.log('\nBy Price:');
  Object.entries(byPrice).forEach(([range, count]) => {
    if (count > 0) console.log(`  $${range}: ${count}`);
  });

  console.log('\nBy Price-Per-Hour:');
  Object.entries(byPPH).forEach(([range, count]) => {
    if (count > 0) console.log(`  $${range}/h: ${count}`);
  });

  console.log('\nBy Month (Close Date):');
  Object.entries(byDate)
    .sort((a, b) => b[1] - a[1])
    .forEach(([month, count]) => {
      console.log(`  ${month}: ${count}`);
    });

  // Find the most specific pattern
  console.log('\n\n🎯 Finding Most Specific Pattern:\n');

  // Pattern 1: Version 2026 or 2027
  const version2026or2027 = maintenanceService.filter(est => {
    const version = (est.version || '').toString().trim();
    return version.includes('2026') || version.includes('2027');
  });
  console.log(`Maintenance Service + Version 2026/2027: ${version2026or2027.length} estimates`);

  // Pattern 2: Zero hours
  const zeroHours = maintenanceService.filter(est => (parseFloat(est.labor_hours) || 0) === 0);
  console.log(`Maintenance Service + Zero Hours: ${zeroHours.length} estimates`);

  // Pattern 3: Version 2026/2027 OR Zero Hours
  const versionOrZeroHours = maintenanceService.filter(est => {
    const version = (est.version || '').toString().trim();
    const hours = parseFloat(est.labor_hours) || 0;
    return (version.includes('2026') || version.includes('2027')) || hours === 0;
  });
  console.log(`Maintenance Service + (Version 2026/2027 OR Zero Hours): ${versionOrZeroHours.length} estimates`);

  // Pattern 4: Specific months (March/February)
  const marchOrFeb = maintenanceService.filter(est => {
    if (!est.estimate_close_date) return false;
    const date = new Date(est.estimate_close_date);
    return date.getFullYear() === 2025 && (date.getMonth() === 1 || date.getMonth() === 2); // Feb or Mar
  });
  console.log(`Maintenance Service + March/February 2025: ${marchOrFeb.length} estimates`);

  // Pattern 5: Version 2026/2027 AND (Zero Hours OR March/February)
  const combo1 = maintenanceService.filter(est => {
    const version = (est.version || '').toString().trim();
    const hours = parseFloat(est.labor_hours) || 0;
    const hasVersion = version.includes('2026') || version.includes('2027');
    
    if (!hasVersion) return false;
    
    if (hours === 0) return true;
    if (est.estimate_close_date) {
      const date = new Date(est.estimate_close_date);
      if (date.getFullYear() === 2025 && (date.getMonth() === 1 || date.getMonth() === 2)) {
        return true;
      }
    }
    return false;
  });
  console.log(`Maintenance Service + Version 2026/2027 + (Zero Hours OR Mar/Feb): ${combo1.length} estimates`);

  // Test which pattern matches best
  console.log('\n🧪 Testing Patterns Against Full Dataset:\n');

  // Fetch all won estimates
  let allEstimates = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allEstimates = allEstimates.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  const periodStart = new Date('2025-01-01T00:00:00');
  const periodEnd = new Date('2025-12-31T23:59:59');

  const baseFiltered = allEstimates.filter(est => {
    if (!est.estimate_close_date) return false;
    const closeDate = new Date(est.estimate_close_date);
    if (closeDate < periodStart || closeDate > periodEnd) return false;
    
    const status = (est.status || '').toString().toLowerCase().trim();
    if (contains(status, 'lost')) return false;
    if (!isWonStatus(est.status)) return false;
    
    return true;
  });

  // Test patterns
  const patterns = [
    {
      name: 'Maintenance Service + Version 2026/2027',
      exclude: (est) => {
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const version = (est.version || '').toString().trim();
        return division.includes('Maintenance') && 
               type.toLowerCase().includes('service') &&
               (version.includes('2026') || version.includes('2027'));
      }
    },
    {
      name: 'Maintenance Service + Zero Hours',
      exclude: (est) => {
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const hours = parseFloat(est.labor_hours) || 0;
        return division.includes('Maintenance') && 
               type.toLowerCase().includes('service') &&
               hours === 0;
      }
    },
    {
      name: 'Maintenance Service + (Version 2026/2027 OR Zero Hours)',
      exclude: (est) => {
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const version = (est.version || '').toString().trim();
        const hours = parseFloat(est.labor_hours) || 0;
        return division.includes('Maintenance') && 
               type.toLowerCase().includes('service') &&
               ((version.includes('2026') || version.includes('2027')) || hours === 0);
      }
    },
    {
      name: 'Maintenance Service + Version 2026/2027 + (Zero Hours OR Mar/Feb)',
      exclude: (est) => {
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const version = (est.version || '').toString().trim();
        const hours = parseFloat(est.labor_hours) || 0;
        
        if (!division.includes('Maintenance') || !type.toLowerCase().includes('service')) {
          return false;
        }
        
        const hasVersion = version.includes('2026') || version.includes('2027');
        if (!hasVersion) return false;
        
        if (hours === 0) return true;
        if (est.estimate_close_date) {
          const date = new Date(est.estimate_close_date);
          if (date.getFullYear() === 2025 && (date.getMonth() === 1 || date.getMonth() === 2)) {
            return true;
          }
        }
        return false;
      }
    },
  ];

  // Apply current base rules first
  const currentBaseRules = (est) => {
    const price = parseFloat(est.total_price) || 0;
    const hours = parseFloat(est.labor_hours) || 0;
    const division = (est.division || '').toString().trim();
    
    if (price < 100) return true;
    if (hours > 0) {
      const pph = price / hours;
      if (pph > 5000) return true;
    }
    if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
      return true;
    }
    return false;
  };

  patterns.forEach(pattern => {
    const kept = baseFiltered.filter(est => !currentBaseRules(est) && !pattern.exclude(est));
    const excluded = baseFiltered.filter(est => currentBaseRules(est) || pattern.exclude(est));
    
    const count = kept.length;
    const dollar = kept.reduce((sum, est) => sum + (parseFloat(est.total_price) || 0), 0);
    
    const countDiff = Math.abs(count - TARGET_COUNT);
    const dollarDiff = Math.abs(dollar - TARGET_DOLLAR);
    const countAccuracy = (1 - countDiff / TARGET_COUNT) * 100;
    const dollarAccuracy = (1 - dollarDiff / TARGET_DOLLAR) * 100;
    const combinedAccuracy = (countAccuracy + dollarAccuracy) / 2;
    
    console.log(`${pattern.name}:`);
    console.log(`  Count: ${count} (diff: ${countDiff}, ${countAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Dollar: $${dollar.toLocaleString()} (diff: $${dollarDiff.toLocaleString()}, ${dollarAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Combined: ${combinedAccuracy.toFixed(2)}% accurate`);
    console.log(`  Excluded by this rule: ${baseFiltered.filter(est => !currentBaseRules(est) && pattern.exclude(est)).length}\n`);
  });
}

findPreciseRule();

