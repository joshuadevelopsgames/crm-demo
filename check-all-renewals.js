/**
 * Check all 13 accounts with renewals to see the pattern
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

async function checkAll() {
  const supabase = getSupabase();
  const today = startOfDay(new Date());
  const DAYS_THRESHOLD = 180;
  
  const accountIds = [
    'lmn-account-2412402', // Cushman & Wakefield Stevenson
    'lmn-account-2357360', // Petwin Development Co Ltd
    'lmn-account-8521849', // RioCan
    'lmn-account-4654166', // Xtreme Green
    'lmn-account-2357352', // Connelly & Company Mngmt
    'lmn-account-5301035', // Qualico Commercial
    'lmn-account-2746052', // BentallGreenOak
    'lmn-account-3040624', // Motion Canada
    'lmn-account-3265584', // Legacy Partners
    'lmn-account-3917820', // First Capital Asset Management LP
    'lmn-account-3186753', // Bucci Construction Ltd
    'lmn-account-8147261', // 525 8 Avenue Southwest
    'lmn-account-6284116'  // Synergy Properties Ltd.
  ];
  
  console.log('🔍 Checking all 13 accounts with renewals\n');
  console.log('='.repeat(80));
  
  for (const accountId of accountIds) {
    // Get account name
    const { data: account } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .single();
    
    console.log(`\n📋 ${account?.name || accountId}:`);
    
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
    
    // Find at-risk estimates
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
    
    console.log(`   At-risk estimates: ${atRiskEstimates.length}`);
    
    // Check for renewals
    function hasRenewalEstimate(accountEstimates, atRiskEstimate) {
      const atRiskDept = normalizeDepartment(atRiskEstimate.division);
      const atRiskAddress = normalizeAddress(atRiskEstimate.address);
      
      if (!atRiskDept || !atRiskAddress) return false;
      
      return accountEstimates.some(est => {
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
    }
    
    const validAtRisk = atRiskEstimates.filter(est => {
      return !hasRenewalEstimate(allEstimates, est);
    });
    
    if (validAtRisk.length === 0 && atRiskEstimates.length > 0) {
      console.log(`   ❌ All ${atRiskEstimates.length} at-risk estimates have renewals`);
      
      // Show one example
      const example = atRiskEstimates[0];
      const exampleId = example.estimate_number || example.lmn_estimate_id || example.id;
      const exampleDate = new Date(example.contract_end);
      const exampleDays = differenceInDays(startOfDay(exampleDate), today);
      
      // Find the renewal
      const atRiskDept = normalizeDepartment(example.division);
      const atRiskAddress = normalizeAddress(example.address);
      const renewal = allEstimates.find(est => {
        if (!isWonStatus(est) || !est.contract_end) return false;
        const estDept = normalizeDepartment(est.division);
        const estAddress = normalizeAddress(est.address);
        if (estDept !== atRiskDept || estAddress !== atRiskAddress) return false;
        const exampleDate2 = new Date(example.contract_end);
        const estDate = new Date(est.contract_end);
        if (estDate <= exampleDate2) return false;
        const estRenewalDate = startOfDay(estDate);
        const daysUntil = differenceInDays(estRenewalDate, today);
        return daysUntil > DAYS_THRESHOLD;
      });
      
      if (renewal) {
        const renewalId = renewal.estimate_number || renewal.lmn_estimate_id || renewal.id;
        const renewalDate = new Date(renewal.contract_end);
        const renewalDays = differenceInDays(startOfDay(renewalDate), today);
        console.log(`   Example: ${exampleId} (${exampleDays} days) has renewal ${renewalId} (${renewalDays} days)`);
      }
    } else if (validAtRisk.length > 0) {
      console.log(`   ✅ ${validAtRisk.length} valid at-risk estimates (should be included)`);
    }
  }
  
  console.log('\n\n✅ Check complete!\n');
}

checkAll().catch(console.error);

