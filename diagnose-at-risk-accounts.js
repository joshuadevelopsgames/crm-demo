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

function calculateRenewalDate(estimates = []) {
  if (!estimates || estimates.length === 0) {
    return null;
  }

  // Filter to only won estimates with valid contract_end dates
  const wonEstimatesWithEndDate = estimates
    .filter(est => {
      // Must be won status
      if (est.status !== 'won') return false;
      
      // Must have contract_end date
      if (!est.contract_end) return false;
      
      // Must be a valid date
      const endDate = new Date(est.contract_end);
      return !isNaN(endDate.getTime());
    })
    .map(est => ({
      ...est,
      contract_end_date: new Date(est.contract_end)
    }));

  if (wonEstimatesWithEndDate.length === 0) {
    return null;
  }

  // Find the latest contract_end date
  const latestEndDate = wonEstimatesWithEndDate.reduce((latest, est) => {
    return est.contract_end_date > latest ? est.contract_end_date : latest;
  }, wonEstimatesWithEndDate[0].contract_end_date);

  return latestEndDate;
}

async function diagnoseAtRiskAccounts() {
  console.log('🔍 Diagnosing at-risk accounts...\n');

  try {
    // Get all accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, status, archived, renewal_date')
      .eq('archived', false);

    if (accountsError) throw accountsError;

    // Get all estimates
    const { data: estimates, error: estimatesError } = await supabase
      .from('estimates')
      .select('id, account_id, status, contract_end');

    if (estimatesError) throw estimatesError;

    console.log(`📊 Found ${accounts.length} active accounts`);
    console.log(`📋 Found ${estimates.length} estimates\n`);

    const today = startOfDay(new Date());
    
    // Categorize accounts
    const currentlyAtRisk = accounts.filter(a => a.status === 'at_risk');
    const shouldBeAtRisk = [];
    const incorrectlyRemoved = [];
    const noRenewalDate = [];
    const renewalPast = [];
    const renewalTooFar = [];

    for (const account of accounts) {
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      const renewalDate = calculateRenewalDate(accountEstimates);
      
      if (!renewalDate) {
        // No renewal date
        if (account.status === 'at_risk') {
          noRenewalDate.push({
            account,
            reason: 'No won estimates with contract_end dates'
          });
        }
        continue;
      }

      const renewalDateStart = startOfDay(renewalDate);
      const daysUntilRenewal = differenceInDays(renewalDateStart, today);
      const shouldBeAtRiskBasedOnRenewal = daysUntilRenewal >= 0 && daysUntilRenewal <= 180;

      if (shouldBeAtRiskBasedOnRenewal) {
        shouldBeAtRisk.push({
          account,
          renewalDate: renewalDate.toISOString(),
          daysUntilRenewal
        });

        // Check if it was incorrectly removed
        if (account.status !== 'at_risk') {
          incorrectlyRemoved.push({
            account,
            renewalDate: renewalDate.toISOString(),
            daysUntilRenewal,
            currentStatus: account.status
          });
        }
      } else if (account.status === 'at_risk') {
        // Account is at_risk but shouldn't be based on renewal
        if (daysUntilRenewal < 0) {
          renewalPast.push({
            account,
            renewalDate: renewalDate.toISOString(),
            daysUntilRenewal
          });
        } else {
          renewalTooFar.push({
            account,
            renewalDate: renewalDate.toISOString(),
            daysUntilRenewal
          });
        }
      }
    }

    // Print summary
    console.log('══════════════════════════════════════════════════');
    console.log('📊 AT-RISK ACCOUNT DIAGNOSIS');
    console.log('══════════════════════════════════════════════════\n');

    console.log(`🔴 Currently marked as at_risk: ${currentlyAtRisk.length}`);
    if (currentlyAtRisk.length > 0) {
      currentlyAtRisk.forEach(a => {
        console.log(`   - ${a.name} (${a.status})`);
      });
    }

    console.log(`\n✅ Should be at_risk (based on renewal dates): ${shouldBeAtRisk.length}`);
    if (shouldBeAtRisk.length > 0) {
      shouldBeAtRisk.slice(0, 10).forEach(({ account, daysUntilRenewal }) => {
        console.log(`   - ${account.name} (${account.status}) - Renewal in ${daysUntilRenewal} days`);
      });
      if (shouldBeAtRisk.length > 10) {
        console.log(`   ... and ${shouldBeAtRisk.length - 10} more`);
      }
    }

    console.log(`\n⚠️  INCORRECTLY REMOVED (should be at_risk but aren't): ${incorrectlyRemoved.length}`);
    if (incorrectlyRemoved.length > 0) {
      incorrectlyRemoved.forEach(({ account, daysUntilRenewal, currentStatus }) => {
        console.log(`   - ${account.name} (currently: ${currentStatus}) - Renewal in ${daysUntilRenewal} days`);
      });
    }

    console.log(`\n📅 At_risk but renewal date passed: ${renewalPast.length}`);
    if (renewalPast.length > 0) {
      renewalPast.slice(0, 5).forEach(({ account, daysUntilRenewal }) => {
        console.log(`   - ${account.name} - Renewal was ${Math.abs(daysUntilRenewal)} days ago`);
      });
    }

    console.log(`\n📅 At_risk but renewal > 6 months away: ${renewalTooFar.length}`);
    if (renewalTooFar.length > 0) {
      renewalTooFar.slice(0, 5).forEach(({ account, daysUntilRenewal }) => {
        console.log(`   - ${account.name} - Renewal in ${daysUntilRenewal} days`);
      });
    }

    console.log(`\n❓ At_risk but no renewal date: ${noRenewalDate.length}`);
    if (noRenewalDate.length > 0) {
      noRenewalDate.forEach(({ account, reason }) => {
        console.log(`   - ${account.name} - ${reason}`);
      });
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('💡 SUMMARY');
    console.log('══════════════════════════════════════════════════');
    console.log(`Total accounts that SHOULD be at_risk: ${shouldBeAtRisk.length}`);
    console.log(`Total accounts currently at_risk: ${currentlyAtRisk.length}`);
    console.log(`Accounts incorrectly removed: ${incorrectlyRemoved.length}`);
    console.log(`Accounts at_risk but shouldn't be (renewal-based): ${renewalPast.length + renewalTooFar.length}`);
    console.log(`Accounts at_risk with no renewal date: ${noRenewalDate.length}`);

    if (incorrectlyRemoved.length > 0) {
      console.log('\n⚠️  WARNING: Some accounts that should be at_risk have been incorrectly removed!');
      console.log('   These accounts will be restored when createRenewalNotifications() runs.');
    }

  } catch (error) {
    console.error('❌ Error diagnosing at-risk accounts:', error);
  }
}

diagnoseAtRiskAccounts();

