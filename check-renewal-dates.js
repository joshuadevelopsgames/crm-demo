#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { differenceInDays, startOfDay } from 'date-fns';

// Try to load .env file if it exists (for local development)
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
} catch (e) {
  console.error('Error loading .env file:', e);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkRenewalDates() {
  console.log('🔍 Checking renewal dates from estimates...\n');

  try {
    // Get all won estimates with contract_end dates
    const { data: wonEstimates, error: estimatesError } = await supabase
      .from('estimates')
      .select('id, account_id, status, contract_end, estimate_date')
      .eq('status', 'won')
      .not('contract_end', 'is', null);

    if (estimatesError) throw estimatesError;

    console.log(`📋 Found ${wonEstimates.length} won estimates with contract_end dates\n`);

    if (wonEstimates.length === 0) {
      console.log('❌ No won estimates with contract_end dates found!');
      console.log('   This is why there are no at-risk accounts.');
      console.log('   At-risk status is based on renewal dates from won estimates.');
      return;
    }

    const today = startOfDay(new Date());
    
    // Group by account and find latest contract_end
    const accountRenewals = new Map();
    
    for (const estimate of wonEstimates) {
      const accountId = estimate.account_id;
      if (!accountId) continue;
      
      const contractEnd = new Date(estimate.contract_end);
      if (isNaN(contractEnd.getTime())) continue;
      
      if (!accountRenewals.has(accountId)) {
        accountRenewals.set(accountId, {
          accountId,
          estimates: [],
          latestContractEnd: contractEnd
        });
      }
      
      const accountData = accountRenewals.get(accountId);
      accountRenewals.get(accountId).estimates.push(estimate);
      
      if (contractEnd > accountData.latestContractEnd) {
        accountData.latestContractEnd = contractEnd;
      }
    }

    console.log(`📊 Found ${accountRenewals.size} accounts with won estimates\n`);

    // Categorize by days until renewal
    const within180Days = [];
    const past = [];
    const moreThan180Days = [];

    for (const [accountId, data] of accountRenewals) {
      const renewalDateStart = startOfDay(data.latestContractEnd);
      const daysUntilRenewal = differenceInDays(renewalDateStart, today);

      const renewalInfo = {
        accountId,
        renewalDate: data.latestContractEnd.toISOString(),
        daysUntilRenewal,
        estimateCount: data.estimates.length
      };

      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 180) {
        within180Days.push(renewalInfo);
      } else if (daysUntilRenewal < 0) {
        past.push(renewalInfo);
      } else {
        moreThan180Days.push(renewalInfo);
      }
    }

    console.log('══════════════════════════════════════════════════');
    console.log('📅 RENEWAL DATE ANALYSIS');
    console.log('══════════════════════════════════════════════════\n');

    console.log(`✅ Renewals within 180 days (should be at_risk): ${within180Days.length}`);
    if (within180Days.length > 0) {
      within180Days.slice(0, 10).forEach(({ accountId, renewalDate, daysUntilRenewal }) => {
        console.log(`   - Account ${accountId}: Renewal in ${daysUntilRenewal} days (${renewalDate.substring(0, 10)})`);
      });
      if (within180Days.length > 10) {
        console.log(`   ... and ${within180Days.length - 10} more`);
      }
    }

    console.log(`\n📅 Renewals in the past: ${past.length}`);
    if (past.length > 0) {
      past.slice(0, 5).forEach(({ accountId, renewalDate, daysUntilRenewal }) => {
        console.log(`   - Account ${accountId}: Renewal was ${Math.abs(daysUntilRenewal)} days ago (${renewalDate.substring(0, 10)})`);
      });
    }

    console.log(`\n📅 Renewals > 180 days away: ${moreThan180Days.length}`);
    if (moreThan180Days.length > 0) {
      moreThan180Days.slice(0, 5).forEach(({ accountId, renewalDate, daysUntilRenewal }) => {
        console.log(`   - Account ${accountId}: Renewal in ${daysUntilRenewal} days (${renewalDate.substring(0, 10)})`);
      });
    }

    // Get account names for the ones that should be at_risk
    if (within180Days.length > 0) {
      console.log('\n══════════════════════════════════════════════════');
      console.log('⚠️  ACCOUNTS THAT SHOULD BE AT_RISK');
      console.log('══════════════════════════════════════════════════\n');
      
      const accountIds = within180Days.map(a => a.accountId);
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name, status, archived')
        .in('id', accountIds);

      if (!accountsError && accounts) {
        for (const account of accounts) {
          const renewalInfo = within180Days.find(a => a.accountId === account.id);
          console.log(`   - ${account.name} (${account.status}) - Renewal in ${renewalInfo.daysUntilRenewal} days`);
        }
      }
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('💡 SUMMARY');
    console.log('══════════════════════════════════════════════════');
    console.log(`Total accounts with won estimates: ${accountRenewals.size}`);
    console.log(`Accounts that SHOULD be at_risk: ${within180Days.length}`);
    console.log(`Accounts with past renewals: ${past.length}`);
    console.log(`Accounts with renewals > 180 days: ${moreThan180Days.length}`);

    if (within180Days.length === 0) {
      console.log('\n⚠️  No accounts have renewals within 180 days.');
      console.log('   This could mean:');
      console.log('   1. All renewals are more than 6 months away');
      console.log('   2. All renewals have already passed');
      console.log('   3. Estimates need to be re-imported with contract_end dates');
    }

  } catch (error) {
    console.error('❌ Error checking renewal dates:', error);
  }
}

checkRenewalDates();

