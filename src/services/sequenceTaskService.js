import { base44 } from '@/api/base44Client';
import { addDays, startOfDay } from 'date-fns';

/**
 * Create tasks from a sequence enrollment
 * Tasks are created with proper ordering and blocking relationships
 * @param {Object} enrollment - The sequence enrollment object
 * @param {Object} sequence - The sequence template object
 * @param {string} accountId - The account ID for the tasks
 * @returns {Promise<Array>} - Array of created task IDs
 */
export async function createTasksFromSequence(enrollment, sequence, accountId) {
  if (!sequence?.steps || sequence.steps.length === 0) {
    console.warn('Sequence has no steps, cannot create tasks');
    return [];
  }

  const today = startOfDay(new Date());
  const startedDate = enrollment.started_date ? startOfDay(new Date(enrollment.started_date)) : today;
  const createdTasks = [];
  let previousTaskId = null;
  let cumulativeDays = 0;

  // Get current user for task assignment
  let currentUser = null;
  try {
    currentUser = await base44.auth.me();
  } catch (error) {
    console.warn('Could not get current user for task assignment:', error);
  }

  console.log('Creating tasks from sequence:', {
    sequenceName: sequence.name,
    stepsCount: sequence.steps?.length,
    startedDate: startedDate.toISOString(),
    steps: sequence.steps
  });

  // Create tasks for each step in the sequence
  // Sort steps by step_number to ensure correct order
  const sortedSteps = [...(sequence.steps || [])].sort((a, b) => {
    const aNum = parseInt(a.step_number || a.stepNumber || 0, 10);
    const bNum = parseInt(b.step_number || b.stepNumber || 0, 10);
    return aNum - bNum;
  });

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    // Ensure days_after_previous is a number (might be string from JSONB)
    const daysAfterPrevious = parseInt(step.days_after_previous || step.daysAfterPrevious || 0, 10);
    // Add days for this step to cumulative total
    cumulativeDays += daysAfterPrevious;
    
    // Calculate due date based on cumulative days from start
    const dueDate = addDays(startedDate, cumulativeDays);
    
    console.log(`Step ${i + 1} (step_number: ${step.step_number}): days_after_previous=${daysAfterPrevious}, cumulativeDays=${cumulativeDays}, dueDate=${dueDate.toISOString().split('T')[0]}`);
    
    // Create task title from step
    const actionTypeLabels = {
      email: 'Send Email',
      call: 'Make Call',
      linkedin: 'LinkedIn Message',
      meeting: 'Schedule Meeting'
    };
    const actionLabel = actionTypeLabels[step.action_type] || step.action_type;
    const taskTitle = `${actionLabel} - Step ${step.step_number}`;
    
    // Create task description from template/notes
    const taskDescription = step.template || step.instructions || `Complete ${actionLabel} for this account`;

    // Determine task status - first task is active, others are blocked
    const taskStatus = i === 0 ? 'todo' : 'blocked';
    
    // Create the task
    try {
      const taskData = {
        title: taskTitle,
        description: taskDescription,
        assigned_to: currentUser?.email || null,
        due_date: dueDate.toISOString().split('T')[0],
        priority: 'normal',
        status: taskStatus,
        category: 'sequence',
        related_account_id: accountId,
        related_contact_id: null,
        estimated_time: 30,
        labels: ['sequence'],
        order: i, // Order tasks by sequence step
        // Store sequence info for tracking
        sequence_enrollment_id: enrollment.id,
        sequence_step_number: step.step_number,
        blocked_by_task_id: previousTaskId // Block this task until previous is completed
      };

      const task = await base44.entities.Task.create(taskData);
      createdTasks.push(task.id);
      previousTaskId = task.id;

      console.log(`✅ Created task "${taskTitle}" for sequence step ${step.step_number} (${taskStatus}) with due date ${dueDate.toISOString().split('T')[0]}`);
    } catch (error) {
      console.error(`❌ Error creating task for step ${step.step_number}:`, error);
    }
  }

  return createdTasks;
}

/**
 * Check if a task is blocked and should be unblocked
 * Called when a task is completed to check if next task should be unblocked
 * @param {string} taskId - The completed task ID
 * @returns {Promise<void>}
 */
export async function unblockNextTask(taskId) {
  try {
    // Find tasks that are blocked by this task
    const allTasks = await base44.entities.Task.list();
    const blockedTasks = allTasks.filter(task => 
      task.blocked_by_task_id === taskId && task.status === 'blocked'
    );

    // Unblock the next task(s) - change status from 'blocked' to 'todo'
    for (const blockedTask of blockedTasks) {
      await base44.entities.Task.update(blockedTask.id, {
        status: 'todo'
      });
      console.log(`✅ Unblocked task "${blockedTask.title}" (ID: ${blockedTask.id})`);
    }
  } catch (error) {
    console.error('Error unblocking next task:', error);
  }
}

