/**
 * API endpoint to proxy Google Drive API calls
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

// Drive API base URL
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

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

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
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

    // Get Drive integration for user
    const { data: integration, error: integrationError } = await supabase
      .from('google_drive_integrations')
      .select('access_token, refresh_token, token_expiry')
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      return res.status(401).json({ 
        success: false, 
        error: 'Drive not connected' 
      });
    }

    // Check if token is expired
    if (integration.token_expiry && new Date(integration.token_expiry) < new Date()) {
      if (!integration.refresh_token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Drive token expired. Please reconnect.' 
        });
      }
      // TODO: Implement token refresh
      return res.status(401).json({ 
        success: false, 
        error: 'Drive token expired. Please reconnect.' 
      });
    }

    // Get Drive API endpoint and params
    const { endpoint, ...params } = req.query;
    
    if (!endpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Drive API endpoint is required' 
      });
    }

    // Build Drive API URL
    let url = `${DRIVE_API_BASE}/${endpoint}`;
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // Proxy request to Drive API
    const driveResponse = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: req.method === 'POST' || req.method === 'PUT' ? JSON.stringify(req.body) : undefined
    });

    const data = await driveResponse.json();

    if (!driveResponse.ok) {
      return res.status(driveResponse.status).json({ 
        success: false, 
        error: data.error?.message || 'Drive API error',
        details: data
      });
    }

    return res.status(200).json({ 
      success: true, 
      data 
    });

  } catch (error) {
    console.error('Error proxying Drive API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}
