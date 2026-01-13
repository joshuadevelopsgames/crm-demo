/**
 * API endpoint for managing Gmail integrations
 * Securely stores and retrieves Gmail OAuth tokens from Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase configuration missing');
    return null;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }

    // Get user ID from Authorization header (Supabase JWT)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - No token provided' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Invalid token' 
      });
    }

    const userId = user.id;

    // GET - Retrieve Gmail integration for user
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('gmail_integrations')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error fetching Gmail integration:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch Gmail integration' 
        });
      }

      if (!data) {
        return res.status(200).json({ 
          success: true, 
          data: null,
          connected: false
        });
      }

      // Don't return tokens directly - return connection status
      return res.status(200).json({ 
        success: true, 
        data: {
          id: data.id,
          connected: true,
          last_sync: data.last_sync,
          token_expiry: data.token_expiry
        },
        connected: true
      });
    }

    // POST - Store or update Gmail integration
    if (req.method === 'POST') {
      const { access_token, refresh_token, expires_in } = req.body;

      if (!access_token) {
        return res.status(400).json({ 
          success: false, 
          error: 'access_token is required' 
        });
      }

      const tokenExpiry = expires_in 
        ? new Date(Date.now() + expires_in * 1000).toISOString()
        : null;

      // Check if integration exists
      const { data: existing } = await supabase
        .from('gmail_integrations')
        .select('id')
        .eq('user_id', userId)
        .single();

      let result;
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('gmail_integrations')
          .update({
            access_token,
            refresh_token: refresh_token || null,
            token_expiry: tokenExpiry,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          console.error('Error updating Gmail integration:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to update Gmail integration' 
          });
        }
        result = data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('gmail_integrations')
          .insert({
            user_id: userId,
            access_token,
            refresh_token: refresh_token || null,
            token_expiry: tokenExpiry
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating Gmail integration:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to create Gmail integration' 
          });
        }
        result = data;
      }

      return res.status(200).json({ 
        success: true, 
        data: {
          id: result.id,
          connected: true
        }
      });
    }

    // DELETE - Remove Gmail integration
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('gmail_integrations')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting Gmail integration:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to disconnect Gmail' 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Gmail disconnected successfully' 
      });
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('Error in Gmail integration API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

