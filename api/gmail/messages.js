/**
 * API endpoint for retrieving Gmail messages
 * Returns synced emails from gmail_messages table
 */

import { createClient } from '@supabase/supabase-js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
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
    
    const userId = user.id;
    const { account_id, contact_id, limit = 50, offset = 0 } = req.query;
    
    // Build query
    let query = supabase
      .from('gmail_messages')
      .select('*')
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Filter by account if provided
    if (account_id) {
      query = query.eq('account_id', account_id);
    }
    
    // Filter by contact if provided
    if (contact_id) {
      query = query.eq('contact_id', contact_id);
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      console.error('Error fetching Gmail messages:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch messages' 
      });
    }
    
    return res.status(200).json({
      success: true,
      data: messages || [],
      count: messages?.length || 0
    });
    
  } catch (error) {
    console.error('Error in Gmail messages API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

