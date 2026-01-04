/**
 * Diagnostic script to analyze at-risk accounts calculation
 * Shows why accounts are/aren't at-risk and which estimates are used
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

// Get Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Inline isWonStatus (same as atRiskCalculator.js)
function isWonStatus(statusOrEstimate, pipelineStatus = null) {
  let status, pipeline;
  
  if (typeof statusOrEstimate === 'object' && statusOrEstimate !== null) {
    status = statusOrEstimate.status;
    pipeline = statusOrEstimate.pipeline_status;
  } else {
    status = statusOrEstimate;
    pipeline = pipelineStatus;
  }
  
  if (pipeline) {
    const pipelineLower = pipeline.toString().toLowerCase().trim();
    if (pipelineLower === 'sold' || pipelineLower.includes('sold')) {
      return true;
    }
  }
  
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  const wonStatuses = [
    'contract signed',
    'work complete',
    'billing complete',
    'email contract award',
    'verbal contract award',
    'sold',
    'won'
  ];
  return wonStatuses.includes(statusLower);
}

const DAYS_THRESHOLD = 180;

async function diagnose() {
  console.log('🔍 At-Risk Accounts Diagnostic\n');
  console.log('='.repeat(80));
  
  const supabase = getSupabase();
  
  // Fetch data
  console.log('\n📥 Fetching data...');
  const [accountsRes, estimatesRes, snoozesRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('archived', false),
    supabase.from('estimates').select('*').eq('archived', false),
    supabase.from('notification_snoozes').select('*')
  ]);
  
  if (accountsRes.error) throw accountsRes.error;
  if (estimatesRes.error) throw estimatesRes.error;
  if (snoozesRes.error) throw snoozesRes.error;
  
  const accounts = accountsRes.data || [];
  const estimates = estimatesRes.data || [];
  const snoozes = snoozesRes.data || [];
  
  console.log(`✅ Fetched ${accounts.length} accounts, ${estimates.length} estimates, ${snoozes.length} snoozes\n`);
  
  // Group estimates by account
  const estimatesByAccount = new Map();
  estimates.forEach(est => {
    if (!est.account_id) return;
    if (!estimatesByAccount.has(est.account_id)) {
      estimatesByAccount.set(est.account_id, []);
    }
    estimatesByAccount.get(est.account_id).push(est);
  });
  
  // Create snooze lookup
  const today = startOfDay(new Date());
  const snoozeMap = new Map();
  snoozes.forEach(snooze => {
    if (snooze.notification_type === 'renewal_reminder' && snooze.related_account_id) {
      const snoozedUntil = new Date(snooze.snoozed_until);
      if (snoozedUntil > today) {
        snoozeMap.set(snooze.related_account_id, snoozedUntil);
      }
    }
  });
  
  // Diagnostic data
  const stats = {
    totalAccounts: accounts.length,
    archivedAccounts: 0,
    snoozedAccounts: 0,
    accountsWithEstimates: 0,
    accountsWithWonEstimates: 0,
    accountsWithWonEstimatesWithEndDate: 0,
    estimatesInWindow: 0,
    estimatesPastDue: 0,
    estimatesTooFar: 0,
    accountsWithRenewals: 0,
    atRiskAccounts: 0
  };
  
  const accountDetails = [];
  
  // Process each account
  accounts.forEach(account => {
    if (account.archived) {
      stats.archivedAccounts++;
      return;
    }
    
    if (snoozeMap.has(account.id)) {
      stats.snoozedAccounts++;
      return;
    }
    
    const accountEstimates = estimatesByAccount.get(account.id) || [];
    if (accountEstimates.length === 0) return;
    
    stats.accountsWithEstimates++;
    
    // Filter won estimates
    const wonEstimates = accountEstimates.filter(est => isWonStatus(est));
    if (wonEstimates.length === 0) return;
    
    stats.accountsWithWonEstimates++;
    
    // Filter won estimates with contract_end
    const wonEstimatesWithEndDate = wonEstimates.filter(est => est.contract_end);
    if (wonEstimatesWithEndDate.length === 0) return;
    
    stats.accountsWithWonEstimatesWithEndDate++;
    
    const accountDetail = {
      accountId: account.id,
      accountName: account.name,
      totalEstimates: accountEstimates.length,
      wonEstimates: wonEstimates.length,
      wonEstimatesWithEndDate: wonEstimatesWithEndDate.length,
      estimatesInWindow: [],
      estimatesPastDue: [],
      estimatesTooFar: [],
      hasRenewal: false,
      renewalEstimate: null,
      atRiskEstimate: null,
      isAtRisk: false,
      reason: null
    };
    
    // Check each won estimate with end date
    wonEstimatesWithEndDate.forEach(est => {
      try {
        const renewalDate = startOfDay(new Date(est.contract_end));
        if (isNaN(renewalDate.getTime())) return;
        
        const daysUntil = differenceInDays(renewalDate, today);
        
        if (daysUntil < 0) {
          stats.estimatesPastDue++;
          accountDetail.estimatesPastDue.push({
            id: est.id,
            estimate_number: est.estimate_number || est.lmn_estimate_id,
            contract_end: est.contract_end,
            daysUntil,
            division: est.division,
            address: est.address
          });
        } else if (daysUntil > DAYS_THRESHOLD) {
          stats.estimatesTooFar++;
          accountDetail.estimatesTooFar.push({
            id: est.id,
            estimate_number: est.estimate_number || est.lmn_estimate_id,
            contract_end: est.contract_end,
            daysUntil,
            division: est.division,
            address: est.address
          });
        } else {
          stats.estimatesInWindow++;
          accountDetail.estimatesInWindow.push({
            id: est.id,
            estimate_number: est.estimate_number || est.lmn_estimate_id,
            contract_end: est.contract_end,
            daysUntil,
            division: est.division,
            address: est.address
          });
        }
      } catch (error) {
        console.error(`Error processing estimate ${est.id}:`, error);
      }
    });
    
    // Check for renewals (newer estimate with same dept + address, > 180 days)
    if (accountDetail.estimatesInWindow.length > 0) {
      const atRiskEst = accountDetail.estimatesInWindow[0];
      const atRiskDept = (atRiskEst.division || '').trim().toLowerCase();
      const atRiskAddress = (atRiskEst.address || '').trim().toLowerCase().replace(/\s+/g, ' ');
      
      if (atRiskDept && atRiskAddress) {
        // Look for renewal
        const renewalEst = wonEstimatesWithEndDate.find(est => {
          if (!est.contract_end) return false;
          
          const estDept = (est.division || '').trim().toLowerCase();
          const estAddress = (est.address || '').trim().toLowerCase().replace(/\s+/g, ' ');
          
          if (estDept !== atRiskDept || estAddress !== atRiskAddress) return false;
          
          const estDate = new Date(est.contract_end);
          const atRiskDate = new Date(atRiskEst.contract_end);
          if (estDate <= atRiskDate) return false;
          
          const estRenewalDate = startOfDay(estDate);
          const daysUntil = differenceInDays(estRenewalDate, today);
          
          return daysUntil > DAYS_THRESHOLD;
        });
        
        if (renewalEst) {
          accountDetail.hasRenewal = true;
          accountDetail.renewalEstimate = {
            id: renewalEst.id,
            estimate_number: renewalEst.estimate_number || renewalEst.lmn_estimate_id,
            contract_end: renewalEst.contract_end,
            division: renewalEst.division,
            address: renewalEst.address
          };
          accountDetail.reason = 'Has renewal estimate';
        } else {
          // Find soonest expiring estimate
          const soonest = accountDetail.estimatesInWindow.reduce((soonest, est) => {
            const soonestDate = new Date(soonest.contract_end);
            const estDate = new Date(est.contract_end);
            return estDate < soonestDate ? est : soonest;
          });
          
          accountDetail.atRiskEstimate = soonest;
          accountDetail.isAtRisk = true;
          stats.atRiskAccounts++;
          accountDetail.reason = 'At-risk (0-180 days, no renewal)';
        }
      } else {
        accountDetail.reason = 'Missing division or address';
      }
    } else if (accountDetail.estimatesPastDue.length > 0) {
      accountDetail.reason = 'All estimates are past due (excluded per R6a)';
    } else if (accountDetail.estimatesTooFar.length > 0) {
      accountDetail.reason = 'All estimates are > 180 days away';
    } else {
      accountDetail.reason = 'No won estimates with contract_end';
    }
    
    accountDetails.push(accountDetail);
  });
  
  // Print summary
  console.log('\n📊 SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total Accounts: ${stats.totalAccounts}`);
  console.log(`  - Archived: ${stats.archivedAccounts}`);
  console.log(`  - Snoozed: ${stats.snoozedAccounts}`);
  console.log(`  - With Estimates: ${stats.accountsWithEstimates}`);
  console.log(`  - With Won Estimates: ${stats.accountsWithWonEstimates}`);
  console.log(`  - With Won Estimates (with contract_end): ${stats.accountsWithWonEstimatesWithEndDate}`);
  console.log(`\nEstimate Breakdown:`);
  console.log(`  - In Window (0-180 days): ${stats.estimatesInWindow}`);
  console.log(`  - Past Due (< 0 days): ${stats.estimatesPastDue}`);
  console.log(`  - Too Far (> 180 days): ${stats.estimatesTooFar}`);
  console.log(`\n✅ At-Risk Accounts: ${stats.atRiskAccounts}`);
  console.log(`❌ Excluded (have renewals): ${stats.accountsWithRenewals}`);
  
  // Print at-risk accounts
  console.log('\n\n🎯 AT-RISK ACCOUNTS (7 expected)');
  console.log('='.repeat(80));
  const atRisk = accountDetails.filter(a => a.isAtRisk);
  atRisk.forEach((account, idx) => {
    console.log(`\n${idx + 1}. ${account.accountName} (${account.accountId})`);
    console.log(`   Estimate: ${account.atRiskEstimate.estimate_number || account.atRiskEstimate.id}`);
    console.log(`   Contract End: ${account.atRiskEstimate.contract_end}`);
    console.log(`   Days Until: ${account.atRiskEstimate.daysUntil}`);
    console.log(`   Division: ${account.atRiskEstimate.division || 'N/A'}`);
    console.log(`   Address: ${account.atRiskEstimate.address || 'N/A'}`);
    console.log(`   Total Won Estimates: ${account.wonEstimates}`);
    console.log(`   Won Estimates with End Date: ${account.wonEstimatesWithEndDate}`);
  });
  
  // Print excluded accounts (sample)
  console.log('\n\n❌ EXCLUDED ACCOUNTS (Sample - first 10)');
  console.log('='.repeat(80));
  const excluded = accountDetails.filter(a => !a.isAtRisk && a.wonEstimatesWithEndDate > 0).slice(0, 10);
  excluded.forEach((account, idx) => {
    console.log(`\n${idx + 1}. ${account.accountName} (${account.accountId})`);
    console.log(`   Reason: ${account.reason}`);
    if (account.estimatesPastDue.length > 0) {
      console.log(`   Past Due Estimates: ${account.estimatesPastDue.length}`);
    }
    if (account.estimatesTooFar.length > 0) {
      console.log(`   Too Far Estimates: ${account.estimatesTooFar.length}`);
    }
    if (account.hasRenewal) {
      console.log(`   Renewal Estimate: ${account.renewalEstimate.estimate_number || account.renewalEstimate.id}`);
      console.log(`   Renewal Date: ${account.renewalEstimate.contract_end}`);
    }
  });
  
  if (excluded.length < accountDetails.filter(a => !a.isAtRisk && a.wonEstimatesWithEndDate > 0).length) {
    console.log(`\n... and ${accountDetails.filter(a => !a.isAtRisk && a.wonEstimatesWithEndDate > 0).length - excluded.length} more excluded accounts`);
  }
  
  console.log('\n\n✅ Diagnostic complete!\n');
}

diagnose().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
