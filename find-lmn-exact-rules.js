#!/usr/bin/env node

/**
 * Find LMN's Exact Exclusion Rules
 * 
 * Based on the patterns found, let's test specific hypotheses:
 * 1. Version-based exclusions (2026, 2027 versions?)
 * 2. Date-based exclusions (March/February clustering?)
 * 3. Service type exclusions in Maintenance?
 * 4. Zero hours in Maintenance?
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
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

function normalizeId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase();
}

async function findExactRules() {
  console.log('🔍 Finding LMN\'s Exact Exclusion Rules\n');
  console.log('='.repeat(60) + '\n');

  // Read our comparison
  const comparisonCsv = readFileSync('lmn_vs_our_detailed_comparison.csv', 'utf-8');
  const weIncludeButLMNExcludes = [];
  const lmnIncludesButWeExclude = [];
  
  comparisonCsv.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const [id, inOur, inLMN, division, price, hours, pph, why] = line.split(',');
    if (inOur === 'Yes' && inLMN === 'No') {
      weIncludeButLMNExcludes.push({ id, division, price: parseFloat(price) || 0, hours: hours ? parseFloat(hours) : 0 });
    } else if (inOur === 'No' && inLMN === 'Yes') {
      lmnIncludesButWeExclude.push({ id, division, price: parseFloat(price) || 0, hours: hours ? parseFloat(hours) : 0 });
    }
  });

  console.log(`📊 Analyzing ${weIncludeButLMNExcludes.length} estimates we include but LMN excludes\n`);

  // Get full data from database
  const ids = weIncludeButLMNExcludes.map(e => e.id);
  const { data: estimates } = await supabase
    .from('estimates')
    .select('*')
    .in('lmn_estimate_id', ids);

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

  // Analyze patterns
  const patterns = {
    version2026: [],
    version2027: [],
    serviceType: [],
    zeroHours: [],
    march2025: [],
    feb2025: [],
    maintenanceService: [],
    maintenanceZeroHours: [],
  };

  weIncludeButLMNExcludes.forEach(est => {
    const dbEst = estimateMap.get(est.id);
    if (!dbEst) return;

    const version = (dbEst.version || '').toString().trim();
    const type = (dbEst.estimate_type || '').toString().trim();
    const division = (dbEst.division || '').toString().trim();
    const hours = parseFloat(dbEst.labor_hours) || 0;
    const closeDate = dbEst.estimate_close_date;

    if (version.includes('2026')) {
      patterns.version2026.push({ id: est.id, version, type, division, hours });
    }
    if (version.includes('2027')) {
      patterns.version2027.push({ id: est.id, version, type, division, hours });
    }
    if (type.toLowerCase().includes('service')) {
      patterns.serviceType.push({ id: est.id, version, type, division, hours });
    }
    if (hours === 0) {
      patterns.zeroHours.push({ id: est.id, version, type, division });
    }
    if (closeDate) {
      const date = new Date(closeDate);
      if (date.getFullYear() === 2025 && date.getMonth() === 2) { // March (0-indexed)
        patterns.march2025.push({ id: est.id, version, type, division, hours, date: closeDate });
      }
      if (date.getFullYear() === 2025 && date.getMonth() === 1) { // February
        patterns.feb2025.push({ id: est.id, version, type, division, hours, date: closeDate });
      }
    }
    if (division.includes('Maintenance') && type.toLowerCase().includes('service')) {
      patterns.maintenanceService.push({ id: est.id, version, type, division, hours });
    }
    if (division.includes('Maintenance') && hours === 0) {
      patterns.maintenanceZeroHours.push({ id: est.id, version, type, division });
    }
  });

  console.log('📊 Pattern Analysis:\n');
  console.log(`Version 2026: ${patterns.version2026.length} estimates`);
  console.log(`Version 2027: ${patterns.version2027.length} estimates`);
  console.log(`Service Type: ${patterns.serviceType.length} estimates`);
  console.log(`Zero Hours: ${patterns.zeroHours.length} estimates`);
  console.log(`March 2025: ${patterns.march2025.length} estimates`);
  console.log(`February 2025: ${patterns.feb2025.length} estimates`);
  console.log(`Maintenance + Service: ${patterns.maintenanceService.length} estimates`);
  console.log(`Maintenance + Zero Hours: ${patterns.maintenanceZeroHours.length} estimates\n`);

  // Test hypotheses
  console.log('🧪 Testing Exclusion Hypotheses:\n');

  // Hypothesis 1: Exclude Maintenance estimates with version 2026 or 2027
  const versionExclude = patterns.version2026.length + patterns.version2027.length;
  console.log(`Hypothesis 1: Exclude Maintenance with version 2026/2027`);
  console.log(`   Would exclude: ${versionExclude} estimates`);
  console.log(`   Coverage: ${((versionExclude / weIncludeButLMNExcludes.length) * 100).toFixed(1)}%\n`);

  // Hypothesis 2: Exclude Maintenance Service type
  console.log(`Hypothesis 2: Exclude Maintenance Service type`);
  console.log(`   Would exclude: ${patterns.maintenanceService.length} estimates`);
  console.log(`   Coverage: ${((patterns.maintenanceService.length / weIncludeButLMNExcludes.length) * 100).toFixed(1)}%\n`);

  // Hypothesis 3: Exclude Maintenance with zero hours
  console.log(`Hypothesis 3: Exclude Maintenance with zero hours`);
  console.log(`   Would exclude: ${patterns.maintenanceZeroHours.length} estimates`);
  console.log(`   Coverage: ${((patterns.maintenanceZeroHours.length / weIncludeButLMNExcludes.length) * 100).toFixed(1)}%\n`);

  // Hypothesis 4: Exclude Maintenance Service with version 2026/2027
  const maintenanceServiceVersion = patterns.maintenanceService.filter(p => 
    p.version.includes('2026') || p.version.includes('2027')
  );
  console.log(`Hypothesis 4: Exclude Maintenance Service with version 2026/2027`);
  console.log(`   Would exclude: ${maintenanceServiceVersion.length} estimates`);
  console.log(`   Coverage: ${((maintenanceServiceVersion.length / weIncludeButLMNExcludes.length) * 100).toFixed(1)}%\n`);

  // Show examples
  console.log('📋 Examples of estimates we include but LMN excludes:\n');
  
  if (patterns.version2026.length > 0) {
    console.log('Version 2026 examples:');
    patterns.version2026.slice(0, 5).forEach(p => {
      console.log(`  ${p.id}: ${p.division}, Type: ${p.type}, Version: ${p.version}, Hours: ${p.hours}`);
    });
    console.log('');
  }

  if (patterns.maintenanceService.length > 0) {
    console.log('Maintenance Service examples:');
    patterns.maintenanceService.slice(0, 5).forEach(p => {
      console.log(`  ${p.id}: ${p.division}, Type: ${p.type}, Version: ${p.version}, Hours: ${p.hours}`);
    });
    console.log('');
  }

  // Check for combination rules
  console.log('🔍 Checking for Combination Rules:\n');
  
  // Rule: Maintenance + Service + (Version 2026/2027 OR Zero Hours)
  const combo1 = patterns.maintenanceService.filter(p => 
    (p.version.includes('2026') || p.version.includes('2027')) || p.hours === 0
  );
  console.log(`Maintenance + Service + (Version 2026/2027 OR Zero Hours): ${combo1.length} estimates`);
  console.log(`  Coverage: ${((combo1.length / weIncludeButLMNExcludes.length) * 100).toFixed(1)}%\n`);

  // Rule: Maintenance + (Version 2026/2027) + Zero Hours
  const combo2 = patterns.maintenanceZeroHours.filter(p => {
    const est = estimateMap.get(p.id);
    if (!est) return false;
    const version = (est.version || '').toString().trim();
    return version.includes('2026') || version.includes('2027');
  });
  console.log(`Maintenance + Version 2026/2027 + Zero Hours: ${combo2.length} estimates`);
  console.log(`  Coverage: ${((combo2.length / weIncludeButLMNExcludes.length) * 100).toFixed(1)}%\n`);

  // Final recommendation
  console.log('='.repeat(60));
  console.log('💡 RECOMMENDED ADDITIONAL EXCLUSION RULES:\n');
  
  if (combo1.length >= 60) {
    console.log('✅ Rule: Exclude Maintenance + Service + (Version 2026/2027 OR Zero Hours)');
    console.log(`   This would exclude ${combo1.length} estimates (${((combo1.length / weIncludeButLMNExcludes.length) * 100).toFixed(1)}% coverage)\n`);
  }
  
  if (patterns.maintenanceService.length >= 60) {
    console.log('✅ Rule: Exclude Maintenance + Service type');
    console.log(`   This would exclude ${patterns.maintenanceService.length} estimates (${((patterns.maintenanceService.length / weIncludeButLMNExcludes.length) * 100).toFixed(1)}% coverage)\n`);
  }
  
  if (versionExclude >= 60) {
    console.log('✅ Rule: Exclude Maintenance with version 2026 or 2027');
    console.log(`   This would exclude ${versionExclude} estimates (${((versionExclude / weIncludeButLMNExcludes.length) * 100).toFixed(1)}% coverage)\n`);
  }
}

findExactRules();

