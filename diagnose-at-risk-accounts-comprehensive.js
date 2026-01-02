/**
 * Comprehensive diagnostic script to find accounts that should be at-risk
 * and identify why they're not displaying
 */

import { base44 } from './src/api/base44Client.js';
import { calculateRenewalDate } from './src/utils/renewalDateCalculator.js';
import { differenceInDays, startOfDay } from 'date-fns';

async function diagnoseAtRiskAccounts() {
  console.log('🔍 Comprehensive At-Risk Accounts Diagnostic\n');
  console.log('='.repeat(60));

  try {
    // Get all accounts and estimates
    console.log('\n📊 Loading data from database...');
    const accounts = await base44.entities.Account.list();
    const estimates = await base44.entities.Estimate.list();
    
    console.log(`✅ Loaded ${accounts.length} accounts`);
    console.log(`✅ Loaded ${estimates.length} estimates\n`);

    const today = startOfDay(new Date());
    console.log(`📅 Today's date: ${today.toISOString()}\n`);

    // Categorize accounts
    const shouldBeAtRisk = [];
    const currentlyAtRisk = [];
    const noRenewalDate = [];
    const renewalTooFar = [];
    const renewalPast = [];
    const archivedAccounts = [];
    const churnedAccounts = [];

    // Analyze each account
    for (const account of accounts) {
      // Skip archived accounts
      if (account.archived) {
        archivedAccounts.push({
          account: account.name,
          id: account.id,
          status: account.status
        });
        continue;
      }

      // Skip churned accounts
      if (account.status === 'churned') {
        churnedAccounts.push({
          account: account.name,
          id: account.id
        });
        continue;
      }

      // Get estimates for this account
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      
      // Calculate renewal date
      const renewalDate = calculateRenewalDate(accountEstimates);

      if (!renewalDate) {
        // Check if account has any estimates at all
        const hasEstimates = accountEstimates.length > 0;
        const hasWonEstimates = accountEstimates.some(est => 
          est.status && est.status.toLowerCase() === 'won'
        );
        const hasWonEstimatesWithoutContractEnd = accountEstimates.some(est => 
          est.status && 
          est.status.toLowerCase() === 'won' && 
          !est.contract_end
        );

        noRenewalDate.push({
          account: account.name,
          id: account.id,
          status: account.status,
          hasEstimates,
          hasWonEstimates,
          hasWonEstimatesWithoutContractEnd,
          totalEstimates: accountEstimates.length,
          wonEstimates: accountEstimates.filter(est => 
            est.status && est.status.toLowerCase() === 'won'
          ).length,
          sampleEstimates: accountEstimates.slice(0, 3).map(est => ({
            id: est.id,
            status: est.status,
            contract_end: est.contract_end,
            lmn_estimate_id: est.lmn_estimate_id
          }))
        });
        continue;
      }

      // Calculate days until renewal
      const renewalDateStart = startOfDay(renewalDate);
      const daysUntilRenewal = differenceInDays(renewalDateStart, today);

      // Determine if should be at-risk
      const shouldBeAtRiskBasedOnRenewal = daysUntilRenewal <= 180;

      if (shouldBeAtRiskBasedOnRenewal) {
        if (account.status === 'at_risk') {
          currentlyAtRisk.push({
            account: account.name,
            id: account.id,
            renewalDate: renewalDate.toISOString(),
            daysUntilRenewal,
            status: account.status
          });
        } else {
          shouldBeAtRisk.push({
            account: account.name,
            id: account.id,
            renewalDate: renewalDate.toISOString(),
            daysUntilRenewal,
            currentStatus: account.status,
            reason: daysUntilRenewal < 0 
              ? 'Renewal has passed (URGENT)' 
              : `Renewal in ${daysUntilRenewal} days`
          });
        }
      } else {
        if (daysUntilRenewal < 0) {
          renewalPast.push({
            account: account.name,
            id: account.id,
            renewalDate: renewalDate.toISOString(),
            daysUntilRenewal,
            status: account.status,
            note: 'Renewal passed but > 180 days ago (should not be at-risk)'
          });
        } else {
          renewalTooFar.push({
            account: account.name,
            id: account.id,
            renewalDate: renewalDate.toISOString(),
            daysUntilRenewal,
            status: account.status
          });
        }
      }
    }

    // Print comprehensive report
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSTIC RESULTS');
    console.log('='.repeat(60));

    console.log(`\n✅ Accounts that ARE at-risk (status = 'at_risk'): ${currentlyAtRisk.length}`);
    if (currentlyAtRisk.length > 0) {
      console.log('\nCurrently At-Risk Accounts:');
      currentlyAtRisk.slice(0, 10).forEach(acc => {
        console.log(`  - ${acc.account} (${acc.daysUntilRenewal} days until renewal)`);
      });
      if (currentlyAtRisk.length > 10) {
        console.log(`  ... and ${currentlyAtRisk.length - 10} more`);
      }
    }

    console.log(`\n⚠️  Accounts that SHOULD be at-risk but AREN'T: ${shouldBeAtRisk.length}`);
    if (shouldBeAtRisk.length > 0) {
      console.log('\nShould Be At-Risk (but status is not "at_risk"):');
      shouldBeAtRisk.slice(0, 20).forEach(acc => {
        console.log(`  - ${acc.account}`);
        console.log(`    Current Status: ${acc.currentStatus}`);
        console.log(`    Renewal Date: ${acc.renewalDate}`);
        console.log(`    Days Until: ${acc.daysUntilRenewal}`);
        console.log(`    Reason: ${acc.reason}`);
        console.log('');
      });
      if (shouldBeAtRisk.length > 20) {
        console.log(`  ... and ${shouldBeAtRisk.length - 20} more`);
      }
    }

    console.log(`\n❌ Accounts with NO renewal date: ${noRenewalDate.length}`);
    if (noRenewalDate.length > 0) {
      const noWonEstimates = noRenewalDate.filter(acc => !acc.hasWonEstimates).length;
      const wonWithoutContractEnd = noRenewalDate.filter(acc => acc.hasWonEstimatesWithoutContractEnd).length;
      
      console.log(`  - Accounts with no won estimates: ${noWonEstimates}`);
      console.log(`  - Accounts with won estimates but no contract_end: ${wonWithoutContractEnd}`);
      
      if (wonWithoutContractEnd > 0) {
        console.log('\n  Sample accounts with won estimates missing contract_end:');
        noRenewalDate
          .filter(acc => acc.hasWonEstimatesWithoutContractEnd)
          .slice(0, 5)
          .forEach(acc => {
            console.log(`    - ${acc.account} (${acc.wonEstimates} won estimates)`);
          });
      }
    }

    console.log(`\n📅 Renewals too far away (>180 days): ${renewalTooFar.length}`);
    console.log(`\n⏰ Renewals passed but >180 days ago: ${renewalPast.length}`);
    console.log(`\n📦 Archived accounts: ${archivedAccounts.length}`);
    console.log(`\n🚫 Churned accounts: ${churnedAccounts.length}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Accounts: ${accounts.length}`);
    console.log(`Active Accounts: ${accounts.length - archivedAccounts.length - churnedAccounts.length}`);
    console.log(`Currently At-Risk: ${currentlyAtRisk.length}`);
    console.log(`Should Be At-Risk: ${shouldBeAtRisk.length}`);
    console.log(`Missing Renewal Dates: ${noRenewalDate.length}`);
    
    if (shouldBeAtRisk.length > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log(`   ${shouldBeAtRisk.length} accounts need their status updated to 'at_risk'`);
      console.log('   Run createRenewalNotifications() to update these accounts');
    }

    if (noRenewalDate.length > 0) {
      const missingContractEnd = noRenewalDate.filter(acc => acc.hasWonEstimatesWithoutContractEnd).length;
      if (missingContractEnd > 0) {
        console.log('\n⚠️  DATA ISSUE:');
        console.log(`   ${missingContractEnd} accounts have won estimates but are missing contract_end dates`);
        console.log('   These accounts cannot be marked as at-risk until contract_end dates are added');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic complete\n');

  } catch (error) {
    console.error('❌ Error running diagnostic:', error);
    throw error;
  }
}

// Run the diagnostic
diagnoseAtRiskAccounts()
  .then(() => {
    console.log('✅ Diagnostic script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostic script failed:', error);
    process.exit(1);
  });

