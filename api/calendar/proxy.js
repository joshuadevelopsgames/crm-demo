/**
 * API endpoint to proxy Google Calendar API calls
 * Tokens are retrieved from Supabase and never exposed to the frontend
 * Follows the same pattern as api/gmail/proxy.js
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Calendar API base URL
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app'
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

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.error('❌ Supabase configuration missing in calendar proxy');
      console.error('Environment check:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: Supabase not configured',
        details: 'Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables'
      });
    }

    // Get user ID from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    // Get Calendar integration for user
    const { data: initialIntegration, error: integrationError } = await supabase
      .from('google_calendar_integrations')
      .select('access_token, refresh_token, token_expiry')
      .eq('user_id', user.id)
      .single();
    
    let integration = initialIntegration;

    if (integrationError || !integration) {
      return res.status(401).json({ 
        success: false, 
        error: 'Calendar not connected' 
      });
    }

    // Check if token is expired or about to expire (refresh 5 minutes before expiry)
    const now = new Date();
    const expiryTime = integration.token_expiry ? new Date(integration.token_expiry) : null;
    const shouldRefresh = expiryTime && (expiryTime.getTime() - now.getTime() < 5 * 60 * 1000); // 5 minutes buffer

    if (shouldRefresh || (expiryTime && expiryTime < now)) {
      if (!integration.refresh_token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Calendar token expired. Please reconnect.' 
        });
      }

      // Refresh the token
      try {
        const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
        const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
          console.error('❌ Google OAuth credentials not configured', {
            hasClientId: !!CLIENT_ID,
            hasClientSecret: !!CLIENT_SECRET,
            envKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('CLIENT'))
          });
          return res.status(500).json({ 
            success: false, 
            error: 'Server configuration error: Google OAuth credentials missing',
            details: 'Please configure VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables'
          });
        }

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResponse.ok) {
          const errorData = await refreshResponse.json().catch(() => ({}));
          console.error('❌ Token refresh failed:', errorData);
          
          // If refresh token is invalid/expired, delete the integration
          if (refreshResponse.status === 400) {
            await supabase
              .from('google_calendar_integrations')
              .delete()
              .eq('user_id', user.id);
            
            return res.status(401).json({ 
              success: false, 
              error: 'Calendar token expired. Please reconnect.' 
            });
          }
          
          return res.status(401).json({ 
            success: false, 
            error: 'Failed to refresh Calendar token. Please reconnect.' 
          });
        }

        const tokenData = await refreshResponse.json();
        const newAccessToken = tokenData.access_token;
        const newExpiresIn = tokenData.expires_in || 3600; // Default to 1 hour
        const newTokenExpiry = new Date(Date.now() + newExpiresIn * 1000).toISOString();

        // Update the integration with new token
        const { data: updatedIntegration, error: updateError } = await supabase
          .from('google_calendar_integrations')
          .update({
            access_token: newAccessToken,
            token_expiry: newTokenExpiry,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .select('access_token, refresh_token, token_expiry')
          .single();

        if (updateError || !updatedIntegration) {
          console.error('❌ Error updating refreshed token:', updateError);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to save refreshed token' 
          });
        }

        console.log('✅ Calendar token refreshed successfully');
        integration = updatedIntegration;
      } catch (error) {
        console.error('❌ Error refreshing Calendar token:', error);
        // If token refresh fails, try to continue with existing token if it's not too expired
        // Otherwise return error
        const tokenAge = expiryTime ? (now.getTime() - expiryTime.getTime()) : Infinity;
        if (tokenAge > 60 * 60 * 1000) { // More than 1 hour expired
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh token. Please reconnect Calendar.',
            details: error.message
          });
        }
        // Token is only slightly expired, try to use it anyway
        console.warn('⚠️ Token refresh failed but token is not too old, attempting to use existing token');
      }
    }

    // Get Calendar API endpoint and params
    let endpoint, params, body;
    
    if (req.method === 'GET') {
      ({ endpoint, ...params } = req.query);
    } else {
      // For POST/PUT/DELETE, endpoint and event data come from body
      const requestBody = req.body || {};
      endpoint = requestBody.endpoint || req.query.endpoint;
      body = requestBody.event || requestBody;
      params = req.query;
    }
    
    if (!endpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Calendar API endpoint is required' 
      });
    }

    // Build Calendar API URL
    let url = `${CALENDAR_API_BASE}/${endpoint}`;
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // Proxy request to Calendar API
    const calendarResponse = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: (req.method === 'POST' || req.method === 'PUT') && body ? JSON.stringify(body) : undefined
    });

    const data = await calendarResponse.json();

    if (!calendarResponse.ok) {
      // Handle 401/403 errors - might indicate token issues
      if (calendarResponse.status === 401 || calendarResponse.status === 403) {
        console.error('❌ Calendar API authentication error:', {
          status: calendarResponse.status,
          error: data.error
        });
        
        // If it's an auth error, try to clean up the integration
        try {
          await supabase
            .from('google_calendar_integrations')
            .delete()
            .eq('user_id', user.id);
        } catch (cleanupError) {
          console.error('Error cleaning up integration:', cleanupError);
        }
      }
      
      return res.status(calendarResponse.status).json({ 
        success: false, 
        error: data.error?.message || 'Calendar API error',
        details: data.error
      });
    }

    return res.status(200).json({ 
      success: true, 
      data 
    });

  } catch (error) {
    console.error('❌ Error proxying Calendar API:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
