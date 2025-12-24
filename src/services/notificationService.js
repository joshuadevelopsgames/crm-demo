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
  try {
    // Get all accounts
    const accounts = await base44.entities.Account.list();
    
    // Get all estimates
    const estimates = await base44.entities.Estimate.list();
    
    // Get all users
    const users = await base44.entities.User.list();
    const currentUser = await base44.auth.me();
    const usersToNotify = users.length > 0 ? users : (currentUser?.id ? [currentUser] : []);
    
    if (usersToNotify.length === 0) {
      console.warn('No users found for renewal notifications');
      return;
    }

    const today = startOfDay(new Date());
    const sixMonthsFromNow = subMonths(today, -6); // 6 months in the future
    
    // Process each account
    for (const account of accounts) {
      if (account.archived) continue;
      
      // Get estimates for this account
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      
      // Calculate renewal date from estimates
      const renewalDate = calculateRenewalDate(accountEstimates);
      
      if (!renewalDate) continue; // No renewal date found
      
      const renewalDateStart = startOfDay(renewalDate);
      const daysUntilRenewal = differenceInDays(renewalDateStart, today);
      
      // Only create notification if renewal is within 6 months (180 days) and in the future
      if (daysUntilRenewal < 0 || daysUntilRenewal > 180) continue;
      
      // Check if notification should be shown (6 months before = 180 days)
      // We want to show it when we're exactly 6 months away, or close to it
      const daysUntilSixMonths = differenceInDays(renewalDateStart, sixMonthsFromNow);
      
      // Create notification for all users
      for (const user of usersToNotify) {
        if (!user?.id) continue;
        
        // Check if user has snoozed this notification
        const isSnoozed = await checkNotificationSnoozed(user.id, 'renewal_reminder', account.id);
        if (isSnoozed) continue; // User has snoozed this notification
        
        // Check if notification already exists
        const existingNotifications = await base44.entities.Notification.filter({
          user_id: user.id,
          type: 'renewal_reminder',
          related_account_id: account.id,
          is_read: false
        });
        
        if (existingNotifications.length > 0) continue; // Already exists
        
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
      }
    }
  } catch (error) {
    console.error('Error creating renewal notifications:', error);
  }
}

/**
 * Check if a notification is snoozed for a user
 * @param {string} userId - User ID
 * @param {string} notificationType - Type of notification
 * @param {string} accountId - Account ID (optional)
 * @returns {Promise<boolean>} - True if snoozed
 */
export async function checkNotificationSnoozed(userId, notificationType, accountId = null) {
  try {
    let url = `/api/data/notificationSnoozes?user_id=${encodeURIComponent(userId)}&notification_type=${encodeURIComponent(notificationType)}`;
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
    const now = new Date();
    
    // Find active snooze for this user, type, and account
    const activeSnooze = snoozes.find(snooze => {
      const matchesUser = snooze.user_id === userId;
      const matchesType = snooze.notification_type === notificationType;
      const matchesAccount = accountId 
        ? snooze.related_account_id === accountId 
        : (snooze.related_account_id === null || snooze.related_account_id === 'null' || !snooze.related_account_id);
      const isActive = new Date(snooze.snoozed_until) > now;
      
      return matchesUser && matchesType && matchesAccount && isActive;
    });
    
    return !!activeSnooze;
  } catch (error) {
    console.error('Error checking notification snooze:', error);
    return false;
  }
}

/**
 * Snooze a notification for a user
 * @param {string} userId - User ID
 * @param {string} notificationType - Type of notification
 * @param {string} accountId - Account ID (optional)
 * @param {Date} snoozedUntil - Date until which to snooze
 * @returns {Promise<Object>} - The snooze record
 */
export async function snoozeNotification(userId, notificationType, accountId = null, snoozedUntil) {
  try {
    const response = await fetch('/api/data/notificationSnoozes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'snooze',
        data: {
          user_id: userId,
          notification_type: notificationType,
          related_account_id: accountId,
          snoozed_until: snoozedUntil.toISOString()
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

