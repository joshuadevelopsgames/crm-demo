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

async function checkWonEstimates() {
  console.log('🔍 Checking won estimates and contract_end dates...\n');

  try {
    // Get all estimates
    const { data: estimates, error: estimatesError } = await supabase
      .from('estimates')
      .select('id, account_id, status, contract_end, contract_start, estimate_date, lmn_estimate_id');

    if (estimatesError) throw estimatesError;

    console.log(`📋 Total estimates: ${estimates.length}\n`);

    // Analyze estimates by status
    const statusCounts = {};
    estimates.forEach(est => {
      const status = est.status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('📊 Estimates by status:');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

    // Check won estimates
    const wonEstimates = estimates.filter(est => {
      const status = (est.status || '').toLowerCase();
      return status === 'won';
    });

    console.log(`\n✅ Won estimates (case-insensitive): ${wonEstimates.length}`);

    // Check won estimates with contract_end
    const wonWithContractEnd = wonEstimates.filter(est => est.contract_end);
    console.log(`   With contract_end: ${wonWithContractEnd.length}`);
    console.log(`   Without contract_end: ${wonEstimates.length - wonWithContractEnd.length}`);

    if (wonWithContractEnd.length > 0) {
      console.log('\n📅 Won estimates with contract_end dates:');
      
      const today = startOfDay(new Date());
      const within180Days = [];
      const pastRenewals = [];
      const futureRenewals = [];

      wonWithContractEnd.forEach(est => {
        const contractEnd = new Date(est.contract_end);
        const daysUntil = differenceInDays(contractEnd, today);
        
        if (daysUntil <= 180 && daysUntil >= 0) {
          within180Days.push({ est, daysUntil });
        } else if (daysUntil < 0) {
          pastRenewals.push({ est, daysUntil });
        } else {
          futureRenewals.push({ est, daysUntil });
        }
      });

      console.log(`\n   Renewals within 180 days (should be at-risk): ${within180Days.length}`);
      if (within180Days.length > 0) {
        console.log('\n   Sample accounts with renewals within 180 days:');
        within180Days.slice(0, 10).forEach(({ est, daysUntil }) => {
          console.log(`     - Account ID: ${est.account_id}, Renewal in ${daysUntil} days (${est.contract_end})`);
        });
      }

      console.log(`\n   Renewals that have passed: ${pastRenewals.length}`);
      if (pastRenewals.length > 0) {
        console.log('\n   Sample accounts with past renewals:');
        pastRenewals.slice(0, 5).forEach(({ est, daysUntil }) => {
          console.log(`     - Account ID: ${est.account_id}, Renewal was ${Math.abs(daysUntil)} days ago (${est.contract_end})`);
        });
      }

      console.log(`\n   Renewals > 180 days away: ${futureRenewals.length}`);

      // Group by account
      const accountRenewals = {};
      wonWithContractEnd.forEach(est => {
        if (!accountRenewals[est.account_id]) {
          accountRenewals[est.account_id] = [];
        }
        accountRenewals[est.account_id].push(new Date(est.contract_end));
      });

      // Find latest renewal for each account
      const accountLatestRenewals = {};
      Object.entries(accountRenewals).forEach(([accountId, dates]) => {
        accountLatestRenewals[accountId] = new Date(Math.max(...dates));
      });

      // Check which accounts should be at-risk
      const accountsShouldBeAtRisk = [];
      Object.entries(accountLatestRenewals).forEach(([accountId, latestRenewal]) => {
        const daysUntil = differenceInDays(latestRenewal, today);
        if (daysUntil <= 180) {
          accountsShouldBeAtRisk.push({ accountId, latestRenewal, daysUntil });
        }
      });

      console.log(`\n📊 Accounts that should be at-risk: ${accountsShouldBeAtRisk.length}`);
      if (accountsShouldBeAtRisk.length > 0) {
        console.log('\n   Sample accounts:');
        accountsShouldBeAtRisk.slice(0, 10).forEach(({ accountId, latestRenewal, daysUntil }) => {
          console.log(`     - Account ID: ${accountId}, Latest renewal: ${latestRenewal.toISOString()}, Days until: ${daysUntil}`);
        });

        // Get account names
        const accountIds = accountsShouldBeAtRisk.map(a => a.accountId);
        const { data: accounts, error: accountsError } = await supabase
          .from('accounts')
          .select('id, name, status, archived')
          .in('id', accountIds);

        if (!accountsError && accounts.length > 0) {
          console.log('\n   Account details:');
          accountsShouldBeAtRisk.slice(0, 10).forEach(({ accountId, latestRenewal, daysUntil }) => {
            const account = accounts.find(a => a.id === accountId);
            if (account) {
              console.log(`     - ${account.name} (ID: ${accountId})`);
              console.log(`       Current Status: ${account.status || 'null'}`);
              console.log(`       Archived: ${account.archived || false}`);
              console.log(`       Latest Renewal: ${latestRenewal.toISOString()}`);
              console.log(`       Days Until: ${daysUntil}`);
              console.log('');
            }
          });
        }
      }
    }

    // Check for won estimates without contract_end
    const wonWithoutContractEnd = wonEstimates.filter(est => !est.contract_end);
    if (wonWithoutContractEnd.length > 0) {
      console.log(`\n⚠️  Won estimates WITHOUT contract_end: ${wonWithoutContractEnd.length}`);
      console.log('   These accounts cannot be marked as at-risk');
      console.log('\n   Sample estimates:');
      wonWithoutContractEnd.slice(0, 5).forEach(est => {
        console.log(`     - Estimate ID: ${est.id}, Account ID: ${est.account_id}, Status: ${est.status}`);
        console.log(`       contract_start: ${est.contract_start || 'null'}`);
        console.log(`       contract_end: ${est.contract_end || 'null'}`);
        console.log(`       estimate_date: ${est.estimate_date || 'null'}`);
        console.log('');
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Analysis complete\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkWonEstimates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

