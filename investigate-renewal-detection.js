/**
 * Investigate why renewal detection is excluding accounts that should be at-risk
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

async function investigate() {
  const supabase = getSupabase();
  const today = startOfDay(new Date());
  const DAYS_THRESHOLD = 180;
  
  // Test one of the excluded accounts
  const accountId = 'lmn-account-2412402'; // Cushman & Wakefield Stevenson
  
  console.log(`🔍 Investigating account: Cushman & Wakefield Stevenson (${accountId})\n`);
  
  // Get account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();
  
  console.log(`Account: ${account?.name}`);
  console.log(`Archived: ${account?.archived ? 'YES' : 'NO'}\n`);
  
  // Get ALL estimates for this account (with pagination)
  let allEstimates = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('archived', false)
      .eq('account_id', accountId)
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
  
  console.log(`Total non-archived estimates: ${allEstimates.length}\n`);
  
  // Find at-risk estimates (won, with contract_end, 0-180 days)
  const atRiskEstimates = allEstimates.filter(est => {
    if (!isWonStatus(est) || !est.contract_end) return false;
    try {
      const renewalDate = startOfDay(new Date(est.contract_end));
      if (isNaN(renewalDate.getTime())) return false;
      const daysUntil = differenceInDays(renewalDate, today);
      return daysUntil <= DAYS_THRESHOLD && daysUntil >= 0;
    } catch (e) {
      return false;
    }
  });
  
  console.log(`At-risk estimates (0-180 days): ${atRiskEstimates.length}\n`);
  
  atRiskEstimates.forEach(est => {
    const estId = est.estimate_number || est.lmn_estimate_id || est.id;
    const renewalDate = startOfDay(new Date(est.contract_end));
    const daysUntil = differenceInDays(renewalDate, today);
    console.log(`  ${estId}: ${est.contract_end} (${daysUntil} days)`);
    console.log(`    Division: ${est.division || 'N/A'}`);
    console.log(`    Address: ${est.address || 'N/A'}`);
  });
  
  // Check for renewals
  console.log(`\n🔍 Checking for renewals...\n`);
  
  function hasRenewalEstimate(accountEstimates, atRiskEstimate) {
    const atRiskDept = normalizeDepartment(atRiskEstimate.division);
    const atRiskAddress = normalizeAddress(atRiskEstimate.address);
    
    if (!atRiskDept || !atRiskAddress) {
      return false;
    }
    
    const today = startOfDay(new Date());
    
    const renewals = accountEstimates.filter(est => {
      if (!isWonStatus(est) || !est.contract_end) return false;
      
      const estDept = normalizeDepartment(est.division);
      const estAddress = normalizeAddress(est.address);
      
      if (estDept !== atRiskDept || estAddress !== atRiskAddress) return false;
      
      const atRiskDate = new Date(atRiskEstimate.contract_end);
      const estDate = new Date(est.contract_end);
      if (estDate <= atRiskDate) return false;
      
      const estRenewalDate = startOfDay(estDate);
      const daysUntil = differenceInDays(estRenewalDate, today);
      
      return daysUntil > DAYS_THRESHOLD;
    });
    
    return renewals.length > 0;
  }
  
  const validAtRisk = atRiskEstimates.filter(est => {
    const estId = est.estimate_number || est.lmn_estimate_id || est.id;
    const hasRenewal = hasRenewalEstimate(allEstimates, est);
    
    console.log(`\nChecking ${estId}:`);
    console.log(`  Division: ${est.division || 'N/A'}`);
    console.log(`  Address: ${est.address || 'N/A'}`);
    
    if (hasRenewal) {
      console.log(`  ❌ EXCLUDED - Has renewal`);
      
      // Find the renewal
      const atRiskDept = normalizeDepartment(est.division);
      const atRiskAddress = normalizeAddress(est.address);
      const atRiskDate = new Date(est.contract_end);
      
      const renewal = allEstimates.find(est2 => {
        if (!isWonStatus(est2) || !est2.contract_end) return false;
        const est2Dept = normalizeDepartment(est2.division);
        const est2Address = normalizeAddress(est2.address);
        if (est2Dept !== atRiskDept || est2Address !== atRiskAddress) return false;
        const est2Date = new Date(est2.contract_end);
        if (est2Date <= atRiskDate) return false;
        const est2RenewalDate = startOfDay(est2Date);
        const daysUntil = differenceInDays(est2RenewalDate, today);
        return daysUntil > DAYS_THRESHOLD;
      });
      
      if (renewal) {
        const renewalId = renewal.estimate_number || renewal.lmn_estimate_id || renewal.id;
        const renewalDate = startOfDay(new Date(renewal.contract_end));
        const renewalDays = differenceInDays(renewalDate, today);
        console.log(`  Renewal found: ${renewalId}`);
        console.log(`    Contract End: ${renewal.contract_end}`);
        console.log(`    Days Until: ${renewalDays}`);
        console.log(`    Division: ${renewal.division || 'N/A'}`);
        console.log(`    Address: ${renewal.address || 'N/A'}`);
      }
    } else {
      console.log(`  ✅ INCLUDED - No renewal`);
    }
    
    return !hasRenewal;
  });
  
  console.log(`\n\n📊 RESULT:`);
  console.log(`  Valid at-risk estimates: ${validAtRisk.length}`);
  if (validAtRisk.length > 0) {
    console.log(`  ✅ Account SHOULD be at-risk`);
  } else {
    console.log(`  ❌ Account is EXCLUDED (all estimates have renewals)`);
  }
}

investigate().catch(console.error);

