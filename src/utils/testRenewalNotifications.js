/**
 * Test utility for renewal notifications
 * Can be called from the browser console to test the system
 * 
 * Usage in browser console:
 *   import { testRenewalNotifications } from '@/utils/testRenewalNotifications';
 *   testRenewalNotifications();
 */

import { base44 } from '@/api/base44Client';
import { calculateRenewalDate, getDaysUntilRenewal, isRenewalWithinDays } from './renewalDateCalculator';
import { format, addDays } from 'date-fns';

export async function testRenewalNotifications() {
  console.log('🔍 Testing Renewal Notification System...\n');

  try {
    // Get all accounts
    const accounts = await base44.entities.Account.list();
    const activeAccounts = accounts.filter(acc => !acc.archived);
    console.log(`📊 Found ${activeAccounts.length} active accounts\n`);

    // Get all estimates
    const estimates = await base44.entities.Estimate.list();
    console.log(`📋 Found ${estimates.length} total estimates\n`);

    // Get all users
    const users = await base44.entities.User.list();
    console.log(`👥 Found ${users.length} users\n`);

    // Analyze each account
    const accountsWithRenewals = [];
    const today = new Date();

    for (const account of activeAccounts) {
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      const renewalDate = calculateRenewalDate(accountEstimates);

      if (!renewalDate) continue;

      const daysUntilRenewal = getDaysUntilRenewal(renewalDate);
      const isWithinSixMonths = isRenewalWithinDays(renewalDate, 180);

      if (isWithinSixMonths && daysUntilRenewal >= 0) {
        accountsWithRenewals.push({
          account,
          renewalDate,
          daysUntilRenewal,
          wonEstimatesCount: accountEstimates.filter(e => e.status === 'won').length
        });
      }
    }

    // Sort by days until renewal (soonest first)
    accountsWithRenewals.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

    console.log('📅 Accounts with Renewals Coming Up (within 6 months):\n');
    console.log('─'.repeat(80));

    if (accountsWithRenewals.length === 0) {
      console.log('⚠️  No accounts found with renewals within 6 months');
      console.log('\n💡 Tip: To test, you can:');
      console.log('   1. Update an estimate\'s contract_end to be 30-180 days in the future');
      console.log('   2. Make sure the estimate status is "won"');
      console.log('   3. Run this function again\n');
      return { accountsWithRenewals: [], summary: 'No renewals found' };
    }

    accountsWithRenewals.forEach(({ account, renewalDate, daysUntilRenewal, wonEstimatesCount }) => {
      console.log(`\n🏢 ${account.name}`);
      console.log(`   Renewal Date: ${format(renewalDate, 'MMM d, yyyy')}`);
      console.log(`   Days Until Renewal: ${daysUntilRenewal} days`);
      console.log(`   Won Estimates: ${wonEstimatesCount}`);
      console.log(`   Would create notification for ${users.length} users`);
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`\n✅ Found ${accountsWithRenewals.length} account(s) that would trigger notifications\n`);

    // Check for existing notifications
    const allNotifications = await base44.entities.Notification.list();
    const renewalNotifications = allNotifications.filter(
      n => n.type === 'renewal_reminder' && !n.is_read
    );

    console.log(`📬 Existing unread renewal notifications: ${renewalNotifications.length}`);
    
    if (renewalNotifications.length > 0) {
      console.log('\nRecent notifications:');
      renewalNotifications.slice(0, 5).forEach(notif => {
        const account = accounts.find(a => a.id === notif.related_account_id);
        console.log(`   - ${account?.name || notif.related_account_id}, Created: ${format(new Date(notif.created_at), 'MMM d, yyyy h:mm a')}`);
      });
    }

    return {
      accountsWithRenewals,
      summary: `Found ${accountsWithRenewals.length} accounts with renewals within 6 months`,
      existingNotifications: renewalNotifications.length
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return { error: error.message };
  }
}

/**
 * Manually trigger renewal notifications (for testing)
 */
export async function manuallyTriggerRenewalNotifications() {
  console.log('🚀 Manually triggering renewal notifications...\n');
  
  try {
    const { createRenewalNotifications } = await import('@/services/notificationService');
    await createRenewalNotifications();
    console.log('✅ Renewal notifications created! Check your notification bell.\n');
    return { success: true };
  } catch (error) {
    console.error('❌ Error:', error);
    return { error: error.message };
  }
}

