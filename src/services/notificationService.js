import { base44 } from '@/api/base44Client';
import { differenceInDays, isToday, isPast, startOfDay, addDays, getYear, getMonth, getDate, subMonths, format } from 'date-fns';
import { calculateRenewalDate } from '@/utils/renewalDateCalculator';

/**
 * Create notifications for task reminders
 * This service automatically creates notifications when tasks are created or updated
 */
export async function createTaskNotifications(task) {
  if (!task.due_date || task.status === 'completed') {
    return; // No notifications for tasks without due dates or completed tasks
  }

  const dueDate = new Date(task.due_date);
  const today = startOfDay(new Date());
  const taskDate = startOfDay(dueDate);
  
  // Get the user assigned to the task (or default to current user)
  const currentUser = await base44.auth.me();
  const assignedUser = task.assigned_to || currentUser.email;
  
  // Find user by email
  const users = await base44.entities.User.list();
  let user = users.find(u => u.email === assignedUser);
  
  // If user not found by email, use current user or first user as fallback
  if (!user) {
    user = currentUser.id ? users.find(u => u.id === currentUser.id) : users[0];
  }
  
  if (!user || !user.id) {
    console.warn('Could not find user for notification:', assignedUser);
    return;
  }

  const daysUntilDue = differenceInDays(taskDate, today);
  const isOverdue = isPast(taskDate) && !isToday(taskDate);
  const isDueToday = isToday(taskDate);

  // Check if notification already exists
  const existingNotifications = await base44.entities.Notification.filter({
    user_id: user.id,
    related_task_id: task.id,
    is_read: false
  });

  // Remove existing notifications for this task
  for (const notif of existingNotifications) {
    await base44.entities.Notification.update(notif.id, { is_read: true });
  }

  // Create notification based on task status
  if (isOverdue) {
    // Task is overdue
    await base44.entities.Notification.create({
      user_id: user.id,
      type: 'task_overdue',
      title: 'Task Overdue',
      message: `"${task.title}" is overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`,
      related_task_id: task.id,
      related_account_id: task.related_account_id || null,
      scheduled_for: new Date().toISOString()
    });
  } else if (isDueToday) {
    // Task is due today
    await base44.entities.Notification.create({
      user_id: user.id,
      type: 'task_due_today',
      title: 'Task Due Today',
      message: `"${task.title}" is due today`,
      related_task_id: task.id,
      related_account_id: task.related_account_id || null,
      scheduled_for: new Date().toISOString()
    });
  } else if (daysUntilDue === 1) {
    // Task is due tomorrow
    await base44.entities.Notification.create({
      user_id: user.id,
      type: 'task_reminder',
      title: 'Task Due Tomorrow',
      message: `"${task.title}" is due tomorrow`,
      related_task_id: task.id,
      related_account_id: task.related_account_id || null,
      scheduled_for: addDays(today, 1).toISOString()
    });
  } else if (daysUntilDue <= 7) {
    // Task is due within a week
    await base44.entities.Notification.create({
      user_id: user.id,
      type: 'task_reminder',
      title: 'Task Due Soon',
      message: `"${task.title}" is due in ${daysUntilDue} days`,
      related_task_id: task.id,
      related_account_id: task.related_account_id || null,
      scheduled_for: taskDate.toISOString()
    });
  }
}

/**
 * Clean up notifications for completed tasks
 */
export async function cleanupTaskNotifications(taskId) {
  const notifications = await base44.entities.Notification.filter({
    related_task_id: taskId,
    is_read: false
  });
  
  for (const notification of notifications) {
    await base44.entities.Notification.update(notification.id, { is_read: true });
  }
}

/**
 * Create End of Year Data Analysis notification on December 15th every year
 * This notification appears once per year and is dismissible
 */
export async function createEndOfYearNotification() {
  const today = new Date();
  const currentMonth = getMonth(today); // 0-11, December is 11
  const currentDay = getDate(today); // 1-31
  const currentYear = getYear(today);

  // Only create notification on December 15th
  if (currentMonth !== 11 || currentDay !== 15) {
    return;
  }

  try {
    // Get all users
    const users = await base44.entities.User.list();
    const currentUser = await base44.auth.me();
    
    // If we can't get users, try with current user
    const usersToNotify = users.length > 0 ? users : (currentUser?.id ? [currentUser] : []);

    for (const user of usersToNotify) {
      if (!user?.id) continue;

      // Check if notification already exists for this year
      const existingNotifications = await base44.entities.Notification.filter({
        user_id: user.id,
        type: 'end_of_year_analysis',
        is_read: false
      });

      // Check if any existing notification was created this year
      const thisYearNotification = existingNotifications.find(notif => {
        if (!notif.created_at) return false;
        const notifYear = getYear(new Date(notif.created_at));
        return notifYear === currentYear;
      });

      // If notification already exists for this year, skip
      if (thisYearNotification) {
        continue;
      }

      // Create the notification
      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'end_of_year_analysis',
        title: 'End of Year Data Analysis',
        message: `It's time to review your ${currentYear} performance! View comprehensive reports with win/loss analysis, department breakdowns, and revenue trends.`,
        related_account_id: null,
        related_task_id: null,
        scheduled_for: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error creating end of year notification:', error);
  }
}

/**
 * Create renewal notifications for accounts with renewals coming up in 6 months
 * This creates universal notifications that all users see, but can be snoozed individually
 */
export async function createRenewalNotifications() {
  console.log('🔄 Starting renewal notification creation...');
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let atRiskUpdatedCount = 0;
  let atRiskAlreadyCount = 0;
  
  try {
    // Get all accounts
    const accounts = await base44.entities.Account.list();
    console.log(`📊 Found ${accounts.length} accounts`);
    
    // Get all estimates
    const estimates = await base44.entities.Estimate.list();
    console.log(`📋 Found ${estimates.length} estimates`);
    
    // Get all users - handle errors gracefully
    let users = [];
    let currentUser = null;
    try {
      users = await base44.entities.User.list();
      console.log(`👥 Found ${users.length} users`);
    } catch (error) {
      console.warn('Error fetching users list:', error);
    }
    
    try {
      currentUser = await base44.auth.me();
    } catch (error) {
      console.warn('Error fetching current user:', error);
    }
    
    const usersToNotify = users.length > 0 ? users : (currentUser?.id ? [currentUser] : []);
    
    if (usersToNotify.length === 0) {
      console.warn('⚠️ No users found for renewal notifications - skipping');
      return;
    }

    const today = startOfDay(new Date());
    
    // Process each account
    for (const account of accounts) {
      if (account.archived) continue;
      
      // Get estimates for this account
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      
      // Calculate renewal date from estimates
      const renewalDate = calculateRenewalDate(accountEstimates);
      
      if (!renewalDate) {
        // No renewal date - if account is at_risk only because of renewal, consider removing it
        // But we'll be conservative and only remove if it was explicitly set to at_risk
        // (we don't want to remove manually set at_risk statuses)
        continue;
      }
      
      const renewalDateStart = startOfDay(renewalDate);
      const daysUntilRenewal = differenceInDays(renewalDateStart, today);
      
      // Determine if account SHOULD be at_risk based on renewal date (source of truth)
      // This is independent of the status field - renewal date is the authoritative source
      const shouldBeAtRisk = daysUntilRenewal >= 0 && daysUntilRenewal <= 180;
      const isCurrentlyAtRisk = account.status === 'at_risk';
      
      // Update status field to match reality (renewal date is source of truth)
      if (shouldBeAtRisk) {
        // Account SHOULD be at_risk - update status if it's not already
        if (isCurrentlyAtRisk) {
          atRiskAlreadyCount++;
          // Already at_risk, no update needed
        } else if (account.status === 'churned') {
          // Don't update churned accounts
        } else {
          // Update to at_risk - retry on failure, but don't fail if update doesn't work
          let updateSuccess = false;
          let retries = 0;
          const maxRetries = 3;
          
          while (!updateSuccess && retries < maxRetries) {
            try {
              await base44.entities.Account.update(account.id, { status: 'at_risk' });
              atRiskUpdatedCount++;
              updateSuccess = true;
              console.log(`⚠️ Marked ${account.name} as at_risk (renewal in ${daysUntilRenewal} days, was: ${account.status})`);
            } catch (error) {
              retries++;
              const errorDetails = {
                accountId: account.id,
                accountName: account.name,
                currentStatus: account.status,
                errorMessage: error.message,
                errorStack: error.stack,
                errorResponse: error.response || error.body || null
              };
              
              if (retries >= maxRetries) {
                errorCount++;
                console.error(`❌ Error updating account status for ${account.name} after ${maxRetries} retries:`, errorDetails);
                console.error(`   Full error object:`, error);
                // Status update failed, but account SHOULD still be at_risk based on renewal date
                // We'll continue to create notifications because renewal date is the source of truth
              } else {
                console.warn(`⚠️ Retry ${retries}/${maxRetries} for ${account.name} status update...`, errorDetails);
                await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
              }
            }
          }
        }
      } else if (isCurrentlyAtRisk && (daysUntilRenewal < 0 || daysUntilRenewal > 180)) {
        // Renewal is past or more than 6 months away - remove at_risk status (set back to active)
        // Only if it was at_risk (might have been set for renewal reasons)
        try {
          await base44.entities.Account.update(account.id, { status: 'active' });
          console.log(`✅ Removed at_risk status from ${account.name} (renewal ${daysUntilRenewal < 0 ? 'passed' : 'more than 6 months away'})`);
        } catch (error) {
          console.error(`❌ Error updating account status for ${account.name}:`, error);
        }
      }
      
      // Create notification if renewal is within 6 months (180 days) and in the future
      // Use renewal date as source of truth, not status field
      if (!shouldBeAtRisk) continue;
      
      // Check if this notification is snoozed (universal - any user can snooze for everyone)
      const isSnoozed = await checkNotificationSnoozed('renewal_reminder', account.id);
      if (isSnoozed) {
        skippedCount++;
        continue; // Notification is snoozed for all users
      }
      
      // Create notifications based on renewal date (source of truth), not status field
      // If renewal is within 6 months, account should be at_risk regardless of status update success
      
      // Create notification for all users
      for (const user of usersToNotify) {
        if (!user?.id) continue;
        
        try {
          // Check if notification already exists (unread or read - avoid duplicates)
          const existingNotifications = await base44.entities.Notification.filter({
            user_id: user.id,
            type: 'renewal_reminder',
            related_account_id: account.id
          });
          
          // Check if there's an existing notification created today (to avoid duplicates)
          const today = startOfDay(new Date());
          const hasNotificationToday = existingNotifications.some(notif => {
            const notifDate = startOfDay(new Date(notif.created_at));
            return notifDate.getTime() === today.getTime();
          });
          
          if (hasNotificationToday) {
            skippedCount++;
            continue; // Already created today
          }
          
          // Create the notification
          await base44.entities.Notification.create({
            user_id: user.id,
            type: 'renewal_reminder',
            title: `Renewal Coming Up: ${account.name}`,
            message: `Contract renewal is in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''} (${format(renewalDate, 'MMM d, yyyy')})`,
            related_account_id: account.id,
            related_task_id: null,
            scheduled_for: renewalDateStart.toISOString()
          });
          
          createdCount++;
          console.log(`✅ Created notification for ${account.name} (${daysUntilRenewal} days) for user ${user.email || user.id}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error creating notification for ${account.name} for user ${user.email || user.id}:`, error);
        }
      }
    }
    
    // Clean up notifications for accounts that are no longer at_risk
    // This handles cases where accounts were previously at_risk but no longer meet criteria
    // NOTE: This is a system-wide cleanup that needs to see all notifications
    // We'll fetch all users and clean up notifications for each user separately
    let cleanupCount = 0;
    try {
      // Get all users to clean up notifications per user
      const users = await base44.entities.User.list();
      
      for (const user of users) {
        if (!user?.id) continue;
        
        // Get renewal reminder notifications for this user
        const userRenewalNotifications = await base44.entities.Notification.filter({
          user_id: user.id,
          type: 'renewal_reminder'
        });
      
      // Get all accounts that are currently at_risk
      const atRiskAccountIds = new Set(
        accounts
          .filter(acc => acc.status === 'at_risk' && !acc.archived)
          .map(acc => acc.id)
      );
      
        // Delete notifications for accounts that are no longer at_risk
        for (const notification of userRenewalNotifications) {
        if (notification.related_account_id && !atRiskAccountIds.has(notification.related_account_id)) {
          try {
            const response = await fetch(`/api/data/notifications?id=${notification.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (result.success) {
              cleanupCount++;
            } else {
              console.error(`❌ Error deleting notification ${notification.id}:`, result.error);
            }
          } catch (error) {
            console.error(`❌ Error deleting notification ${notification.id}:`, error);
          }
        }
      }
      
      if (cleanupCount > 0) {
        console.log(`🧹 Cleaned up ${cleanupCount} renewal notifications for accounts no longer at_risk`);
      }
    } catch (cleanupError) {
      console.error('❌ Error cleaning up renewal notifications:', cleanupError);
    }
    
    console.log(`✅ Renewal notification creation complete: ${createdCount} created, ${skippedCount} skipped, ${errorCount} errors`);
    console.log(`⚠️ At Risk Status: ${atRiskUpdatedCount} updated, ${atRiskAlreadyCount} already at_risk`);
    console.log(`📊 Total accounts with renewals within 6 months: ${atRiskUpdatedCount + atRiskAlreadyCount}`);
    console.log(`🧹 Cleaned up ${cleanupCount} stale notifications`);
  } catch (error) {
    console.error('❌ Error creating renewal notifications:', error);
  }
}

/**
 * Check if a notification is snoozed (universal - applies to all users)
 * @param {string} notificationType - Type of notification
 * @param {string} accountId - Account ID (optional)
 * @returns {Promise<boolean>} - True if snoozed
 */
export async function checkNotificationSnoozed(notificationType, accountId = null) {
  try {
    let url = `/api/data/notificationSnoozes?notification_type=${encodeURIComponent(notificationType)}`;
    if (accountId) {
      url += `&related_account_id=${encodeURIComponent(accountId)}`;
    } else {
      url += `&related_account_id=null`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) return false;
    
    const result = await response.json();
    if (!result.success) return false;
    
    const snoozes = result.data || [];
    
    // If any active snooze exists, the notification is snoozed for everyone
    return snoozes.length > 0;
  } catch (error) {
    console.error('Error checking notification snooze:', error);
    return false;
  }
}

/**
 * Snooze a notification (universal - applies to all users)
 * @param {string} notificationType - Type of notification
 * @param {string} accountId - Account ID (optional)
 * @param {Date} snoozedUntil - Date until which to snooze
 * @param {string} snoozedBy - User ID who snoozed it (optional, for audit)
 * @returns {Promise<Object>} - The snooze record
 */
export async function snoozeNotification(notificationType, accountId = null, snoozedUntil, snoozedBy = null) {
  try {
    const response = await fetch('/api/data/notificationSnoozes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'snooze',
        data: {
          notification_type: notificationType,
          related_account_id: accountId,
          snoozed_until: snoozedUntil.toISOString(),
          snoozed_by: snoozedBy
        }
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to snooze notification');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error snoozing notification:', error);
    throw error;
  }
}

