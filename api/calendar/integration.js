/**
 * API endpoint for managing Google Calendar integrations
 * Securely stores and retrieves Calendar OAuth tokens from Supabase
 * Follows the same pattern as api/gmail/integration.js
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

    // GET - Retrieve Calendar integration for user
    if (req.method === 'GET') {
      console.log('📅 GET /api/calendar/integration - User ID:', userId);
      
      const { data, error } = await supabase
        .from('google_calendar_integrations')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - not connected
          console.log('📅 No Calendar integration found for user');
          return res.status(200).json({ 
            success: true, 
            data: null,
            connected: false
          });
        } else {
          console.error('❌ Error fetching Calendar integration:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch Calendar integration',
            details: error.message
          });
        }
      }

      if (!data) {
        console.log('📅 No Calendar integration data found');
        return res.status(200).json({ 
          success: true, 
          data: null,
          connected: false
        });
      }

      console.log('✅ Calendar integration found:', { 
        id: data.id, 
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        tokenExpiry: data.token_expiry
      });

      // Don't return tokens directly - return connection status
      return res.status(200).json({ 
        success: true, 
        data: {
          id: data.id,
          connected: true,
          calendar_id: data.calendar_id,
          last_sync: data.last_sync,
          token_expiry: data.token_expiry
        },
        connected: true
      });
    }

    // POST - Store or update Calendar integration
    if (req.method === 'POST') {
      const { access_token, refresh_token, expires_in, calendar_id } = req.body;

      console.log('📅 POST /api/calendar/integration - User ID:', userId);
      console.log('📅 Token data:', { 
        hasAccessToken: !!access_token, 
        hasRefreshToken: !!refresh_token,
        expiresIn: expires_in 
      });

      if (!access_token) {
        console.error('❌ Missing access_token');
        return res.status(400).json({ 
          success: false, 
          error: 'access_token is required' 
        });
      }

      const tokenExpiry = expires_in 
        ? new Date(Date.now() + expires_in * 1000).toISOString()
        : null;

      // Check if integration exists
      const { data: existing, error: checkError } = await supabase
        .from('google_calendar_integrations')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing Calendar integration:', checkError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to check existing Calendar integration',
          details: checkError.message
        });
      }

      let result;
      if (existing) {
        // Update existing
        console.log('📅 Updating existing Calendar integration:', existing.id);
        const { data, error } = await supabase
          .from('google_calendar_integrations')
          .update({
            access_token,
            refresh_token: refresh_token || null,
            token_expiry: tokenExpiry,
            calendar_id: calendar_id || 'primary',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          console.error('❌ Error updating Calendar integration:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to update Calendar integration',
            details: error.message
          });
        }
        result = data;
        console.log('✅ Calendar integration updated:', result.id);
      } else {
        // Create new
        console.log('📅 Creating new Calendar integration');
        const { data, error } = await supabase
          .from('google_calendar_integrations')
          .insert({
            user_id: userId,
            access_token,
            refresh_token: refresh_token || null,
            token_expiry: tokenExpiry,
            calendar_id: calendar_id || 'primary'
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating Calendar integration:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to create Calendar integration',
            details: error.message
          });
        }
        result = data;
        console.log('✅ Calendar integration created:', result.id);
      }

      // Verify it was stored
      const { data: verify } = await supabase
        .from('google_calendar_integrations')
        .select('id, access_token')
        .eq('user_id', userId)
        .single();
      
      console.log('✅ Verification:', { 
        found: !!verify, 
        hasToken: !!verify?.access_token 
      });

      return res.status(200).json({ 
        success: true, 
        data: {
          id: result.id,
          connected: true
        }
      });
    }

    // DELETE - Remove Calendar integration
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('google_calendar_integrations')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting Calendar integration:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to disconnect Calendar' 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Calendar disconnected successfully' 
      });
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('Error in Calendar integration API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}
