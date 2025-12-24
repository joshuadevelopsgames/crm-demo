import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      // Get all snoozes (filtered by user_id if provided)
      const { user_id, notification_type, related_account_id } = req.query;
      
      let query = supabase.from('notification_snoozes').select('*');
      
      if (user_id) {
        query = query.eq('user_id', user_id);
      }
      if (notification_type) {
        query = query.eq('notification_type', notification_type);
      }
      if (related_account_id !== undefined) {
        if (related_account_id === null || related_account_id === 'null') {
          query = query.is('related_account_id', null);
        } else {
          query = query.eq('related_account_id', related_account_id);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching notification snoozes:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to fetch notification snoozes'
        });
      }

      return res.status(200).json({
        success: true,
        data: data || []
      });
    }

    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'snooze') {
        // Upsert snooze (create or update)
        const { user_id, notification_type, related_account_id, snoozed_until } = data;
        
        if (!user_id || !notification_type || !snoozed_until) {
          return res.status(400).json({
            success: false,
            error: 'user_id, notification_type, and snoozed_until are required'
          });
        }
        
        const snoozeData = {
          user_id,
          notification_type,
          related_account_id: related_account_id || null,
          snoozed_until,
          updated_at: new Date().toISOString()
        };
        
        const { data: snooze, error } = await supabase
          .from('notification_snoozes')
          .upsert(snoozeData, {
            onConflict: 'user_id,notification_type,related_account_id'
          })
          .select()
          .single();
        
        if (error) {
          console.error('Error creating/updating snooze:', error);
          return res.status(500).json({
            success: false,
            error: error.message || 'Failed to snooze notification'
          });
        }

        return res.status(200).json({
          success: true,
          data: snooze
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "snooze"'
      });
    }

    if (req.method === 'DELETE') {
      // Delete snooze
      const { user_id, notification_type, related_account_id } = req.query;
      
      if (!user_id || !notification_type) {
        return res.status(400).json({
          success: false,
          error: 'user_id and notification_type are required'
        });
      }
      
      let query = supabase
        .from('notification_snoozes')
        .delete()
        .eq('user_id', user_id)
        .eq('notification_type', notification_type);
      
      if (related_account_id !== undefined) {
        if (related_account_id === null || related_account_id === 'null') {
          query = query.is('related_account_id', null);
        } else {
          query = query.eq('related_account_id', related_account_id);
        }
      }
      
      const { error } = await query;
      
      if (error) {
        console.error('Error deleting snooze:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to delete snooze'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Snooze deleted'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

