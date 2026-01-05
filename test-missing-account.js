/**
 * Test why a specific missing account is not showing up
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { startOfDay, differenceInDays } from 'date-fns';

// Load environment variables
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

// Test one missing account
async function testAccount() {
  const supabase = getSupabase();
  const accountId = 'lmn-account-3661753'; // Public Storage - has 6 estimates in Excel
  
  console.log(`🔍 Testing account: ${accountId}\n`);
  
  // Get account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();
  
  console.log(`Account: ${account?.name || 'NOT FOUND'}`);
  console.log(`Archived: ${account?.archived ? 'YES ❌' : 'NO ✅'}\n`);
  
  // Get all estimates for this account
  const { data: estimates } = await supabase
    .from('estimates')
    .select('*')
    .eq('account_id', accountId);
  
  console.log(`Total estimates: ${estimates?.length || 0}\n`);
  
  // Check snoozes
  const { data: snoozes } = await supabase
    .from('notification_snoozes')
    .select('*')
    .eq('related_account_id', accountId)
    .eq('notification_type', 'renewal_reminder');
  
  console.log(`Snoozes: ${snoozes?.length || 0}\n`);
  
  // Filter won estimates with contract_end
  const today = startOfDay(new Date());
  const DAYS_THRESHOLD = 180;
  
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
  
  const wonEstimates = estimates?.filter(est => isWonStatus(est)) || [];
  console.log(`Won estimates: ${wonEstimates.length}`);
  
  const wonWithEndDate = wonEstimates.filter(est => est.contract_end);
  console.log(`Won estimates with contract_end: ${wonWithEndDate.length}\n`);
  
  // Check which are in window
  const inWindow = wonWithEndDate.filter(est => {
    try {
      const renewalDate = startOfDay(new Date(est.contract_end));
      if (isNaN(renewalDate.getTime())) return false;
      const daysUntil = differenceInDays(renewalDate, today);
      return daysUntil <= DAYS_THRESHOLD && daysUntil >= 0;
    } catch (e) {
      return false;
    }
  });
  
  console.log(`Estimates in window (0-180 days): ${inWindow.length}\n`);
  
  inWindow.forEach(est => {
    const renewalDate = startOfDay(new Date(est.contract_end));
    const daysUntil = differenceInDays(renewalDate, today);
    console.log(`  ${est.estimate_number || est.lmn_estimate_id}: ${est.contract_end} (${daysUntil} days)`);
    console.log(`    Division: ${est.division || 'N/A'}`);
    console.log(`    Address: ${est.address || 'N/A'}`);
    console.log(`    Archived: ${est.archived ? 'YES ❌' : 'NO ✅'}`);
  });
  
  // Check for renewals
  console.log(`\n🔍 Checking for renewals...\n`);
  
  function normalizeAddress(address) {
    if (!address) return '';
    return address.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  
  function normalizeDepartment(division) {
    if (!division) return '';
    return division.trim().toLowerCase();
  }
  
  function hasRenewalEstimate(accountEstimates, atRiskEstimate) {
    const atRiskDept = normalizeDepartment(atRiskEstimate.division);
    const atRiskAddress = normalizeAddress(atRiskEstimate.address);
    
    if (!atRiskDept || !atRiskAddress) {
      console.log(`    ⚠️  Missing division or address - renewal check skipped`);
      return false;
    }
    
    const today = startOfDay(new Date());
    
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
      
      if (daysUntil > DAYS_THRESHOLD) {
        console.log(`    ✅ Found renewal: ${est.estimate_number || est.lmn_estimate_id} expires ${est.contract_end} (${daysUntil} days)`);
        return true;
      }
      return false;
    });
  }
  
  const validAtRisk = inWindow.filter(est => {
    console.log(`\nChecking estimate: ${est.estimate_number || est.lmn_estimate_id}`);
    const hasRenewal = hasRenewalEstimate(estimates || [], est);
    if (hasRenewal) {
      console.log(`  ❌ EXCLUDED - Has renewal`);
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

testAccount().catch(console.error);


