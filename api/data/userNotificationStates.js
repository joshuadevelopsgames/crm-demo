/**
 * API endpoint for storing and retrieving user notification states (JSONB)
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
      const { user_id } = req.query;
      
      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'user_id query parameter is required for security'
        });
      }
      
      // Use service role key which bypasses RLS
      // Select only needed columns to reduce payload size
      // Add timeout and error handling for large JSONB queries
      const queryStartTime = Date.now();
      const { data, error } = await supabase
        .from('user_notification_states')
        .select('user_id, notifications, created_at, updated_at')
        .eq('user_id', user_id)
        .single();
      const queryTime = Date.now() - queryStartTime;
      
      // Log slow queries
      if (queryTime > 1000) {
        console.warn(`⚠️ Slow query detected: ${queryTime}ms for user ${user_id}`);
      }
      
      if (error) {
        // If no record found (PGRST116), return empty state - this is normal for new users
        if (error.code === 'PGRST116') {
          console.log(`ℹ️ No notification state found for user ${user_id} (this is normal - will be created on first update)`);
          return res.status(200).json({
            success: true,
            data: {
              user_id: user_id,
              notifications: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });
        }
        // If table doesn't exist
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.error(`❌ user_notification_states table does not exist. Run create_user_notification_states_table.sql`);
          return res.status(200).json({
            success: true,
            data: {
              user_id: user_id,
              notifications: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });
        }
        // Check for RLS/permission errors
        if (error.message?.includes('permission') || error.message?.includes('policy') || error.code === '42501') {
          console.error(`❌ RLS policy error fetching user_notification_states for user ${user_id}:`, error.message);
          console.error(`   This might indicate the service role key is not configured correctly or RLS is blocking access.`);
          return res.status(500).json({
            success: false,
            error: `Permission denied: ${error.message}. Check RLS policies and service role key configuration.`
          });
        }
        // Check for query timeout or size limits
        if (error.message?.includes('timeout') || error.message?.includes('limit') || error.code === '57014') {
          console.error(`❌ Query timeout or limit error for user ${user_id}:`, error.message);
          return res.status(500).json({
            success: false,
            error: `Query timeout or size limit exceeded: ${error.message}. Consider paginating notifications.`
          });
        }
        console.error('Supabase error fetching user_notification_states:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      // Log what we found
      const notificationCount = data?.notifications ? (Array.isArray(data.notifications) ? data.notifications.length : 0) : 0;
      if (notificationCount > 0) {
        console.log(`✅ Found ${notificationCount} bulk notifications for user ${user_id}`);
      }
      
      return res.status(200).json({
        success: true,
        data: data || {
          user_id: user_id,
          notifications: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
    }
    
    if (req.method === 'POST') {
      const { action, data: requestData } = req.body;
      
      if (action === 'upsert') {
        const { user_id, notifications } = requestData;
        
        if (!user_id) {
          return res.status(400).json({
            success: false,
            error: 'user_id is required'
          });
        }
        
        // Ensure notifications is an array
        const notificationsArray = Array.isArray(notifications) ? notifications : [];
        
        const { data, error } = await supabase
          .from('user_notification_states')
          .upsert({
            user_id: user_id,
            notifications: notificationsArray,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
          .select()
          .single();
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        return res.status(200).json({
          success: true,
          data: data
        });
      }
      
      if (action === 'update_read') {
        const { user_id, notification_id, is_read } = requestData;
        
        if (!user_id || !notification_id) {
          return res.status(400).json({
            success: false,
            error: 'user_id and notification_id are required'
          });
        }
        
        // Get current state
        const { data: currentState, error: fetchError } = await supabase
          .from('user_notification_states')
          .select('notifications')
          .eq('user_id', user_id)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Supabase error:', fetchError);
          return res.status(500).json({
            success: false,
            error: fetchError.message
          });
        }
        
        const notifications = currentState?.notifications || [];
        const updatedNotifications = notifications.map(notif => {
          if (notif.id === notification_id) {
            return { ...notif, is_read: is_read };
          }
          return notif;
        });
        
        const { data, error } = await supabase
          .from('user_notification_states')
          .upsert({
            user_id: user_id,
            notifications: updatedNotifications,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
          .select()
          .single();
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        return res.status(200).json({
          success: true,
          data: data
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "upsert" or "update_read"'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('Error in userNotificationStates handler:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

