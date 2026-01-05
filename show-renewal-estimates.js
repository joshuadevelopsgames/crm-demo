/**
 * Show all estimates for the 13 accounts that have renewals
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { startOfDay, differenceInDays } from 'date-fns';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function isWonStatus(est) {
  if (est.pipeline_status) {
    const pipelineLower = est.pipeline_status.toString().toLowerCase().trim();
    if (pipelineLower === 'sold' || pipelineLower.includes('sold')) {
      return true;
    }
  }
  if (!est.status) return false;
  const statusLower = est.status.toString().toLowerCase().trim();
  const wonStatuses = ['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'sold', 'won'];
  return wonStatuses.includes(statusLower);
}

function normalizeAddress(address) {
  if (!address) return '';
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeDepartment(division) {
  if (!division) return '';
  return division.trim().toLowerCase();
}

async function showEstimates() {
  const supabase = getSupabase();
  const today = startOfDay(new Date());
  const DAYS_THRESHOLD = 180;
  
  const accounts = [
    { id: 'lmn-account-2412402', name: 'Cushman & Wakefield Stevenson' },
    { id: 'lmn-account-2357360', name: 'Petwin Development Co Ltd' },
    { id: 'lmn-account-8521849', name: 'RioCan' },
    { id: 'lmn-account-4654166', name: 'Xtreme Green' },
    { id: 'lmn-account-2357352', name: 'Connelly & Company Mngmt' },
    { id: 'lmn-account-5301035', name: 'Qualico Commercial' },
    { id: 'lmn-account-2746052', name: 'BentallGreenOak' },
    { id: 'lmn-account-3040624', name: 'Motion Canada' },
    { id: 'lmn-account-3265584', name: 'Legacy Partners' },
    { id: 'lmn-account-3917820', name: 'First Capital Asset Management LP' },
    { id: 'lmn-account-3186753', name: 'Bucci Construction Ltd' },
    { id: 'lmn-account-8147261', name: '525 8 Avenue Southwest' },
    { id: 'lmn-account-6284116', name: 'Synergy Properties Ltd.' }
  ];
  
  console.log('📋 ALL ESTIMATES FOR 13 ACCOUNTS WITH RENEWALS\n');
  console.log('='.repeat(80));
  
  for (const account of accounts) {
    console.log(`\n\n🏢 ${account.name} (${account.id})`);
    console.log('─'.repeat(80));
    
    // Get all estimates with pagination
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('archived', false)
        .eq('account_id', account.id)
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
    
    // Filter won estimates with contract_end
    const wonWithEndDate = allEstimates.filter(est => {
      return isWonStatus(est) && est.contract_end;
    });
    
    // Group by division + address
    const grouped = new Map();
    wonWithEndDate.forEach(est => {
      const dept = normalizeDepartment(est.division);
      const addr = normalizeAddress(est.address);
      const key = `${dept}|${addr}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          division: est.division,
          address: est.address,
          estimates: []
        });
      }
      
      const renewalDate = startOfDay(new Date(est.contract_end));
      const daysUntil = differenceInDays(renewalDate, today);
      
      grouped.get(key).estimates.push({
        id: est.estimate_number || est.lmn_estimate_id || est.id,
        contract_end: est.contract_end,
        daysUntil: daysUntil,
        isAtRisk: daysUntil >= 0 && daysUntil <= DAYS_THRESHOLD,
        isRenewal: daysUntil > DAYS_THRESHOLD
      });
    });
    
    // Sort estimates by contract_end within each group
    grouped.forEach((group, key) => {
      group.estimates.sort((a, b) => {
        const dateA = new Date(a.contract_end);
        const dateB = new Date(b.contract_end);
        return dateA - dateB;
      });
    });
    
    // Display grouped estimates
    let groupNum = 1;
    grouped.forEach((group, key) => {
      const atRiskEsts = group.estimates.filter(e => e.isAtRisk);
      const renewalEsts = group.estimates.filter(e => e.isRenewal);
      
      if (atRiskEsts.length > 0 && renewalEsts.length > 0) {
        console.log(`\n  Group ${groupNum}: ${group.division || 'N/A'} - ${group.address || 'N/A'}`);
        console.log(`    At-Risk Estimates (0-180 days):`);
        atRiskEsts.forEach(est => {
          console.log(`      • ${est.id}: ${est.contract_end} (${est.daysUntil} days) ❌ EXCLUDED - Has renewal`);
        });
        console.log(`    Renewal Estimates (> 180 days):`);
        renewalEsts.forEach(est => {
          console.log(`      • ${est.id}: ${est.contract_end} (${est.daysUntil} days) ✅ RENEWAL`);
        });
        groupNum++;
      }
    });
    
    // Also show any at-risk estimates without renewals (shouldn't happen for these accounts)
    const allAtRisk = wonWithEndDate.filter(est => {
      try {
        const renewalDate = startOfDay(new Date(est.contract_end));
        if (isNaN(renewalDate.getTime())) return false;
        const daysUntil = differenceInDays(renewalDate, today);
        return daysUntil >= 0 && daysUntil <= DAYS_THRESHOLD;
      } catch (e) {
        return false;
      }
    });
    
    const allRenewals = wonWithEndDate.filter(est => {
      try {
        const renewalDate = startOfDay(new Date(est.contract_end));
        if (isNaN(renewalDate.getTime())) return false;
        const daysUntil = differenceInDays(renewalDate, today);
        return daysUntil > DAYS_THRESHOLD;
      } catch (e) {
        return false;
      }
    });
    
    console.log(`\n  Summary: ${allAtRisk.length} at-risk estimates, ${allRenewals.length} renewal estimates`);
  }
  
  console.log('\n\n✅ Complete!\n');
}

showEstimates().catch(console.error);


