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

    // Get all estimates - use API endpoint to ensure contract_end field is included
    const estimatesResponse = await fetch('/api/data/estimates');
    let estimates = [];
    if (estimatesResponse.ok) {
      const result = await estimatesResponse.json();
      if (result.success) {
        estimates = result.data || [];
      } else {
        console.warn('⚠️ Estimates API returned error, falling back to base44:', result.error);
        estimates = await base44.entities.Estimate.list();
      }
    } else {
      console.warn('⚠️ Failed to fetch estimates from API, falling back to base44');
      estimates = await base44.entities.Estimate.list();
    }
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
    // NOTE: This is a test utility, so we'll get current user and filter by user_id
    const currentUser = await base44.auth.me();
    const allNotifications = currentUser?.id 
      ? await base44.entities.Notification.filter({ user_id: currentUser.id })
      : [];
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
 * Preview what renewal notifications would be created (read-only, no data changes)
 */
export async function previewRenewalNotifications() {
  console.log('👀 Previewing Renewal Notifications (Read-Only)...\n');
  
  try {
    const accounts = await base44.entities.Account.list();
    
    // Use API endpoint to ensure contract_end field is included
    const estimatesResponse = await fetch('/api/data/estimates');
    let estimates = [];
    if (estimatesResponse.ok) {
      const result = await estimatesResponse.json();
      if (result.success) {
        estimates = result.data || [];
      } else {
        console.warn('⚠️ Estimates API returned error, falling back to base44:', result.error);
        estimates = await base44.entities.Estimate.list();
      }
    } else {
      console.warn('⚠️ Failed to fetch estimates from API, falling back to base44');
      estimates = await base44.entities.Estimate.list();
    }
    
    const users = await base44.entities.User.list();
    
    const activeAccounts = accounts.filter(acc => !acc.archived);
    const today = new Date();
    const notificationsToCreate = [];
    
    for (const account of activeAccounts) {
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      const renewalDate = calculateRenewalDate(accountEstimates);
      
      if (!renewalDate) continue;
      
      const renewalDateStart = new Date(renewalDate);
      renewalDateStart.setHours(0, 0, 0, 0);
      const daysUntilRenewal = getDaysUntilRenewal(renewalDate);
      
      // Only show if renewal is within 6 months (180 days) and in the future
      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 180) {
        // Check if notification already exists
        // Get current user for filtering
        const currentUser = await base44.auth.me();
        const allNotifications = currentUser?.id 
          ? await base44.entities.Notification.filter({ user_id: currentUser.id })
          : [];
        const existingNotif = allNotifications.find(
          n => n.type === 'renewal_reminder' && 
               n.related_account_id === account.id && 
               !n.is_read
        );
        
        // Check if snoozed
        let isSnoozed = false;
        try {
          const response = await fetch(`/api/data/notificationSnoozes?notification_type=renewal_reminder&related_account_id=${account.id}`);
          const result = await response.json();
          if (result.success && result.data && result.data.length > 0) {
            const now = new Date();
            isSnoozed = result.data.some(s => new Date(s.snoozed_until) > now);
          }
        } catch (e) {
          // Ignore errors
        }
        
        notificationsToCreate.push({
          account: account.name,
          accountId: account.id,
          renewalDate: format(renewalDate, 'MMM d, yyyy'),
          daysUntilRenewal,
          wouldCreateForUsers: users.length,
          alreadyExists: !!existingNotif,
          isSnoozed,
          status: existingNotif ? '⚠️ Already exists' : isSnoozed ? '🔕 Snoozed' : '✅ Would create'
        });
      }
    }
    
    notificationsToCreate.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
    
    console.log('📋 Preview of Notifications That Would Be Created:\n');
    console.log('─'.repeat(100));
    
    if (notificationsToCreate.length === 0) {
      console.log('ℹ️  No notifications would be created at this time.');
      console.log('   (No accounts have renewals within 6 months)\n');
      return { notificationsToCreate: [], summary: 'No notifications to create' };
    }
    
    notificationsToCreate.forEach((notif, index) => {
      console.log(`\n${index + 1}. ${notif.status} ${notif.account}`);
      console.log(`   Renewal: ${notif.renewalDate} (${notif.daysUntilRenewal} days)`);
      console.log(`   Would notify: ${notif.wouldCreateForUsers} users`);
      if (notif.alreadyExists) console.log(`   ⚠️  Notification already exists`);
      if (notif.isSnoozed) console.log(`   🔕 Currently snoozed`);
    });
    
    console.log('\n' + '─'.repeat(100));
    console.log(`\n📊 Summary: ${notificationsToCreate.length} notification(s) would be created\n`);
    
    return {
      notificationsToCreate,
      summary: `${notificationsToCreate.length} notifications would be created`,
      totalUsers: users.length
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    return { error: error.message };
  }
}

/**
 * Manually trigger renewal notifications (for testing)
 * WARNING: This will create actual notifications
 */
export async function manuallyTriggerRenewalNotifications() {
  console.log('🚀 Manually triggering renewal notifications...\n');
  console.log('⚠️  WARNING: This will create actual notifications!\n');
  
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

