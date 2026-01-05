/**
 * Diagnostic to find why we're getting 27 accounts instead of 42
 */

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
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

function normalizeEstimateId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase().replace(/^EST/, 'EST');
}

function normalizeAccountId(id) {
  if (!id) return null;
  return id.toString().trim();
}

async function diagnose() {
  console.log('🔍 Diagnosing 27 vs 42 Accounts Discrepancy\n');
  console.log('='.repeat(80));
  
  const supabase = getSupabase();
  
  // Read Excel file
  const excelPath = join(process.env.HOME, 'Downloads', 'Estimates List - at risk accounts.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
  
  console.log(`📋 Excel has ${rows.length} estimates\n`);
  
  // Get our calculated at-risk accounts
  const { data: cache } = await supabase
    .from('notification_cache')
    .select('*')
    .eq('cache_key', 'at-risk-accounts')
    .single();
  
  const ourAtRiskAccounts = cache?.cache_data?.accounts || [];
  console.log(`📋 Our calculation has ${ourAtRiskAccounts.length} accounts\n`);
  
  // Extract estimate IDs from Excel
  const excelEstimateIds = rows
    .map(row => normalizeEstimateId(row['Estimate ID']))
    .filter(Boolean);
  
  // Fetch these estimates from database
  console.log('📥 Fetching estimates from database...');
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, estimate_number, lmn_estimate_id, account_id, status, pipeline_status, contract_end, division, address, archived')
    .or(`estimate_number.in.(${excelEstimateIds.join(',')}),lmn_estimate_id.in.(${excelEstimateIds.join(',')})`);
  
  console.log(`✅ Found ${estimates?.length || 0} estimates in database\n`);
  
  // Group Excel estimates by account_id
  const excelAccountsByAccountId = new Map();
  estimates?.forEach(est => {
    if (!est.account_id) return;
    const accountId = normalizeAccountId(est.account_id);
    if (!excelAccountsByAccountId.has(accountId)) {
      excelAccountsByAccountId.set(accountId, []);
    }
    excelAccountsByAccountId.get(accountId).push(est);
  });
  
  console.log(`📊 Excel estimates map to ${excelAccountsByAccountId.size} unique accounts\n`);
  
  // Get our account IDs
  const ourAccountIds = new Set();
  ourAtRiskAccounts.forEach(acc => {
    ourAccountIds.add(normalizeAccountId(acc.account_id));
  });
  
  // Find missing accounts
  const missingAccountIds = [];
  excelAccountsByAccountId.forEach((estimates, accountId) => {
    if (!ourAccountIds.has(accountId)) {
      missingAccountIds.push({
        accountId: accountId,
        estimates: estimates
      });
    }
  });
  
  console.log(`\n❌ MISSING ACCOUNTS: ${missingAccountIds.length} accounts from Excel are not in our calculation\n`);
  console.log('='.repeat(80));
  
  // Fetch account details and check why they're missing
  if (missingAccountIds.length > 0) {
    const missingIds = missingAccountIds.map(m => m.accountId);
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, archived')
      .in('id', missingIds);
    
    const accountsMap = new Map();
    accounts?.forEach(acc => {
      accountsMap.set(normalizeAccountId(acc.id), acc);
    });
    
    // Check snoozes
    const { data: snoozes } = await supabase
      .from('notification_snoozes')
      .select('*')
      .in('related_account_id', missingIds)
      .eq('notification_type', 'renewal_reminder');
    
    const snoozeMap = new Map();
    const today = startOfDay(new Date());
    snoozes?.forEach(snooze => {
      const snoozedUntil = new Date(snooze.snoozed_until);
      if (snoozedUntil > today) {
        snoozeMap.set(normalizeAccountId(snooze.related_account_id), snoozedUntil);
      }
    });
    
    // Check each missing account
    const reasons = {
      archived: [],
      snoozed: [],
      noWonEstimates: [],
      noContractEnd: [],
      pastDue: [],
      tooFar: [],
      hasRenewals: [],
      missingDivisionOrAddress: []
    };
    
    for (const missing of missingAccountIds) {
      const account = accountsMap.get(missing.accountId);
      const accountEstimates = missing.estimates;
      
      if (!account) {
        console.log(`\n❓ Account ID ${missing.accountId}: NOT FOUND in accounts table`);
        continue;
      }
      
      if (account.archived) {
        reasons.archived.push({ accountId: missing.accountId, name: account.name });
        continue;
      }
      
      if (snoozeMap.has(missing.accountId)) {
        reasons.snoozed.push({ accountId: missing.accountId, name: account.name });
        continue;
      }
      
      // Check estimates
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
      
      const wonEstimates = accountEstimates.filter(est => isWonStatus(est));
      if (wonEstimates.length === 0) {
        reasons.noWonEstimates.push({ accountId: missing.accountId, name: account.name });
        continue;
      }
      
      const wonWithEndDate = wonEstimates.filter(est => est.contract_end);
      if (wonWithEndDate.length === 0) {
        reasons.noContractEnd.push({ accountId: missing.accountId, name: account.name });
        continue;
      }
      
      const DAYS_THRESHOLD = 180;
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
      
      const pastDue = wonWithEndDate.filter(est => {
        try {
          const renewalDate = startOfDay(new Date(est.contract_end));
          if (isNaN(renewalDate.getTime())) return false;
          const daysUntil = differenceInDays(renewalDate, today);
          return daysUntil < 0;
        } catch (e) {
          return false;
        }
      });
      
      const tooFar = wonWithEndDate.filter(est => {
        try {
          const renewalDate = startOfDay(new Date(est.contract_end));
          if (isNaN(renewalDate.getTime())) return false;
          const daysUntil = differenceInDays(renewalDate, today);
          return daysUntil > DAYS_THRESHOLD;
        } catch (e) {
          return false;
        }
      });
      
      if (inWindow.length === 0) {
        if (pastDue.length > 0) {
          reasons.pastDue.push({ accountId: missing.accountId, name: account.name, count: pastDue.length });
        } else if (tooFar.length > 0) {
          reasons.tooFar.push({ accountId: missing.accountId, name: account.name, count: tooFar.length });
        }
        continue;
      }
      
      // Check for renewals
      function normalizeAddress(address) {
        if (!address) return '';
        return address.trim().toLowerCase().replace(/\s+/g, ' ');
      }
      
      function normalizeDepartment(division) {
        if (!division) return '';
        return division.trim().toLowerCase();
      }
      
      // Get ALL estimates for this account (not just the ones from Excel)
      const { data: allAccountEstimates } = await supabase
        .from('estimates')
        .select('*')
        .eq('archived', false)
        .eq('account_id', missing.accountId);
      
      function hasRenewalEstimate(accountEstimates, atRiskEstimate) {
        const atRiskDept = normalizeDepartment(atRiskEstimate.division);
        const atRiskAddress = normalizeAddress(atRiskEstimate.address);
        
        if (!atRiskDept || !atRiskAddress) {
          return false; // Missing division/address - renewal check skipped
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
          
          return daysUntil > DAYS_THRESHOLD;
        });
      }
      
      const validAtRisk = inWindow.filter(est => {
        return !hasRenewalEstimate(allAccountEstimates || [], est);
      });
      
      if (validAtRisk.length === 0) {
        // Check if it's because of missing division/address
        const missingDeptOrAddr = inWindow.filter(est => {
          const dept = normalizeDepartment(est.division);
          const addr = normalizeAddress(est.address);
          return !dept || !addr;
        });
        
        if (missingDeptOrAddr.length === inWindow.length) {
          reasons.missingDivisionOrAddress.push({ accountId: missing.accountId, name: account.name });
        } else {
          reasons.hasRenewals.push({ accountId: missing.accountId, name: account.name });
        }
      }
    }
    
    // Print summary by reason
    console.log('\n📊 MISSING ACCOUNTS BY REASON:\n');
    
    if (reasons.archived.length > 0) {
      console.log(`\n1. ARCHIVED (${reasons.archived.length}):`);
      reasons.archived.forEach(a => console.log(`   - ${a.name} (${a.accountId})`));
    }
    
    if (reasons.snoozed.length > 0) {
      console.log(`\n2. SNOOZED (${reasons.snoozed.length}):`);
      reasons.snoozed.forEach(a => console.log(`   - ${a.name} (${a.accountId})`));
    }
    
    if (reasons.noWonEstimates.length > 0) {
      console.log(`\n3. NO WON ESTIMATES (${reasons.noWonEstimates.length}):`);
      reasons.noWonEstimates.forEach(a => console.log(`   - ${a.name} (${a.accountId})`));
    }
    
    if (reasons.noContractEnd.length > 0) {
      console.log(`\n4. NO CONTRACT_END DATE (${reasons.noContractEnd.length}):`);
      reasons.noContractEnd.forEach(a => console.log(`   - ${a.name} (${a.accountId})`));
    }
    
    if (reasons.pastDue.length > 0) {
      console.log(`\n5. PAST DUE (${reasons.pastDue.length}):`);
      reasons.pastDue.forEach(a => console.log(`   - ${a.name} (${a.accountId}) - ${a.count} past due estimates`));
    }
    
    if (reasons.tooFar.length > 0) {
      console.log(`\n6. TOO FAR (> 180 days) (${reasons.tooFar.length}):`);
      reasons.tooFar.forEach(a => console.log(`   - ${a.name} (${a.accountId}) - ${a.count} estimates > 180 days`));
    }
    
    if (reasons.hasRenewals.length > 0) {
      console.log(`\n7. HAS RENEWALS (${reasons.hasRenewals.length}):`);
      reasons.hasRenewals.forEach(a => console.log(`   - ${a.name} (${a.accountId})`));
    }
    
    if (reasons.missingDivisionOrAddress.length > 0) {
      console.log(`\n8. MISSING DIVISION OR ADDRESS (${reasons.missingDivisionOrAddress.length}):`);
      reasons.missingDivisionOrAddress.forEach(a => console.log(`   - ${a.name} (${a.accountId})`));
    }
    
    console.log(`\n\n📊 SUMMARY:`);
    console.log(`   Total missing: ${missingAccountIds.length}`);
    console.log(`   Archived: ${reasons.archived.length}`);
    console.log(`   Snoozed: ${reasons.snoozed.length}`);
    console.log(`   No won estimates: ${reasons.noWonEstimates.length}`);
    console.log(`   No contract_end: ${reasons.noContractEnd.length}`);
    console.log(`   Past due: ${reasons.pastDue.length}`);
    console.log(`   Too far: ${reasons.tooFar.length}`);
    console.log(`   Has renewals: ${reasons.hasRenewals.length}`);
    console.log(`   Missing division/address: ${reasons.missingDivisionOrAddress.length}`);
  }
  
  console.log('\n\n✅ Diagnostic complete!\n');
}

diagnose().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


