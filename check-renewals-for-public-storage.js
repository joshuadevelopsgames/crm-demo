/**
 * Check if Public Storage estimates have renewals among all 101 estimates
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

async function checkRenewals() {
  const supabase = getSupabase();
  const accountId = 'lmn-account-3661753';
  const DAYS_THRESHOLD = 180;
  const today = startOfDay(new Date());
  
  // Get ALL non-archived estimates (like the cron job does)
  const { data: allEstimates } = await supabase
    .from('estimates')
    .select('*')
    .eq('archived', false)
    .eq('account_id', accountId);
  
  console.log(`Total non-archived estimates: ${allEstimates?.length || 0}\n`);
  
  // The 6 at-risk estimates
  const atRiskEstIds = ['EST3351938', 'EST3259705', 'EST3259698', 'EST3259613', 'EST3259701', 'EST3259710'];
  
  const atRiskEstimates = allEstimates?.filter(est => {
    const estId = (est.estimate_number || est.lmn_estimate_id || '').toString().toUpperCase();
    return atRiskEstIds.includes(estId);
  }) || [];
  
  console.log(`At-risk estimates found: ${atRiskEstimates.length}\n`);
  
  // Check each at-risk estimate for renewals
  atRiskEstimates.forEach(atRiskEst => {
    const estId = (atRiskEst.estimate_number || atRiskEst.lmn_estimate_id || '').toString().toUpperCase();
    const atRiskDept = normalizeDepartment(atRiskEst.division);
    const atRiskAddress = normalizeAddress(atRiskEst.address);
    const atRiskDate = new Date(atRiskEst.contract_end);
    
    console.log(`\n🔍 Checking ${estId}:`);
    console.log(`   Division: ${atRiskDept || 'N/A'}`);
    console.log(`   Address: ${atRiskAddress || 'N/A'}`);
    console.log(`   Contract End: ${atRiskEst.contract_end}`);
    
    if (!atRiskDept || !atRiskAddress) {
      console.log(`   ⚠️  Missing division or address - renewal check skipped`);
      return;
    }
    
    // Look for renewals
    const renewals = allEstimates?.filter(est => {
      if (!isWonStatus(est) || !est.contract_end) return false;
      
      const estDept = normalizeDepartment(est.division);
      const estAddress = normalizeAddress(est.address);
      
      if (estDept !== atRiskDept || estAddress !== atRiskAddress) return false;
      
      const estDate = new Date(est.contract_end);
      if (estDate <= atRiskDate) return false;
      
      const estRenewalDate = startOfDay(estDate);
      const daysUntil = differenceInDays(estRenewalDate, today);
      
      return daysUntil > DAYS_THRESHOLD;
    }) || [];
    
    if (renewals.length > 0) {
      console.log(`   ❌ HAS RENEWAL(S):`);
      renewals.forEach(ren => {
        const renId = (ren.estimate_number || ren.lmn_estimate_id || '').toString().toUpperCase();
        const renDate = new Date(ren.contract_end);
        const renDays = differenceInDays(startOfDay(renDate), today);
        console.log(`      ${renId}: ${ren.contract_end} (${renDays} days)`);
      });
    } else {
      console.log(`   ✅ NO RENEWAL`);
    }
  });
}

checkRenewals().catch(console.error);

