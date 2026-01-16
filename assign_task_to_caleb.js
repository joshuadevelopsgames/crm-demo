/**
 * Script to assign the task to caleb@lecm.ca
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

async function assignTaskToCaleb() {
  try {
    const supabase = getSupabase();
    const taskId = '7e61c558-cd0b-41d2-90e0-c7f00a872591';
    const calebEmail = 'caleb@lecm.ca';
    
    console.log(`🔧 Assigning task ${taskId} to ${calebEmail}...\n`);
    
    // Update the task to assign it to caleb and set created_by_email
    const { data, error } = await supabase
      .from('tasks')
      .update({
        assigned_to: calebEmail,
        created_by_email: calebEmail, // Also set creator so it's properly tracked
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating task:', error);
      return;
    }
    
    if (data) {
      console.log('✅ Task successfully assigned to caleb!');
      console.log('\n📋 Updated task details:');
      console.log(`   ID: ${data.id}`);
      console.log(`   Title: ${data.title}`);
      console.log(`   Assigned to: ${data.assigned_to}`);
      console.log(`   Created by: ${data.created_by_email}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Updated: ${data.updated_at}`);
    } else {
      console.log('⚠️  Task not found or update returned no data');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignTaskToCaleb();
