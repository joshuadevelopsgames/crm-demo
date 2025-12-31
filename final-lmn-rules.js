#!/usr/bin/env node

/**
 * Final LMN Exclusion Rules - Exact Match
 * 
 * Based on exact comparison:
 * - LMN excludes: 85 Maintenance + Service (56 with version 2026, 21 with version 2027)
 * - LMN includes: 45 Maintenance with 1-2 hours and price $1000+ (even with high PPH)
 * 
 * Let's find the exact rule that produces LMN's 924 estimates.
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
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

async function findFinalRules() {
  console.log('🎯 Finding Final LMN Exclusion Rules for Exact Match\n');
  console.log('='.repeat(60) + '\n');

  // Get LMN's exact list
  const lmnWorkbook = XLSX.readFile('/Users/joshua/Downloads/Estimate List - Detailed Export.xlsx');
  const lmnSheet = lmnWorkbook.Sheets[lmnWorkbook.SheetNames[0]];
  const lmnRows = XLSX.utils.sheet_to_json(lmnSheet, { header: 1, defval: null });

  const lmnHeaders = lmnRows[0];
  const idCol = lmnHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
  const statusCol = lmnHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));

  const lmnSoldIds = new Set();
  for (let i = 1; i < lmnRows.length; i++) {
    const row = lmnRows[i];
    if (!row || row.length === 0) continue;
    
    const status = (row[statusCol] || '').toString().toLowerCase().trim();
    if (status.includes('sold') || 
        status === 'contract signed' ||
        status === 'work complete' ||
        status === 'billing complete') {
      
      const id = normalizeId(row[idCol]);
      if (id) lmnSoldIds.add(id);
    }
  }

  console.log(`📊 LMN's exact list: ${lmnSoldIds.size} estimates\n`);

  // Fetch our estimates
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

  console.log(`📊 Base filtered: ${baseFiltered.length} estimates\n`);

  // Test refined rules
  const rules = [
    {
      name: 'Rule 1: Base + Maintenance Service Version 2026/2027',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const version = (est.version || '').toString().trim();
        
        // Base rules
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New: Maintenance Service with Version 2026/2027
        if (division.includes('Maintenance') && 
            type.toLowerCase().includes('service') &&
            (version.includes('2026') || version.includes('2027'))) {
          return true;
        }
        return false;
      }
    },
    {
      name: 'Rule 2: Base + Maintenance Service (all, but allow 1-2 hours with price > $1k)',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        
        // Base rules
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New: Maintenance Service, BUT allow if 1-2 hours and price > $1k
        if (division.includes('Maintenance') && type.toLowerCase().includes('service')) {
          // Allow if 1-2 hours and price > $1k (LMN includes these)
          if (hours >= 1 && hours <= 2 && price >= 1000) {
            return false; // Don't exclude
          }
          return true; // Exclude all other Maintenance Service
        }
        return false;
      }
    },
    {
      name: 'Rule 3: Base + Maintenance Service Version 2026/2027 (but allow 1-2 hours)',
      exclude: (est) => {
        const price = parseFloat(est.total_price) || 0;
        const hours = parseFloat(est.labor_hours) || 0;
        const division = (est.division || '').toString().trim();
        const type = (est.estimate_type || '').toString().trim();
        const version = (est.version || '').toString().trim();
        
        // Base rules
        if (price < 100) return true;
        if (hours > 0) {
          const pph = price / hours;
          if (pph > 5000) return true;
        }
        if (hours === 0 && price < 1000 && division.includes('Maintenance')) {
          return true;
        }
        // New: Maintenance Service with Version 2026/2027, BUT allow if 1-2 hours
        if (division.includes('Maintenance') && 
            type.toLowerCase().includes('service') &&
            (version.includes('2026') || version.includes('2027'))) {
          // Allow if 1-2 hours (LMN includes these)
          if (hours >= 1 && hours <= 2) {
            return false;
          }
          return true;
        }
        return false;
      }
    },
  ];

  console.log('🧪 Testing Refined Rules:\n');

  let best = null;

  rules.forEach(rule => {
    const kept = baseFiltered.filter(est => !rule.exclude(est));
    const keptIds = new Set(kept.map(est => normalizeId(est.lmn_estimate_id || est.estimate_number)));
    
    // Check match with LMN
    let matches = 0;
    let weHaveButLMNDoesnt = 0;
    let lmnHasButWeDont = 0;
    
    keptIds.forEach(id => {
      if (lmnSoldIds.has(id)) matches++;
      else weHaveButLMNDoesnt++;
    });
    
    lmnSoldIds.forEach(id => {
      if (!keptIds.has(id)) lmnHasButWeDont++;
    });
    
    const count = kept.length;
    const dollar = kept.reduce((sum, est) => sum + (parseFloat(est.total_price) || 0), 0);
    
    const countDiff = Math.abs(count - TARGET_COUNT);
    const dollarDiff = Math.abs(dollar - TARGET_DOLLAR);
    const countAccuracy = (1 - countDiff / TARGET_COUNT) * 100;
    const dollarAccuracy = (1 - dollarDiff / TARGET_DOLLAR) * 100;
    const combinedAccuracy = (countAccuracy + dollarAccuracy) / 2;
    const matchAccuracy = (matches / TARGET_COUNT) * 100;
    
    const score = countDiff + (dollarDiff / 1000) - (matches * 10); // Favor matching LMN's exact list
    
    console.log(`${rule.name}:`);
    console.log(`  Count: ${count} (target: ${TARGET_COUNT}, diff: ${countDiff}, ${countAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Dollar: $${dollar.toLocaleString()} (target: $${TARGET_DOLLAR.toLocaleString()}, diff: $${dollarDiff.toLocaleString()}, ${dollarAccuracy.toFixed(2)}% accurate)`);
    console.log(`  Matches LMN list: ${matches} estimates (${matchAccuracy.toFixed(2)}% match)`);
    console.log(`  We have but LMN doesn't: ${weHaveButLMNDoesnt}`);
    console.log(`  LMN has but we don't: ${lmnHasButWeDont}`);
    console.log(`  Combined: ${combinedAccuracy.toFixed(2)}% accurate\n`);
    
    if (!best || score < best.score) {
      best = {
        rule: rule.name,
        kept,
        count,
        dollar,
        countDiff,
        dollarDiff,
        countAccuracy,
        dollarAccuracy,
        combinedAccuracy,
        matchAccuracy,
        matches,
        weHaveButLMNDoesnt,
        lmnHasButWeDont,
        score
      };
    }
  });

  console.log('='.repeat(60));
  console.log('✅ BEST RULE:', best.rule);
  console.log(`   Count: ${best.count} (${best.countAccuracy.toFixed(2)}% accurate)`);
  console.log(`   Dollar: $${best.dollar.toLocaleString()} (${best.dollarAccuracy.toFixed(2)}% accurate)`);
  console.log(`   Matches LMN list: ${best.matches} (${best.matchAccuracy.toFixed(2)}% match)`);
  console.log(`   Combined: ${best.combinedAccuracy.toFixed(2)}% accurate\n`);

  // Analyze remaining differences
  if (best.weHaveButLMNDoesnt > 0 || best.lmnHasButWeDont > 0) {
    console.log('🔍 Remaining Differences:\n');
    console.log(`   We include but LMN excludes: ${best.weHaveButLMNDoesnt} estimates`);
    console.log(`   LMN includes but we exclude: ${best.lmnHasButWeDont} estimates\n`);
    
    // Get data for remaining differences
    const ourKeptIds = new Set(best.kept.map(est => normalizeId(est.lmn_estimate_id || est.estimate_number)));
    const weHaveIds = Array.from(ourKeptIds).filter(id => !lmnSoldIds.has(id));
    const lmnHasIds = Array.from(lmnSoldIds).filter(id => !ourKeptIds.has(id));
    
    if (weHaveIds.length > 0) {
      const { data: weHaveData } = await supabase
        .from('estimates')
        .select('*')
        .in('lmn_estimate_id', weHaveIds.slice(0, 50)); // Limit to avoid too many queries
      
      if (weHaveData && weHaveData.length > 0) {
        console.log(`   Analyzing ${Math.min(weHaveIds.length, 50)} estimates we include but LMN excludes:\n`);
        const patterns = {
          maintenanceService: 0,
          maintenanceVersion2026or2027: 0,
          maintenanceZeroHours: 0,
          other: 0,
        };
        
        weHaveData.forEach(est => {
          const division = (est.division || '').toString().trim();
          const type = (est.estimate_type || '').toString().trim();
          const version = (est.version || '').toString().trim();
          const hours = parseFloat(est.labor_hours) || 0;
          
          if (division.includes('Maintenance') && type.toLowerCase().includes('service')) {
            patterns.maintenanceService++;
            if (version.includes('2026') || version.includes('2027')) {
              patterns.maintenanceVersion2026or2027++;
            }
            if (hours === 0) {
              patterns.maintenanceZeroHours++;
            }
          } else {
            patterns.other++;
          }
        });
        
        console.log(`     Maintenance Service: ${patterns.maintenanceService}`);
        console.log(`     Maintenance Service + Version 2026/2027: ${patterns.maintenanceVersion2026or2027}`);
        console.log(`     Maintenance Service + Zero Hours: ${patterns.maintenanceZeroHours}`);
        console.log(`     Other: ${patterns.other}\n`);
      }
    }
  }
}

findFinalRules();

