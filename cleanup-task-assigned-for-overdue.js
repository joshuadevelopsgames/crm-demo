#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load env
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^[\"']|[\"']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function cleanupTaskAssignedForOverdue() {
  console.log('🧹 Marking task_assigned notifications as read for overdue tasks...\n');

  try {
    // Get all overdue tasks
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, due_date, status')
      .not('due_date', 'is', null)
      .neq('status', 'completed');

    if (tasksError) {
      console.error('❌ Error fetching tasks:', tasksError);
      process.exit(1);
    }

    const now = new Date();
    const overdueTasks = allTasks.filter(task => {
      if (!task.due_date) return false;
      return new Date(task.due_date) < now;
    });

    console.log(`📊 Found ${overdueTasks.length} overdue tasks\n`);

    if (overdueTasks.length === 0) {
      console.log('✅ No overdue tasks found');
      return;
    }

    const overdueTaskIds = new Set(overdueTasks.map(t => t.id));

    // Get all task_assigned notifications
    const { data: taskAssignedNotifications, error: notifError } = await supabase
      .from('notifications')
      .select('id, user_id, related_task_id, is_read')
      .eq('type', 'task_assigned')
      .eq('is_read', false);

    if (notifError) {
      console.error('❌ Error fetching notifications:', notifError);
      process.exit(1);
    }

    console.log(`📋 Found ${taskAssignedNotifications.length} unread task_assigned notifications\n`);

    // Filter to only those for overdue tasks
    const toMarkAsRead = taskAssignedNotifications.filter(
      notif => notif.related_task_id && overdueTaskIds.has(notif.related_task_id)
    );

    console.log(`🔍 Found ${toMarkAsRead.length} task_assigned notifications for overdue tasks\n`);

    if (toMarkAsRead.length === 0) {
      console.log('✅ No task_assigned notifications to mark as read');
      return;
    }

    // Mark them as read
    let marked = 0;
    let errors = 0;

    for (const notif of toMarkAsRead) {
      try {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notif.id);

        if (updateError) {
          console.error(`❌ Error updating notification ${notif.id}:`, updateError.message);
          errors++;
        } else {
          marked++;
          if (marked % 10 === 0) {
            console.log(`   Marked ${marked} notifications as read...`);
          }
        }
      } catch (error) {
        console.error(`❌ Error updating notification ${notif.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('══════════════════════════════════════════════════');
    console.log(`✅ Marked as read: ${marked} notifications`);
    console.log(`❌ Errors: ${errors} notifications`);
    console.log(`\n✨ Cleanup complete! Overdue tasks will now only show task_overdue notifications.`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupTaskAssignedForOverdue();

