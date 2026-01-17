/**
 * API endpoint for managing at-risk accounts table
 * This table tracks which accounts are currently at-risk and should show renewal notifications
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export default async function handler(req, res) {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      // Get all at-risk accounts
      const { data, error } = await supabase
        .from('at_risk_accounts')
        .select('*')
        .order('days_until_renewal', { ascending: true });
      
      if (error) {
        console.error('Error fetching at-risk accounts:', error);
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
      const { action } = req.body;
      
      if (action === 'sync_all') {
        // Sync all at-risk accounts (calls the database function)
        const { data, error } = await supabase.rpc('sync_all_at_risk_accounts');
        
        if (error) {
          console.error('Error syncing at-risk accounts:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        return res.status(200).json({
          success: true,
          data: data?.[0] || { added_count: 0, removed_count: 0, updated_count: 0 }
        });
      }
      
      if (action === 'sync_account') {
        // Sync a specific account's at-risk status
        const { account_id } = req.body;
        
        if (!account_id) {
          return res.status(400).json({
            success: false,
            error: 'account_id is required'
          });
        }
        
        const { error } = await supabase.rpc('sync_account_at_risk_status', {
          account_id_param: account_id
        });
        
        if (error) {
          console.error('Error syncing account at-risk status:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        return res.status(200).json({
          success: true,
          message: 'Account at-risk status synced'
        });
      }
      
      if (action === 'check_expired_snoozes') {
        // Check for expired snoozes and restore accounts
        const { data, error } = await supabase.rpc('check_expired_snoozes_and_restore_at_risk');
        
        if (error) {
          console.error('Error checking expired snoozes:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        return res.status(200).json({
          success: true,
          data: data?.[0] || { restored_count: 0 }
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "sync_all", "sync_account", or "check_expired_snoozes"'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in at-risk accounts API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

