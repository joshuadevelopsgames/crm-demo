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

async function cleanupDuplicateOverdueNotifications() {
  console.log('🧹 Cleaning up duplicate overdue task notifications...\n');

  try {
    // Get all overdue task notifications
    const { data: allNotifications, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id, related_task_id, is_read, created_at')
      .eq('type', 'task_overdue');

    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError);
      process.exit(1);
    }

    console.log(`📊 Found ${allNotifications.length} overdue task notifications\n`);

    // Group by user_id + task_id
    const notificationGroups = new Map();
    
    for (const notif of allNotifications) {
      const userIdStr = String(notif.user_id || '').trim();
      const taskId = notif.related_task_id;
      const key = `${userIdStr}:${taskId}`;
      
      if (!notificationGroups.has(key)) {
        notificationGroups.set(key, []);
      }
      notificationGroups.get(key).push(notif);
    }

    // Find duplicates (groups with more than 1 notification)
    const duplicates = [];
    for (const [key, notifications] of notificationGroups) {
      if (notifications.length > 1) {
        duplicates.push({ key, notifications });
      }
    }

    console.log(`🔍 Found ${duplicates.length} task/user combinations with duplicate notifications\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    // For each duplicate group, keep the newest unread one, or newest read one if all are read
    let deleted = 0;
    let kept = 0;

    for (const { key, notifications } of duplicates) {
      // Sort by created_at (newest first), then by is_read (unread first)
      notifications.sort((a, b) => {
        if (a.is_read !== b.is_read) {
          return a.is_read ? 1 : -1; // Unread first
        }
        return new Date(b.created_at) - new Date(a.created_at); // Newest first
      });

      // Keep the first one (newest unread, or newest read if all are read)
      const toKeep = notifications[0];
      const toDelete = notifications.slice(1);

      console.log(`📋 ${key}: Keeping 1, deleting ${toDelete.length}`);
      console.log(`   Keeping: id=${toKeep.id}, created=${toKeep.created_at}, is_read=${toKeep.is_read}`);

      for (const notif of toDelete) {
        const { error: deleteError } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notif.id);

        if (deleteError) {
          console.error(`   ❌ Error deleting notification ${notif.id}:`, deleteError.message);
        } else {
          deleted++;
          console.log(`   ✅ Deleted: id=${notif.id}, created=${notif.created_at}, is_read=${notif.is_read}`);
        }
      }
      kept++;
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('══════════════════════════════════════════════════');
    console.log(`✅ Kept: ${kept} notifications (1 per task/user)`);
    console.log(`🗑️  Deleted: ${deleted} duplicate notifications`);
    console.log(`\n✨ Cleanup complete!`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupDuplicateOverdueNotifications();

