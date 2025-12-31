/**
 * API endpoint for storing and retrieving notifications
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
      // Try to fetch from notifications table
      // If table doesn't exist, return empty array
      // REQUIRED: Filter by user_id for security - users can only see their own notifications
      const { user_id } = req.query;
      
      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'user_id query parameter is required for security'
        });
      }
      
      // Optimize: Limit to recent notifications to reduce egress
      // Default: last 100 notifications (covers most use cases)
      // Optionally filter by unread only if limit is very low
      const limit = parseInt(req.query.limit) || 100;
      const unreadOnly = req.query.unread_only === 'true';
      
      let query = supabase
        .from('notifications')
        .select('id, user_id, type, title, message, is_read, created_at, scheduled_for, related_task_id, related_account_id') // Only essential fields
        .eq('user_id', user_id) // Always filter by user_id for security
        .order('created_at', { ascending: false })
        .limit(limit);
      
      // Optionally filter to unread only
      if (unreadOnly) {
        query = query.eq('is_read', false);
      }
      
      const { data, error } = await query;
      
      if (error) {
        // If table doesn't exist, return empty array
        if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
          console.warn('notifications table not found, returning empty array');
          return res.status(200).json({
            success: true,
            data: [],
            count: 0
          });
        }
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        // Create new notification in Supabase
        const { id, ...dataWithoutId } = data;
        const notificationData = { 
          ...dataWithoutId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Convert empty strings to null for date fields
        if (notificationData.scheduled_for === '' || notificationData.scheduled_for === null || notificationData.scheduled_for === undefined) {
          notificationData.scheduled_for = null;
        }
        
        // Convert empty strings to null for text fields
        if (notificationData.user_id === '' || notificationData.user_id === null || notificationData.user_id === undefined) {
          notificationData.user_id = null;
        }
        if (notificationData.related_task_id === '' || notificationData.related_task_id === null || notificationData.related_task_id === undefined) {
          notificationData.related_task_id = null;
        }
        if (notificationData.related_account_id === '' || notificationData.related_account_id === null || notificationData.related_account_id === undefined) {
          notificationData.related_account_id = null;
        }
        
        // Set default is_read if not provided
        if (notificationData.is_read === undefined) {
          notificationData.is_read = false;
        }
        
        // Only include id if it's provided and valid
        if (id) {
          notificationData.id = id;
        }
        
        const { data: created, error } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select()
          .single();
        
        if (error) {
          // Provide helpful error message if table doesn't exist
          if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
            return res.status(500).json({
              success: false,
              error: 'notifications table not found. Please create the table in Supabase first.'
            });
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
      // Update notification by ID in Supabase
      const { id, ...updateData } = req.body;
      updateData.updated_at = new Date().toISOString();
      
      // Convert empty strings to null for date fields
      if (updateData.scheduled_for === '' || updateData.scheduled_for === null || updateData.scheduled_for === undefined) {
        updateData.scheduled_for = null;
      }
      
      const { data: updated, error } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Notification not found'
          });
        }
        if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
          return res.status(500).json({
            success: false,
            error: 'notifications table not found. Please create the table in Supabase first.'
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
      // Delete notification by ID from Supabase
      const { id } = req.query;
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Notification not found'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'Notification deleted'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in notifications API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

