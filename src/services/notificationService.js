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

    // Check if notification already exists
    const existingNotifications = await base44.entities.Notification.filter({
      user_id: user.id,
      related_task_id: task.id,
      is_read: false
    });

    // Remove existing notifications for this task (except assignment notifications)
    for (const notif of existingNotifications) {
      if (notif.type !== 'task_assigned') {
        await base44.entities.Notification.update(notif.id, { is_read: true });
      }
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.js:185',message:'createOverdueTaskNotifications ENTRY',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  console.log('🔄 Starting overdue task notification creation...');
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let overdueTaskCount = 0;
  
  try {
    // Get all tasks
    const tasks = await base44.entities.Task.list();
    console.log(`📊 Found ${tasks.length} tasks`);
    
    // Get all users
    const allUsers = await base44.entities.User.list();
    console.log(`👥 Found ${allUsers.length} users:`, allUsers.map(u => u.email || u.id).join(', '));
    
    const today = startOfDay(new Date());
    
    // Phase 1: Collect all overdue task notifications to create
    const notificationsToCreate = [];
    
    // Process each task
    for (const task of tasks) {
      // Skip tasks without due dates or completed tasks (matches Dashboard logic)
      if (!task.due_date || task.status === 'completed') {
        continue;
      }
      
      // Task is overdue if due date is before now (matches Dashboard logic exactly: new Date(task.due_date) < new Date())
      const dueDateObj = new Date(task.due_date);
      const nowObj = new Date();
      const isOverdue = dueDateObj < nowObj;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.js:214',message:'Overdue check',data:{taskId:task.id,taskTitle:task.title,dueDate:task.due_date,dueDateObj:dueDateObj.toISOString(),nowObj:nowObj.toISOString(),isOverdue,status:task.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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
      
      // If task has assigned users, notify them. Otherwise, notify all users (unassigned tasks are everyone's responsibility)
      const usersToNotify = assignedUsers.length > 0 ? assignedUsers : allUsers.map(u => u.email).filter(Boolean);
      
      console.log(`   - Assigned users: ${assignedUsers.length > 0 ? assignedUsers.join(', ') : 'none (will notify all users)'}`);
      console.log(`   - Users to notify: ${usersToNotify.length} user(s)`);
      
      // Collect notification data for each user
      for (const email of usersToNotify) {
        const user = allUsers.find(u => u.email === email);
        if (!user || !user.id) {
          console.warn(`   ⚠️ Could not find user for overdue task notification: ${email}`);
          continue;
        }
        
        console.log(`   ✅ Will create notification for user: ${user.email} (id: ${user.id}, idType: ${typeof user.id})`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.js:246',message:'Notification queued for creation',data:{userId:user.id,userIdString:String(user.id),userEmail:user.email,taskId:task.id,taskTitle:task.title},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        notificationsToCreate.push({
          user_id: String(user.id), // Ensure it's a string to match database format
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
        const notifUserIdStr = String(notif.user_id || '').trim();
        const key = `${notifUserIdStr}:${notif.related_task_id}`;
        if (!notif.is_read) {
          existingKeys.add(key);
        } else {
          // If notification exists but is read, we'll mark it as unread
          readNotificationsToUpdate.push({ key, notification: notif });
        }
      }
      
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.js:301',message:'Creating notification BEFORE',data:notificationData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          const created = await base44.entities.Notification.create(notificationData);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.js:309',message:'Creating notification AFTER',data:{createdId:created?.id,createdUserId:created?.user_id,createdType:created?.type,requestedUserId:notifData.user_id,userIdMatch:created?.user_id===notifData.user_id,taskId:notifData.task_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          createdCount++;
          // Add to existing keys to avoid duplicates in same batch
          existingKeys.add(key);
          console.log(`✅ Created overdue task notification for "${notifData.task_title}" (${notifData.daysOverdue} days overdue)`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error creating overdue task notification for "${notifData.task_title}":`, error);
        }
      }
    }
    
    console.log(`✅ Overdue task notification creation complete: ${overdueTaskCount} overdue tasks found, ${createdCount} notifications created, ${skippedCount} skipped, ${errorCount} errors`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.js:322',message:'createOverdueTaskNotifications EXIT',data:{overdueTaskCount,createdCount,skippedCount,errorCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    console.error('❌ Error creating overdue task notifications:', error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.js:324',message:'createOverdueTaskNotifications ERROR',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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
    
    // Phase 1: Collect all notifications to create (without creating them yet)
    const notificationsToCreate = [];
    
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
      
      // Collect notification data for all users (don't create yet)
      for (const user of usersToNotify) {
        if (!user?.id) continue;
        notificationsToCreate.push({
          user_id: user.id,
          type: 'renewal_reminder',
          title: `Renewal Coming Up: ${account.name}`,
          message: `Contract renewal is in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''} (${format(renewalDate, 'MMM d, yyyy')})`,
          related_account_id: account.id,
          related_task_id: null,
          scheduled_for: renewalDateStart.toISOString(),
          accountName: account.name,
          daysUntilRenewal: daysUntilRenewal
        });
      }
    }
    
    // Phase 2: Batch check existing notifications and create missing ones
    console.log(`📋 Collected ${notificationsToCreate.length} notifications to create`);
    
    if (notificationsToCreate.length > 0) {
      // Get all existing renewal notifications for all users in one batch
      const allExistingNotifications = await base44.entities.Notification.filter({
        type: 'renewal_reminder'
      });
      
      // Create a set of existing notification keys (user_id + account_id + today)
      const today = startOfDay(new Date());
      const existingKeys = new Set();
      for (const notif of allExistingNotifications) {
        const notifDate = startOfDay(new Date(notif.created_at));
        if (notifDate.getTime() === today.getTime()) {
          existingKeys.add(`${notif.user_id}:${notif.related_account_id}`);
        }
      }
      
      // Create all missing notifications
      for (const notifData of notificationsToCreate) {
        const key = `${notifData.user_id}:${notifData.related_account_id}`;
        
        if (existingKeys.has(key)) {
          skippedCount++;
          continue; // Already created today
        }
        
        try {
          await base44.entities.Notification.create({
            user_id: notifData.user_id,
            type: notifData.type,
            title: notifData.title,
            message: notifData.message,
            related_account_id: notifData.related_account_id,
            related_task_id: notifData.related_task_id,
            scheduled_for: notifData.scheduled_for
          });
          
          createdCount++;
          // Add to existing keys to avoid duplicates in same batch
          existingKeys.add(key);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error creating notification for ${notifData.accountName}:`, error);
        }
      }
    }
    
    // Clean up notifications for accounts that are no longer at_risk
    // This handles cases where accounts were previously at_risk but no longer meet criteria
    // NOTE: This is a system-wide cleanup that needs to see all notifications
    // We'll fetch all users and clean up notifications for each user separately
    let cleanupCount = 0;
    try {
      // Get all accounts that are currently at_risk (calculate once, use for all users)
      const atRiskAccountIds = new Set(
        accounts
          .filter(acc => acc.status === 'at_risk' && !acc.archived)
          .map(acc => acc.id)
      );
      
      // Get all users to clean up notifications per user
      const users = await base44.entities.User.list();
      
      for (const user of users) {
        if (!user?.id) continue;
        
        // Get renewal reminder notifications for this user
        const userRenewalNotifications = await base44.entities.Notification.filter({
          user_id: user.id,
          type: 'renewal_reminder'
        });
        
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
 * Create notifications for neglected accounts (no interaction in 30+ days)
 * This creates universal notifications that all users see, but can be snoozed individually
 */
export async function createNeglectedAccountNotifications() {
  console.log('🔄 Starting neglected account notification creation...');
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let neglectedAccountCount = 0;
  let skippedBySnooze = 0;
  let skippedByExisting = 0;
  let skippedByArchived = 0;
  let skippedByICP = 0;
  let skippedBySnoozedAccount = 0;
  let skippedByRecentInteraction = 0;
  
  try {
    // Get all accounts
    const accounts = await base44.entities.Account.list();
    console.log(`📊 Found ${accounts.length} accounts`);
    
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
      console.warn('⚠️ No users found for neglected account notifications - skipping');
      return;
    }

    const today = startOfDay(new Date());
    
    // Phase 1: Collect all notifications to create (without creating them yet)
    const notificationsToCreate = [];
    
    // Process each account
    for (const account of accounts) {
      // Skip archived accounts
      if (account.archived) {
        skippedByArchived++;
        continue;
      }
      
      // Skip accounts with ICP status = 'na' (permanently excluded)
      if (account.icp_status === 'na') {
        skippedByICP++;
        continue;
      }
      
      // Skip if snoozed
      if (account.snoozed_until) {
        const snoozeDate = new Date(account.snoozed_until);
        if (snoozeDate > new Date()) {
          skippedBySnoozedAccount++;
          continue; // Still snoozed
        }
      }
      
      // Determine threshold based on revenue segment
      // A and B segments: 30+ days, others: 90+ days
      // Default to 'C' (90 days) if segment is missing
      const segment = account.revenue_segment || 'C';
      const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
      
      // Check if no interaction beyond threshold
      let daysSinceInteraction = null;
      if (!account.last_interaction_date) {
        // No interaction date means it's neglected
        daysSinceInteraction = null; // Will be treated as "no interaction logged"
      } else {
        const lastInteractionDate = startOfDay(new Date(account.last_interaction_date));
        daysSinceInteraction = differenceInDays(today, lastInteractionDate);
        if (daysSinceInteraction <= thresholdDays) {
          skippedByRecentInteraction++;
          continue; // Recent interaction, not neglected
        }
      }
      
      // Account is neglected
      neglectedAccountCount++;
      
      // Check if this notification is snoozed (universal - any user can snooze for everyone)
      const isSnoozed = await checkNotificationSnoozed('neglected_account', account.id);
      if (isSnoozed) {
        skippedBySnooze++;
        continue; // Notification is snoozed for all users
      }
      
      // Collect notification data for all users (don't create yet)
      const message = daysSinceInteraction === null
        ? `No interactions logged - account needs attention (${segment || 'C/D'} segment)`
        : `No contact in ${daysSinceInteraction} day${daysSinceInteraction !== 1 ? 's' : ''} - account needs attention (${segment || 'C/D'} segment, ${thresholdDays}+ day threshold)`;
      
      for (const user of usersToNotify) {
        if (!user?.id) continue;
        notificationsToCreate.push({
          user_id: user.id,
          type: 'neglected_account',
          title: `Neglected Account: ${account.name}`,
          message: message,
          related_account_id: account.id,
          related_task_id: null,
          scheduled_for: today.toISOString(),
          accountName: account.name,
          accountId: account.id,
          daysSinceInteraction: daysSinceInteraction,
          isSnoozed: isSnoozed
        });
      }
    }
    
    // Phase 2: Batch check existing notifications and create missing ones
    console.log(`📋 Collected ${notificationsToCreate.length} notifications to create`);
    
    if (notificationsToCreate.length > 0) {
      // Get all existing neglected account notifications for all users in one batch
      const allExistingNotifications = await base44.entities.Notification.filter({
        type: 'neglected_account'
      });
      
      // Create a set of existing notification keys (user_id + account_id)
      // For neglected accounts, we check if ANY notification exists (not just today's)
      const existingKeys = new Set();
      for (const notif of allExistingNotifications) {
        existingKeys.add(`${notif.user_id}:${notif.related_account_id}`);
      }
      
      // Track which accounts had at least one notification created
      const accountsWithNotifications = new Set();
      
      // Create all missing notifications
      for (const notifData of notificationsToCreate) {
        const key = `${notifData.user_id}:${notifData.related_account_id}`;
        
        if (existingKeys.has(key)) {
          skippedByExisting++;
          accountsWithNotifications.add(notifData.accountId);
          continue; // Already exists
        }
        
        try {
          await base44.entities.Notification.create({
            user_id: notifData.user_id,
            type: notifData.type,
            title: notifData.title,
            message: notifData.message,
            related_account_id: notifData.related_account_id,
            related_task_id: notifData.related_task_id,
            scheduled_for: notifData.scheduled_for
          });
          
          createdCount++;
          accountsWithNotifications.add(notifData.accountId);
          // Add to existing keys to avoid duplicates in same batch
          existingKeys.add(key);
          console.log(`✅ Created neglected account notification for ${notifData.accountName} (${notifData.daysSinceInteraction === null ? 'no interaction date' : `${notifData.daysSinceInteraction} days`})`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error creating neglected account notification for ${notifData.accountName}:`, error);
        }
      }
      
      // Track accounts that should have notifications but don't
      const accountIdsInNotifications = new Set(notificationsToCreate.map(n => n.accountId));
      for (const accountId of accountIdsInNotifications) {
        const accountNotif = notificationsToCreate.find(n => n.accountId === accountId);
        if (accountNotif && !accountsWithNotifications.has(accountId) && !accountNotif.isSnoozed) {
          console.warn(`⚠️ Account ${accountNotif.accountName} (${accountId}) is neglected but no notification was created (may have errors for all users)`);
        }
      }
    }
    
    // Clean up notifications for accounts that are no longer neglected
    let cleanupCount = 0;
    try {
      // Get all accounts that are currently neglected (calculate once, use for all users)
      const neglectedAccountIds = new Set(
        accounts
          .filter(acc => {
            if (acc.archived) return false;
            if (acc.icp_status === 'na') return false;
            if (acc.snoozed_until) {
              const snoozeDate = new Date(acc.snoozed_until);
              if (snoozeDate > new Date()) return false;
            }
            if (!acc.last_interaction_date) return true; // No interaction date = neglected
            const accSegment = acc.revenue_segment || 'C'; // Default to 'C' if missing
            const accThresholdDays = (accSegment === 'A' || accSegment === 'B') ? 30 : 90;
            const daysSince = differenceInDays(today, startOfDay(new Date(acc.last_interaction_date)));
            return daysSince > accThresholdDays;
          })
          .map(acc => acc.id)
      );
      
      // Get all users to clean up notifications per user
      const users = await base44.entities.User.list();
      
      for (const user of users) {
        if (!user?.id) continue;
        
        // Get neglected account notifications for this user
        const userNeglectedNotifications = await base44.entities.Notification.filter({
          user_id: user.id,
          type: 'neglected_account'
        });
        
        // Delete notifications for accounts that are no longer neglected
        for (const notification of userNeglectedNotifications) {
          if (notification.related_account_id && !neglectedAccountIds.has(notification.related_account_id)) {
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
      }
      
      if (cleanupCount > 0) {
        console.log(`🧹 Cleaned up ${cleanupCount} neglected account notifications for accounts no longer neglected`);
      }
    } catch (cleanupError) {
      console.error('❌ Error cleaning up neglected account notifications:', cleanupError);
    }
    
    console.log(`✅ Neglected account notification creation complete:`);
    console.log(`   📊 Total neglected accounts identified: ${neglectedAccountCount}`);
    console.log(`   ✅ Notifications created: ${createdCount}`);
    console.log(`   ⏭️  Skipped breakdown:`);
    console.log(`      - By notification snooze: ${skippedBySnooze}`);
    console.log(`      - By existing notification today: ${skippedByExisting}`);
    console.log(`      - By archived account: ${skippedByArchived}`);
    console.log(`      - By ICP status 'na': ${skippedByICP}`);
    console.log(`      - By snoozed account: ${skippedBySnoozedAccount}`);
    console.log(`      - By recent interaction: ${skippedByRecentInteraction}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   🧹 Cleaned up ${cleanupCount} stale notifications`);
    console.log(`   📈 Expected notifications: ${neglectedAccountCount * usersToNotify.length} (${neglectedAccountCount} accounts × ${usersToNotify.length} users)`);
    console.log(`   📉 Actual notifications created: ${createdCount}`);
  } catch (error) {
    console.error('❌ Error creating neglected account notifications:', error);
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

