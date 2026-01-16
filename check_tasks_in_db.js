/**
 * Script to check tasks in the database
 * Shows all tasks, especially focusing on unassigned tasks and those without created_by_email
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function checkTasks() {
  try {
    const supabase = getSupabase();
    
    console.log('🔍 Querying tasks from database...\n');
    
    // Fetch all tasks
    let allTasks = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return;
      }
      
      if (data && data.length > 0) {
        allTasks = allTasks.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Total tasks found: ${allTasks.length}\n`);
    
    if (allTasks.length === 0) {
      console.log('ℹ️  No tasks found in the database.');
      return;
    }
    
    // Categorize tasks
    const unassignedTasks = allTasks.filter(t => !t.assigned_to || t.assigned_to.trim() === '');
    const tasksWithoutCreator = allTasks.filter(t => !t.created_by_email);
    const unassignedWithoutCreator = allTasks.filter(t => 
      (!t.assigned_to || t.assigned_to.trim() === '') && !t.created_by_email
    );
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    const activeTasks = allTasks.filter(t => t.status !== 'completed');
    
    console.log('📋 Task Summary:');
    console.log(`   - Total tasks: ${allTasks.length}`);
    console.log(`   - Active tasks: ${activeTasks.length}`);
    console.log(`   - Completed tasks: ${completedTasks.length}`);
    console.log(`   - Unassigned tasks: ${unassignedTasks.length}`);
    console.log(`   - Tasks without created_by_email: ${tasksWithoutCreator.length}`);
    console.log(`   - Unassigned tasks without created_by_email: ${unassignedWithoutCreator.length}\n`);
    
    // Show unassigned tasks without creator (these are the ones that might have disappeared)
    if (unassignedWithoutCreator.length > 0) {
      console.log('⚠️  Unassigned tasks without created_by_email (these should be visible to everyone after the fix):');
      console.log('─'.repeat(80));
      unassignedWithoutCreator.forEach((task, index) => {
        console.log(`\n${index + 1}. Task ID: ${task.id}`);
        console.log(`   Title: ${task.title || '(no title)'}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Priority: ${task.priority}`);
        console.log(`   Due Date: ${task.due_date || '(no due date)'}`);
        console.log(`   Created: ${task.created_at}`);
        console.log(`   Updated: ${task.updated_at}`);
        if (task.description) {
          const desc = task.description.length > 100 
            ? task.description.substring(0, 100) + '...' 
            : task.description;
          console.log(`   Description: ${desc}`);
        }
      });
      console.log('\n');
    }
    
    // Show all unassigned tasks
    if (unassignedTasks.length > 0) {
      console.log('📝 All unassigned tasks:');
      console.log('─'.repeat(80));
      unassignedTasks.forEach((task, index) => {
        console.log(`\n${index + 1}. Task ID: ${task.id}`);
        console.log(`   Title: ${task.title || '(no title)'}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Created by: ${task.created_by_email || '(not set)'}`);
        console.log(`   Due Date: ${task.due_date || '(no due date)'}`);
        console.log(`   Created: ${task.created_at}`);
      });
      console.log('\n');
    }
    
    // Show recent tasks
    console.log('🕐 Most recent tasks (last 10):');
    console.log('─'.repeat(80));
    allTasks.slice(0, 10).forEach((task, index) => {
      console.log(`\n${index + 1}. ${task.title || '(no title)'}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Assigned to: ${task.assigned_to || '(unassigned)'}`);
      console.log(`   Created by: ${task.created_by_email || '(not set)'}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Created: ${task.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking tasks:', error);
    process.exit(1);
  }
}

checkTasks();
