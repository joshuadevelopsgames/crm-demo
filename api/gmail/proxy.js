/**
 * API endpoint to proxy Gmail API calls
 * Tokens are retrieved from Supabase and never exposed to the frontend
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

// Gmail API base URL
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
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

    // Get Gmail integration for user
    const { data: integration, error: integrationError } = await supabase
      .from('gmail_integrations')
      .select('access_token, refresh_token, token_expiry')
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      return res.status(401).json({ 
        success: false, 
        error: 'Gmail not connected' 
      });
    }

    // Check if token is expired
    if (integration.token_expiry && new Date(integration.token_expiry) < new Date()) {
      // Token expired - try to refresh
      if (!integration.refresh_token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Gmail token expired. Please reconnect.' 
        });
      }

      // Refresh token (would need to implement refresh endpoint)
      // For now, return error
      return res.status(401).json({ 
        success: false, 
        error: 'Gmail token expired. Please reconnect.' 
      });
    }

    // Get Gmail API endpoint and params from query
    const { endpoint, ...params } = req.query;
    
    if (!endpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Gmail API endpoint is required' 
      });
    }

    // Build Gmail API URL
    let url = `${GMAIL_API_BASE}/${endpoint}`;
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // Proxy request to Gmail API
    const gmailResponse = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
    });

    const data = await gmailResponse.json();

    if (!gmailResponse.ok) {
      return res.status(gmailResponse.status).json({ 
        success: false, 
        error: data.error?.message || 'Gmail API error',
        details: data
      });
    }

    return res.status(200).json({ 
      success: true, 
      data 
    });

  } catch (error) {
    console.error('Error proxying Gmail API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

