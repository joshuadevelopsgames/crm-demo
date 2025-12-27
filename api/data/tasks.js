/**
 * API endpoint for storing and retrieving tasks
 * Data is stored in Supabase database
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      // Fetch all tasks using pagination to bypass Supabase's 1000 row limit
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
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        if (data && data.length > 0) {
          allTasks = allTasks.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return res.status(200).json({
        success: true,
        data: allTasks,
        count: allTasks.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        // Create new task in Supabase
        // Remove id if it's not a valid UUID - let Supabase generate it
        const { id, ...dataWithoutId } = data;
        const taskData = { 
          ...dataWithoutId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Convert empty strings to null for date/time fields
        if (taskData.due_date === '' || taskData.due_date === null || taskData.due_date === undefined) {
          taskData.due_date = null;
        }
        if (taskData.due_time === '' || taskData.due_time === null || taskData.due_time === undefined) {
          taskData.due_time = null;
        }
        if (taskData.completed_date === '' || taskData.completed_date === null || taskData.completed_date === undefined) {
          taskData.completed_date = null;
        }
        
        // Convert empty strings to null for UUID fields
        if (taskData.related_account_id === '' || taskData.related_account_id === null || taskData.related_account_id === undefined) {
          taskData.related_account_id = null;
        }
        if (taskData.related_contact_id === '' || taskData.related_contact_id === null || taskData.related_contact_id === undefined) {
          taskData.related_contact_id = null;
        }
        if (taskData.blocked_by_task_id === '' || taskData.blocked_by_task_id === null || taskData.blocked_by_task_id === undefined) {
          taskData.blocked_by_task_id = null;
        }
        
        // Only include id if it's a valid UUID format
        if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          taskData.id = id;
        }
        
        const { data: created, error } = await supabase
          .from('tasks')
          .insert(taskData)
          .select()
          .single();
        
        if (error) {
          // Provide more helpful error message if table doesn't exist
          if (error.message && error.message.includes('schema cache')) {
            throw new Error('Tasks table not found. Please ensure the tasks table has been created in Supabase. Run the create_tasks_table.sql file in your Supabase SQL Editor.');
          }
          throw error;
        }
        
        return res.status(201).json({
          success: true,
          data: created
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "create"'
      });
    }
    
    if (req.method === 'PUT') {
      // Update task by ID in Supabase
      const { id, ...updateData } = req.body;
      updateData.updated_at = new Date().toISOString();
      
      // Convert empty strings to null for date/time fields
      if (updateData.due_date === '' || updateData.due_date === null || updateData.due_date === undefined) {
        updateData.due_date = null;
      }
      if (updateData.due_time === '' || updateData.due_time === null || updateData.due_time === undefined) {
        updateData.due_time = null;
      }
      if (updateData.completed_date === '' || updateData.completed_date === null || updateData.completed_date === undefined) {
        updateData.completed_date = null;
      }
      
      // Convert empty strings to null for UUID fields
      if (updateData.related_account_id === '' || updateData.related_account_id === null || updateData.related_account_id === undefined) {
        updateData.related_account_id = null;
      }
      if (updateData.related_contact_id === '' || updateData.related_contact_id === null || updateData.related_contact_id === undefined) {
        updateData.related_contact_id = null;
      }
      if (updateData.blocked_by_task_id === '' || updateData.blocked_by_task_id === null || updateData.blocked_by_task_id === undefined) {
        updateData.blocked_by_task_id = null;
      }
      
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Task not found'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        data: updated
      });
    }
    
    if (req.method === 'DELETE') {
      // Delete task by ID from Supabase
      const { id } = req.query;
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Task not found'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'Task deleted'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

