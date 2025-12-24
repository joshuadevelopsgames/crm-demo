/**
 * Test script for renewal notifications
 * 
 * This script helps test the renewal notification system by:
 * 1. Finding accounts with renewals coming up
 * 2. Showing what notifications would be created
 * 3. Optionally creating test notifications with shorter timeframes
 * 
 * Usage:
 *   node test_renewal_notifications.js [--create] [--days=30]
 */

import { createClient } from '@supabase/supabase-js';
import { calculateRenewalDate, getDaysUntilRenewal, isRenewalWithinDays } from './src/utils/renewalDateCalculator.js';
import { format, addDays } from 'date-fns';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testRenewalNotifications() {
  console.log('🔍 Testing Renewal Notification System...\n');

  try {
    // Get all accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, archived')
      .eq('archived', false);

    if (accountsError) {
      console.error('❌ Error fetching accounts:', accountsError);
      return;
    }

    console.log(`📊 Found ${accounts.length} active accounts\n`);

    // Get all estimates
    const { data: estimates, error: estimatesError } = await supabase
      .from('estimates')
      .select('id, account_id, status, contract_end, estimate_id');

    if (estimatesError) {
      console.error('❌ Error fetching estimates:', estimatesError);
      return;
    }

    console.log(`📋 Found ${estimates.length} total estimates\n`);

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`👥 Found ${users.length} users\n`);

    // Analyze each account
    const accountsWithRenewals = [];
    const today = new Date();
    const sixMonthsFromNow = addDays(today, 180);

    for (const account of accounts) {
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
      console.log('   3. Run this script again\n');
      return;
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
    const { data: existingNotifications, error: notifError } = await supabase
      .from('notifications')
      .select('id, type, related_account_id, is_read, created_at')
      .eq('type', 'renewal_reminder')
      .eq('is_read', false);

    if (!notifError && existingNotifications) {
      console.log(`📬 Existing unread renewal notifications: ${existingNotifications.length}`);
      
      if (existingNotifications.length > 0) {
        console.log('\nRecent notifications:');
        existingNotifications.slice(0, 5).forEach(notif => {
          console.log(`   - Account ID: ${notif.related_account_id}, Created: ${format(new Date(notif.created_at), 'MMM d, yyyy h:mm a')}`);
        });
      }
    }

    // Check for snoozes
    const { data: snoozes, error: snoozeError } = await supabase
      .from('notification_snoozes')
      .select('*')
      .eq('notification_type', 'renewal_reminder')
      .gt('snoozed_until', new Date().toISOString());

    if (!snoozeError && snoozes) {
      console.log(`\n🔕 Active snoozes: ${snoozes.length}`);
      if (snoozes.length > 0) {
        snoozes.forEach(snooze => {
          console.log(`   - Account: ${snooze.related_account_id || 'All'}, Snoozed until: ${format(new Date(snooze.snoozed_until), 'MMM d, yyyy')}`);
        });
      }
    }

    console.log('\n💡 To manually trigger notifications:');
    console.log('   1. Go to the Dashboard page in your app');
    console.log('   2. The createRenewalNotifications() function will run automatically');
    console.log('   3. Check the notification bell for renewal reminders\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testRenewalNotifications();

