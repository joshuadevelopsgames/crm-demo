import { base44 } from '@/api/base44Client';
import { differenceInDays, isToday, isPast, startOfDay, addDays, getYear, getMonth, getDate, subMonths, format } from 'date-fns';
import { calculateRenewalDate } from '@/utils/renewalDateCalculator';

/**
 * Parse assigned users from comma-separated string
 */
function parseAssignedUsers(assignedTo) {
  if (!assignedTo || assignedTo.trim() === '') return [];
  return assignedTo.split(',').map(email => email.trim()).filter(Boolean);
}

/**
 * Create notifications when a task is assigned to users
 */
export async function createTaskAssignmentNotifications(task, previousAssignedTo = null) {
  if (!task || !task.id) return;

  // Skip creating assignment notifications for overdue tasks
  // (overdue tasks should only show task_overdue notifications, not task_assigned)
  if (task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed') {
    console.log(`⏭️  Skipping assignment notification for overdue task: "${task.title}"`);
    return;
  }

  const currentAssigned = parseAssignedUsers(task.assigned_to || '');
  const previousAssigned = previousAssignedTo ? parseAssignedUsers(previousAssignedTo) : [];
  
  // Find newly assigned users (users in current but not in previous)
  const newlyAssigned = currentAssigned.filter(email => !previousAssigned.includes(email));
  
  if (newlyAssigned.length === 0) return;

  // Get all users
  const users = await base44.entities.User.list();
  
  // Create assignment notification for each newly assigned user
  for (const email of newlyAssigned) {
    const user = users.find(u => u.email === email);
    if (!user || !user.id) {
      console.warn('Could not find user for assignment notification:', email);
      continue;
    }

    // Check if assignment notification already exists
    const existingNotifications = await base44.entities.Notification.filter({
      user_id: user.id,
      related_task_id: task.id,
      type: 'task_assigned',
      is_read: false
    });

    // Only create if no existing unread assignment notification
    if (existingNotifications.length === 0) {
      try {
        await base44.entities.Notification.create({
          user_id: user.id,
          type: 'task_assigned',
          title: 'Task Assigned',
          message: `The task "${task.title}" has been assigned to you`,
          related_task_id: task.id,
          related_account_id: task.related_account_id || null,
          scheduled_for: new Date().toISOString()
        });
        console.log(`✅ Created assignment notification for user: ${email}`);
      } catch (error) {
        console.error(`❌ Error creating assignment notification for ${email}:`, error);
      }
    }
  }
}

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
  
  // Get all assigned users (support multiple users)
  const assignedUsers = parseAssignedUsers(task.assigned_to || '');
  const currentUser = await base44.auth.me();
  
  // If no assigned users, default to current user
  const usersToNotify = assignedUsers.length > 0 ? assignedUsers : [currentUser.email];
  
  // Get all users
  const allUsers = await base44.entities.User.list();
  
  const daysUntilDue = differenceInDays(taskDate, today);
  const isOverdue = isPast(taskDate) && !isToday(taskDate);
  const isDueToday = isToday(taskDate);

  // Create notifications for each assigned user
  for (const email of usersToNotify) {
    const user = allUsers.find(u => u.email === email);
    
    // If user not found by email, skip
    if (!user || !user.id) {
      console.warn('Could not find user for notification:', email);
      continue;
    }

    // Check if notification already exists (check both read and unread to avoid duplicates)
    const existingNotifications = await base44.entities.Notification.filter({
      user_id: user.id,
      related_task_id: task.id
    });

    // Remove existing notifications for this task (except assignment and overdue notifications)
    // Overdue notifications are managed by createOverdueTaskNotifications() and should persist
    // until the task is completed or no longer overdue
    for (const notif of existingNotifications) {
      if (notif.type !== 'task_assigned' && notif.type !== 'task_overdue') {
        await base44.entities.Notification.update(notif.id, { is_read: true });
      }
    }

    // Create notification based on task status
    if (isOverdue) {
      // Task is overdue - check if notification already exists (read or unread) to avoid duplicates
      // createOverdueTaskNotifications() handles overdue notifications periodically, but we check here
      // to avoid creating duplicates when tasks are updated
      const existingOverdueNotif = existingNotifications.find(
        n => n.type === 'task_overdue'
      );
      
      if (!existingOverdueNotif) {
        // Only create if it doesn't already exist
        await base44.entities.Notification.create({
          user_id: user.id,
          type: 'task_overdue',
          title: 'Task Overdue',
          message: `"${task.title}" is overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`,
          related_task_id: task.id,
          related_account_id: task.related_account_id || null,
          scheduled_for: new Date().toISOString()
        });
      }
      // Note: createOverdueTaskNotifications() will handle creating overdue notifications for all users
      // This is just for immediate notification when a task becomes overdue during create/update
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
 * Create notifications for all overdue tasks
 * This function checks all tasks and creates overdue notifications for tasks that are past their due date
 * Should be called periodically (e.g., daily or on dashboard load)
 */
export async function createOverdueTaskNotifications() {
  console.log('🔄 Starting overdue task notification creation...');
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let overdueTaskCount = 0;
  
  try {
    // Get current user from auth (same source as NotificationBell uses for fetching)
    const currentUser = await base44.auth.me();
    if (!currentUser?.id) {
      console.warn('⚠️ No current user found, cannot create overdue task notifications');
      return;
    }
    const currentUserIdStr = String(currentUser.id).trim();
    console.log(`👤 Current user: ${currentUser.email} (id: ${currentUserIdStr})`);
    
    // Get all tasks
    const tasks = await base44.entities.Task.list();
    console.log(`📊 Found ${tasks.length} tasks`);
    
    // Get all users for matching assigned users by email
    const allUsers = await base44.entities.User.list();
    console.log(`👥 Found ${allUsers.length} users:`, allUsers.map(u => u.email || u.id).join(', '));
    
    const today = startOfDay(new Date());
    
    // Phase 1: Collect all overdue task notifications to create
    const notificationsToCreate = [];
    
    // Process each task - use EXACT same logic as Dashboard
    for (const task of tasks) {
      // Skip tasks without due dates or completed tasks (matches Dashboard logic exactly)
      if (!task.due_date || task.status === 'completed') {
        continue;
      }
      
      // Task is overdue if due date is before now (matches Dashboard logic EXACTLY: new Date(task.due_date) < new Date())
      const isOverdue = new Date(task.due_date) < new Date();
      // Only process overdue tasks
      if (!isOverdue) {
        continue;
      }
      
      const dueDate = new Date(task.due_date);
      const taskDate = startOfDay(dueDate);
      const daysUntilDue = differenceInDays(taskDate, today);
      
      overdueTaskCount++;
      console.log(`📋 Found overdue task: "${task.title}" (due: ${task.due_date}, days overdue: ${Math.abs(daysUntilDue)}, status: ${task.status})`);
      
      // Get assigned users
      const assignedUsers = parseAssignedUsers(task.assigned_to || '');
      
      // Determine which users should receive notifications
      // CRITICAL: Always include current user for overdue tasks (dashboard shows all overdue tasks to current user)
      // Also include assigned users if task is assigned
      const usersToNotifySet = new Set();
      
      // Always add current user (they see all overdue tasks on dashboard)
      if (currentUser.email) {
        usersToNotifySet.add(currentUser.email);
      }
      
      // Also add assigned users if task is assigned
      if (assignedUsers.length > 0) {
        assignedUsers.forEach(email => usersToNotifySet.add(email));
      }
      
      const usersToNotify = Array.from(usersToNotifySet);
      
      console.log(`   - Assigned users: ${assignedUsers.length > 0 ? assignedUsers.join(', ') : 'none'}`);
      console.log(`   - Users to notify: ${usersToNotify.length} user(s) - ${usersToNotify.join(', ')}`);
      
      // Collect notification data for each user
      for (const email of usersToNotify) {
        let user = null;
        let userIdToUse = null;
        
        // If this is the current user's email, ALWAYS use current user's auth ID (from auth.me())
        if (email === currentUser.email) {
          user = currentUser;
          userIdToUse = currentUserIdStr;
          console.log(`   ✅ Using current user auth ID: ${userIdToUse} for ${email}`);
        } else {
          // For other users, find them in the allUsers list
          // In Supabase, profile.id should match auth.users.id, but we'll use profile ID
          const profileUser = allUsers.find(u => u.email === email);
          if (profileUser && profileUser.id) {
            user = profileUser;
            userIdToUse = String(profileUser.id).trim();
            console.log(`   ✅ Using profile ID for other user: ${userIdToUse} for ${email}`);
          }
        }
        
        if (!user || !userIdToUse) {
          console.warn(`   ⚠️ Could not find user for overdue task notification: ${email}`);
          continue;
        }
        
        console.log(`   ✅ Will create notification for user: ${user.email} (id: ${userIdToUse}, isCurrentUser: ${email === currentUser.email}, currentUserId: ${currentUserIdStr})`);
        notificationsToCreate.push({
          user_id: userIdToUse, // Use normalized user ID
          task_id: task.id,
          task_title: task.title,
          daysOverdue: Math.abs(daysUntilDue),
          related_account_id: task.related_account_id || null
        });
      }
    }
    
    // Phase 2: Batch check existing notifications and create missing ones
    console.log(`📋 Collected ${notificationsToCreate.length} overdue task notifications to create`);
    
    if (notificationsToCreate.length > 0) {
      // Get all existing overdue task notifications for all users in one batch
      const allExistingNotifications = await base44.entities.Notification.filter({
        type: 'task_overdue'
      });
      
      // Create a set of existing notification keys (user_id + task_id)
      // Track both read and unread to avoid duplicates, but mark read ones as unread
      const existingKeys = new Set();
      const readNotificationsToUpdate = [];
      
      for (const notif of allExistingNotifications) {
        if (!notif.related_task_id) continue; // Skip notifications without task_id
        
        const notifUserIdStr = String(notif.user_id || '').trim();
        const taskIdStr = String(notif.related_task_id).trim();
        const key = `${notifUserIdStr}:${taskIdStr}`;
        
        if (!notif.is_read) {
          existingKeys.add(key);
        } else {
          // If notification exists but is read, we'll mark it as unread
          readNotificationsToUpdate.push({ key, notification: notif });
        }
      }
      
      console.log(`📋 Found ${existingKeys.size} existing unread overdue notifications, ${readNotificationsToUpdate.length} read notifications to mark as unread`);
      
      // Mark read overdue notifications as unread (task is still overdue)
      for (const { notification } of readNotificationsToUpdate) {
        try {
          await base44.entities.Notification.update(notification.id, { is_read: false });
          const notifUserIdStr = String(notification.user_id || '').trim();
          existingKeys.add(`${notifUserIdStr}:${notification.related_task_id}`);
          console.log(`🔄 Marked overdue task notification as unread for task ${notification.related_task_id}`);
        } catch (error) {
          console.error(`❌ Error updating overdue task notification:`, error);
        }
      }
      
      // Mark task_assigned notifications as read for overdue tasks
      // (overdue tasks should only show task_overdue, not task_assigned)
      const overdueTaskIds = new Set(notificationsToCreate.map(n => n.task_id));
      let taskAssignedMarkedRead = 0;
      for (const notif of allExistingNotifications) {
        if (notif.type === 'task_assigned' && overdueTaskIds.has(notif.related_task_id) && !notif.is_read) {
          try {
            await base44.entities.Notification.update(notif.id, { is_read: true });
            taskAssignedMarkedRead++;
            console.log(`📝 Marked task_assigned notification as read for overdue task ${notif.related_task_id}`);
          } catch (error) {
            console.error(`❌ Error marking task_assigned notification as read:`, error);
          }
        }
      }
      if (taskAssignedMarkedRead > 0) {
        console.log(`📝 Marked ${taskAssignedMarkedRead} task_assigned notifications as read (tasks are overdue)`);
      }
      
      // Create all missing notifications
      for (const notifData of notificationsToCreate) {
        const notifUserIdStr = String(notifData.user_id || '').trim();
        const key = `${notifUserIdStr}:${notifData.task_id}`;
        
        if (existingKeys.has(key)) {
          skippedCount++;
          continue; // Already exists (and is now unread)
        }
        
        try {
          const notificationData = {
            user_id: String(notifData.user_id).trim(), // Ensure string format
            type: 'task_overdue',
            title: 'Task Overdue',
            message: `"${notifData.task_title}" is overdue by ${notifData.daysOverdue} day${notifData.daysOverdue !== 1 ? 's' : ''}`,
            related_task_id: notifData.task_id,
            related_account_id: notifData.related_account_id,
            scheduled_for: new Date().toISOString()
          };
          console.log(`   🔔 Creating notification with user_id: ${notificationData.user_id} (currentUserId: ${currentUserIdStr}, match: ${notificationData.user_id === currentUserIdStr})`);
          const created = await base44.entities.Notification.create(notificationData);
          console.log(`   ✅ Created notification: id=${created?.id}, user_id=${created?.user_id}, requested_user_id=${notificationData.user_id}, match=${String(created?.user_id).trim() === notificationData.user_id}`);
          createdCount++;
          // Add to existing keys to avoid duplicates in same batch
          existingKeys.add(key);
          console.log(`✅ Created overdue task notification for "${notifData.task_title}" (${notifData.daysOverdue} days overdue, user_id: ${created?.user_id})`);
        } catch (error) {
          // Check if error is due to duplicate key constraint (unique index violation)
          const errorMessage = error?.message || error?.toString() || '';
          if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key') || errorMessage.includes('unique_user_task_notification')) {
            // This is expected - notification already exists (unique constraint prevented duplicate)
            skippedCount++;
            console.log(`   ⏭️  Skipping duplicate notification for task "${notifData.task_title}" (user_id: ${notifData.user_id}) - already exists`);
          } else {
            errorCount++;
            console.error(`❌ Error creating overdue task notification for "${notifData.task_title}":`, error);
          }
        }
      }
    }
    
    console.log(`✅ Overdue task notification creation complete: ${overdueTaskCount} overdue tasks found, ${createdCount} notifications created, ${skippedCount} skipped, ${errorCount} errors`);
  } catch (error) {
    console.error('❌ Error creating overdue task notifications:', error);
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
 * OPTIMIZED APPROACH: Database triggers maintain the notification list automatically
 * This function only updates account statuses - triggers handle notification updates
 */
export async function createRenewalNotifications() {
  console.log('🔄 Starting renewal notification creation (trigger-based approach)...');
  
  try {
    // First, update account statuses based on renewal dates
    // The database triggers will automatically update notifications when accounts change
    const accounts = await base44.entities.Account.list();
    
    // Use the API endpoint to get estimates with contract_end field (more reliable than base44.list())
    const estimatesResponse = await fetch('/api/data/estimates');
    let estimates = [];
    if (estimatesResponse.ok) {
      const result = await estimatesResponse.json();
      if (result.success) {
        estimates = result.data || [];
        console.log(`✅ Fetched ${estimates.length} estimates with contract_end dates`);
      } else {
        console.warn('⚠️ Estimates API returned error, falling back to base44:', result.error);
        estimates = await base44.entities.Estimate.list();
      }
    } else {
      console.warn('⚠️ Failed to fetch estimates from API, falling back to base44');
      estimates = await base44.entities.Estimate.list();
    }
    
    // Always use actual current date for at-risk calculations (not test mode)
    // At-risk accounts are about real business operations, not test data
    const today = startOfDay(new Date());
    
    let atRiskUpdatedCount = 0;
    let atRiskAlreadyCount = 0;
    
    // Update account statuses based on renewal dates
    // When we update account.status, the trigger will automatically update notifications
    let accountsWithEstimates = 0;
    let accountsWithContractEnd = 0;
    let accountsWithRenewalDate = 0;
    
    for (const account of accounts) {
      if (account.archived) continue;
      
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      if (accountEstimates.length > 0) {
        accountsWithEstimates++;
        const wonEstimatesWithEnd = accountEstimates.filter(est => 
          est.status && est.status.toLowerCase() === 'won' && est.contract_end
        );
        if (wonEstimatesWithEnd.length > 0) {
          accountsWithContractEnd++;
        }
      }
      
      const renewalDate = calculateRenewalDate(accountEstimates);
      
      if (!renewalDate) continue;
      
      accountsWithRenewalDate++;
      
      const renewalDateStart = startOfDay(renewalDate);
      const daysUntilRenewal = differenceInDays(renewalDateStart, today);
      // Account should be at_risk if:
      // 1. Renewal is coming up (0-180 days in future) - proactive renewal
      // 2. Renewal has passed (daysUntilRenewal < 0) - URGENT: contract expired, needs immediate attention
      // Account should NOT be at_risk only if renewal is > 180 days away
      const shouldBeAtRisk = daysUntilRenewal <= 180; // Include past renewals (negative days)
      const isCurrentlyAtRisk = account.status === 'at_risk';
      
      if (shouldBeAtRisk && !isCurrentlyAtRisk && account.status !== 'churned') {
        try {
          await base44.entities.Account.update(account.id, { status: 'at_risk' });
          atRiskUpdatedCount++;
          // Trigger will automatically update notifications for this account
        } catch (error) {
          console.error(`❌ Error updating account status for ${account.name}:`, error);
        }
      } else if (shouldBeAtRisk && isCurrentlyAtRisk) {
        atRiskAlreadyCount++;
      } else if (isCurrentlyAtRisk && daysUntilRenewal > 180) {
        // Only remove from at_risk if renewal is more than 6 months away (not urgent yet)
        // Keep at_risk if renewal passed (daysUntilRenewal < 0) - those are URGENT
        try {
          await base44.entities.Account.update(account.id, { status: 'active' });
          // Trigger will automatically update notifications for this account
        } catch (error) {
          console.error(`❌ Error updating account status for ${account.name}:`, error);
        }
      }
    }
    
    // No need to call updateAllUserNotificationStates() - triggers handle it automatically!
    
    console.log(`✅ Renewal notification creation complete`);
    console.log(`⚠️ At Risk Status: ${atRiskUpdatedCount} updated, ${atRiskAlreadyCount} already at_risk`);
    console.log(`📊 Accounts with estimates: ${accountsWithEstimates}, with contract_end: ${accountsWithContractEnd}, with renewal date: ${accountsWithRenewalDate}`);
    console.log(`📊 Notifications maintained automatically by database triggers`);
  } catch (error) {
    console.error('❌ Error creating renewal notifications:', error);
  }
}

/**
 * Create notifications for neglected accounts (no interaction in 30+ days)
 * OPTIMIZED APPROACH: Database triggers maintain the notification list automatically
 * This function is kept for backwards compatibility but does nothing - triggers handle it
 */
export async function createNeglectedAccountNotifications() {
  console.log('🔄 Neglected account notifications are maintained automatically by database triggers');
  console.log('📊 No manual recalculation needed - triggers update notifications when accounts/interactions change');
  // Triggers automatically maintain the notification list when:
  // - Accounts are updated (last_interaction_date, archived, status, etc.)
  // - Interactions are created/updated
  // - Estimates are created/updated (affects renewal dates)
}

/**
 * Get user notification state (JSONB notifications)
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User notification state or null
 */
async function getUserNotificationState(userId) {
  try {
    const response = await fetch(`/api/data/userNotificationStates?user_id=${encodeURIComponent(userId)}`);
    if (!response.ok) return null;
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error fetching user notification state:', error);
    return null;
  }
}

/**
 * Update user notification state (JSONB notifications)
 * @param {string} userId - User ID
 * @param {Array} notifications - Array of notification objects
 * @returns {Promise<Object>} - Updated state
 */
async function updateUserNotificationState(userId, notifications) {
  try {
    const response = await fetch('/api/data/userNotificationStates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert',
        data: {
          user_id: userId,
          notifications: notifications
        }
      })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update notification state');
    }
    return result.data;
  } catch (error) {
    console.error('Error updating user notification state:', error);
    throw error;
  }
}

/**
 * Recalculate and update notification states for all users
 * 
 * ⚠️ DEPRECATED: This function is expensive and should NOT be called on page load!
 * 
 * The database triggers automatically maintain the notification list when accounts/interactions/estimates change.
 * On page load, just query the pre-built list from user_notification_states table.
 * 
 * Only use this function for:
 * - Initial setup (one-time rebuild)
 * - Manual refresh (admin action)
 * - After bulk data imports
 * 
 * For normal operation, rely on triggers to maintain the list automatically.
 */
export async function updateAllUserNotificationStates() {
  console.warn('⚠️ updateAllUserNotificationStates() is expensive - only use for initial setup or manual refresh');
  console.log('🔄 Starting notification state recalculation (trigger-based approach with manual rebuild)...');
  
  try {
    // Call the database function to rebuild all notifications
    // This is more efficient than doing it in JavaScript
    const response = await fetch('/api/data/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rebuild_all'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log('✅ Notification rebuild complete via database function');
        return;
      }
    }
    
    // Fallback: If database function doesn't exist, do it the old way
    console.log('⚠️ Database rebuild function not available, falling back to JavaScript approach...');
    const accounts = await base44.entities.Account.list();
    const users = await base44.entities.User.list();
    
    // Use API endpoint to get estimates with contract_end field (more reliable than base44.list())
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
    const today = startOfDay(new Date());
    
    console.log(`📊 Processing ${accounts.length} accounts for ${users.length} users`);
    
    // Process each user
    for (const user of users) {
      if (!user?.id) continue;
      
      const bulkNotifications = [];
      
      // Process each account
      for (const account of accounts) {
        // Skip archived or excluded accounts
        if (account.archived || account.icp_status === 'na') continue;
        
        // Check for neglected account notification
        const isNeglected = await shouldHaveNeglectedNotification(account, today);
        if (isNeglected) {
          const isSnoozed = await checkNotificationSnoozed('neglected_account', account.id);
          if (!isSnoozed) {
            const segment = account.revenue_segment || 'C';
            const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
            let daysSinceInteraction = null;
            let message = '';
            
            if (!account.last_interaction_date) {
              message = `No interactions logged - account needs attention (${segment} segment)`;
            } else {
              const lastInteractionDate = startOfDay(new Date(account.last_interaction_date));
              daysSinceInteraction = differenceInDays(today, lastInteractionDate);
              message = `No contact in ${daysSinceInteraction} day${daysSinceInteraction !== 1 ? 's' : ''} - account needs attention (${segment} segment, ${thresholdDays}+ day threshold)`;
            }
            
            bulkNotifications.push({
              id: `neglected_${account.id}_${user.id}`,
              type: 'neglected_account',
              title: `Neglected Account: ${account.name}`,
              message: message,
              related_account_id: account.id,
              related_task_id: null,
              is_read: false,
              created_at: new Date().toISOString(),
              scheduled_for: today.toISOString()
            });
          }
        }
        
        // Check for renewal reminder notification
        if (account.status === 'at_risk') {
          const isSnoozed = await checkNotificationSnoozed('renewal_reminder', account.id);
          if (!isSnoozed) {
            // Get renewal date from estimates (already loaded)
            const accountEstimates = estimates.filter(est => est.account_id === account.id);
            const renewalDate = calculateRenewalDate(accountEstimates);
            
            if (renewalDate) {
              const renewalDateStart = startOfDay(renewalDate);
              const daysUntilRenewal = differenceInDays(renewalDateStart, today);
              
              if (daysUntilRenewal >= 0 && daysUntilRenewal <= 180) {
                bulkNotifications.push({
                  id: `renewal_${account.id}_${user.id}`,
                  type: 'renewal_reminder',
                  title: `Renewal Coming Up: ${account.name}`,
                  message: `Contract renewal is in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''} (${format(renewalDate, 'MMM d, yyyy')})`,
                  related_account_id: account.id,
                  related_task_id: null,
                  is_read: false,
                  created_at: new Date().toISOString(),
                  scheduled_for: renewalDateStart.toISOString()
                });
              }
            }
          }
        }
      }
      
      // Update user's notification state
      await updateUserNotificationState(user.id, bulkNotifications);
      console.log(`✅ Updated notification state for user ${user.id}: ${bulkNotifications.length} notifications`);
    }
    
    console.log('✅ Notification state recalculation complete');
  } catch (error) {
    console.error('❌ Error recalculating notification states:', error);
  }
}

/**
 * Helper: Check if account should have neglected notification
 */
async function shouldHaveNeglectedNotification(account, today) {
  if (account.archived || account.icp_status === 'na') return false;
  
  const segment = account.revenue_segment || 'C';
  const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
  
  if (!account.last_interaction_date) return true;
  
  const lastInteractionDate = startOfDay(new Date(account.last_interaction_date));
  const daysSince = differenceInDays(today, lastInteractionDate);
  return daysSince > thresholdDays;
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

