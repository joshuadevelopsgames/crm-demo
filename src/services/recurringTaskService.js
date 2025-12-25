import { base44 } from '@/api/base44Client';
import { startOfDay, addDays, addWeeks, addMonths, addYears, isAfter, isBefore } from 'date-fns';

/**
 * Generate recurring task instances for tasks that are due
 * This should be called daily (e.g., via a cron job or on Dashboard load)
 */
export async function generateRecurringTaskInstances() {
  console.log('🔄 Starting recurring task instance generation...');
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Get all recurring tasks
    const allTasks = await base44.entities.Task.list();
    const recurringTasks = allTasks.filter(task => task.is_recurring && !task.parent_task_id);
    
    console.log(`📊 Found ${recurringTasks.length} recurring tasks`);

    const today = startOfDay(new Date());

    for (const parentTask of recurringTasks) {
      try {
        // Check if next recurrence date is today or in the past
        if (!parentTask.next_recurrence_date) {
          skippedCount++;
          continue;
        }

        const nextRecurrenceDate = startOfDay(new Date(parentTask.next_recurrence_date));
        
        // Only create instance if next_recurrence_date is today or in the past
        if (isAfter(nextRecurrenceDate, today)) {
          skippedCount++;
          continue;
        }

        // Check if recurrence has ended
        if (parentTask.recurrence_end_date) {
          const endDate = startOfDay(new Date(parentTask.recurrence_end_date));
          if (isAfter(today, endDate)) {
            console.log(`⏹️ Recurrence ended for task ${parentTask.id}`);
            // Mark as no longer recurring
            await base44.entities.Task.update(parentTask.id, {
              is_recurring: false,
              next_recurrence_date: null
            });
            skippedCount++;
            continue;
          }
        }

        // Check occurrence count
        if (parentTask.recurrence_count) {
          // Count existing instances
          const existingInstances = allTasks.filter(
            t => t.parent_task_id === parentTask.id
          ).length;
          
          if (existingInstances >= parentTask.recurrence_count) {
            console.log(`⏹️ Recurrence count reached for task ${parentTask.id}`);
            // Mark as no longer recurring
            await base44.entities.Task.update(parentTask.id, {
              is_recurring: false,
              next_recurrence_date: null
            });
            skippedCount++;
            continue;
          }
        }

        // Create new task instance
        const instanceData = {
          title: parentTask.title,
          description: parentTask.description,
          assigned_to: parentTask.assigned_to,
          due_date: parentTask.next_recurrence_date,
          due_time: parentTask.due_time,
          priority: parentTask.priority,
          status: 'todo', // New instances always start as todo
          category: parentTask.category,
          related_account_id: parentTask.related_account_id,
          related_contact_id: parentTask.related_contact_id,
          estimated_time: parentTask.estimated_time,
          labels: parentTask.labels || [],
          subtasks: parentTask.subtasks || [],
          parent_task_id: parentTask.id, // Link to parent
          is_recurring: false, // Instances are not recurring themselves
          order: 0
        };

        await base44.entities.Task.create(instanceData);
        createdCount++;

        // Calculate next recurrence date
        const nextDate = calculateNextRecurrenceDate(parentTask, nextRecurrenceDate);
        
        if (nextDate) {
          // Update parent task with next recurrence date
          await base44.entities.Task.update(parentTask.id, {
            next_recurrence_date: nextDate.toISOString().split('T')[0]
          });
          updatedCount++;
        } else {
          // No more recurrences, mark as complete
          await base44.entities.Task.update(parentTask.id, {
            is_recurring: false,
            next_recurrence_date: null
          });
          updatedCount++;
        }

        console.log(`✅ Created instance for recurring task "${parentTask.title}" (next: ${nextDate ? nextDate.toISOString().split('T')[0] : 'none'})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing recurring task ${parentTask.id}:`, error);
      }
    }

    console.log(`✅ Recurring task generation complete: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);
  } catch (error) {
    console.error('❌ Error generating recurring task instances:', error);
  }
}

/**
 * Calculate the next recurrence date based on pattern
 */
function calculateNextRecurrenceDate(task, currentDate) {
  if (!task.recurrence_pattern) return null;

  let nextDate = new Date(currentDate);

  switch (task.recurrence_pattern) {
    case 'daily':
      nextDate = addDays(nextDate, task.recurrence_interval || 1);
      break;

    case 'weekly':
      if (task.recurrence_days_of_week && task.recurrence_days_of_week.length > 0) {
        const days = task.recurrence_days_of_week.sort();
        let found = false;
        
        // Check next 2 weeks for matching day
        for (let i = 1; i <= 14; i++) {
          const checkDate = addDays(nextDate, i);
          const dayOfWeek = checkDate.getDay();
          
          if (days.includes(dayOfWeek)) {
            nextDate = checkDate;
            found = true;
            break;
          }
        }
        
        if (!found) {
          // If no match in 2 weeks, jump to next interval period
          nextDate = addWeeks(nextDate, task.recurrence_interval || 1);
          // Find first matching day in that week
          const firstDay = days[0];
          const dayDiff = (firstDay - nextDate.getDay() + 7) % 7;
          nextDate = addDays(nextDate, dayDiff);
        }
      } else {
        nextDate = addWeeks(nextDate, task.recurrence_interval || 1);
      }
      break;

    case 'monthly':
      nextDate = addMonths(nextDate, task.recurrence_interval || 1);
      if (task.recurrence_day_of_month) {
        // Set to specific day of month (handle month-end edge cases)
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        const dayToSet = Math.min(task.recurrence_day_of_month, lastDayOfMonth);
        nextDate.setDate(dayToSet);
      }
      break;

    case 'yearly':
      nextDate = addYears(nextDate, task.recurrence_interval || 1);
      break;

    default:
      return null;
  }

  // Check if end date is set and next date exceeds it
  if (task.recurrence_end_date) {
    const endDate = startOfDay(new Date(task.recurrence_end_date));
    if (isAfter(nextDate, endDate)) {
      return null; // Recurrence has ended
    }
  }

  return nextDate;
}

