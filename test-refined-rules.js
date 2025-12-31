#!/usr/bin/env node

/**
 * Test Refined Exclusion Rules
 * 
 * Based on pattern analysis:
 * - 89.6% of estimates we include but LMN excludes are: Maintenance + Service type
 * - 87.0% have version 2026 or 2027
 * 
 * Let's test: Exclude Maintenance + Service type
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

function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  return ['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'won'].includes(statusLower);
}

function contains(s, pat) {
  const regex = new RegExp(pat, 'i');
  return regex.test((s || '').toString().trim());
}

async function testRefinedRules() {
  console.log('🧪 Testing Refined Exclusion Rules\n');
  console.log('='.repeat(60) + '\n');

  // Fetch won estimates (2025, not lost)
  console.log('📥 Fetching estimates...');
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

  console.log(`   Fetched ${allEstimates.length} estimates\n`);

  // Base filter: 2025, not lost, won
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

  console.log(`📊 Base filtered (2025, not lost, won): ${baseFiltered.length}\n`);

  // Test different exclusion rules
  const rules = [
    {
      name: 'Current Rules (PPH > $5k OR Price < $100 OR Zero Hours + Low Price)',
      exclude: (est) => {
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
      }
    },
    {
      name: 'Current + Exclude Maintenance Service',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New rule: Maintenance + Service
        if (division.includes('Maintenance') && type.toLowerCase().includes('service')) {
          return true;
        }
        return false;
      }
    },
    {
      name: 'Current + Exclude Maintenance Version 2026/2027',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const version = (est.version || '').toString().trim();
        
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New rule: Maintenance + Version 2026/2027
        if (division.includes('Maintenance') && (version.includes('2026') || version.includes('2027'))) {
          return true;
        }
        return false;
      }
    },
    {
      name: 'Current + Exclude Maintenance Service OR Version 2026/2027',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const version = (est.version || '').toString().trim();
        
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New rule: Maintenance + (Service OR Version 2026/2027)
        if (division.includes('Maintenance')) {
          if (type.toLowerCase().includes('service') || version.includes('2026') || version.includes('2027')) {
            return true;
          }
        }
        return false;
      }
    },
  ];

  console.log('🧪 Testing Rules:\n');

  let best = null;

  rules.forEach(rule => {
    const kept = baseFiltered.filter(est => !rule.exclude(est));
    const excluded = baseFiltered.filter(est => rule.exclude(est));
    
    const count = kept.length;
    const dollar = kept.reduce((sum, est) => sum + (parseFloat(est.total_price) || 0), 0);
    
    const countDiff = Math.abs(count - TARGET_COUNT);
    const dollarDiff = Math.abs(dollar - TARGET_DOLLAR);
    const countAccuracy = (1 - countDiff / TARGET_COUNT) * 100;
    const dollarAccuracy = (1 - dollarDiff / TARGET_DOLLAR) * 100;
    const combinedAccuracy = (countAccuracy + dollarAccuracy) / 2;
    
    const score = countDiff + (dollarDiff / 1000);
    
    console.log(`${rule.name}:`);
    console.log(`  Count: ${count} (diff: ${countDiff}, ${countAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Dollar: $${dollar.toLocaleString()} (diff: $${dollarDiff.toLocaleString()}, ${dollarAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Combined: ${combinedAccuracy.toFixed(2)}% accurate`);
    console.log(`  Excluded: ${excluded.length} estimates\n`);
    
    if (!best || score < best.score) {
      best = {
        rule: rule.name,
        kept,
        excluded,
        count,
        dollar,
        countDiff,
        dollarDiff,
        countAccuracy,
        dollarAccuracy,
        combinedAccuracy,
        score
      };
    }
  });

  console.log('='.repeat(60));
  console.log('✅ BEST RULE:', best.rule);
  console.log(`   Count: ${best.count} (${best.countAccuracy.toFixed(2)}% accurate)`);
  console.log(`   Dollar: $${best.dollar.toLocaleString()} (${best.dollarAccuracy.toFixed(2)}% accurate)`);
  console.log(`   Combined: ${best.combinedAccuracy.toFixed(2)}% accurate\n`);

  // Export results
  const keptCsv = [
    ['Estimate ID', 'Division', 'Type', 'Version', 'Price', 'Hours', 'PPH'],
    ...best.kept.map(est => {
      const price = parseFloat(est.total_price) || 0;
      const hours = parseFloat(est.labor_hours) || 0;
      const pph = hours > 0 ? (price / hours).toFixed(2) : '';
      return [
        est.lmn_estimate_id || est.estimate_number || '',
        est.division || '',
        est.estimate_type || '',
        est.version || '',
        price,
        hours || '',
        pph
      ];
    })
  ].map(row => row.join(',')).join('\n');

  const excludedCsv = [
    ['Estimate ID', 'Division', 'Type', 'Version', 'Price', 'Hours', 'PPH', 'Exclusion Reason'],
    ...best.excluded.map(est => {
      const price = parseFloat(est.total_price) || 0;
      const hours = parseFloat(est.labor_hours) || 0;
      const pph = hours > 0 ? (price / hours).toFixed(2) : '';
      const division = (est.division || '').toString().trim();
      const type = (est.estimate_type || '').toString().trim();
      const version = (est.version || '').toString().trim();
      
      let reason = '';
      if (price < 100) reason = 'Price < $100';
      else if (hours > 0 && price / hours > 5000) reason = `PPH > $5,000 ($${(price/hours).toFixed(2)}/h)`;
      else if (hours === 0 && price < 1000 && division.includes('Maintenance')) reason = 'Zero hours + low price + Maintenance';
      else if (division.includes('Maintenance') && type.toLowerCase().includes('service')) reason = 'Maintenance + Service type';
      else if (division.includes('Maintenance') && (version.includes('2026') || version.includes('2027'))) reason = `Maintenance + Version ${version}`;
      else reason = 'Other';
      
      return [
        est.lmn_estimate_id || est.estimate_number || '',
        division,
        type,
        version,
        price,
        hours || '',
        pph,
        reason
      ];
    })
  ].map(row => row.join(',')).join('\n');

  writeFileSync('refined_kept.csv', keptCsv);
  writeFileSync('refined_excluded.csv', excludedCsv);
  console.log('✅ Wrote refined_kept.csv and refined_excluded.csv');
}

testRefinedRules();

