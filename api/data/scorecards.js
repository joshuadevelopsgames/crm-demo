/**
 * API endpoint for storing and retrieving scorecard responses
 * Data is stored in Supabase database
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      // Support filtering by account_id via query parameter
      const accountId = req.query.account_id;
      
      // Validate account_id is provided and is a non-empty string
      if (accountId && typeof accountId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid account_id format. Must be a string.'
        });
      }

      // Fetch scorecards using pagination to bypass Supabase's 1000 row limit
      let allScorecards = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('scorecard_responses')
          .select('*')
          .order('completed_date', { ascending: false });
        
        // Filter by account_id if provided (server-side filtering for accuracy)
        if (accountId) {
          query = query.eq('account_id', accountId);
        }
        
        const { data, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        if (data && data.length > 0) {
          allScorecards = allScorecards.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return res.status(200).json({
        success: true,
        data: allScorecards,
        count: allScorecards.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        // Create new scorecard response in Supabase
        const scorecardData = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Only include template_version_id if provided (column may not exist in all databases)
        // Try to use template_version_id if provided, otherwise fall back to template_id
        if (data.template_version_id !== undefined && data.template_version_id !== null) {
          scorecardData.template_version_id = data.template_version_id;
        } else if (data.template_id !== undefined && data.template_id !== null) {
          // Only set template_version_id if we have a template_id (column may not exist)
          // We'll try to insert it, but if it fails due to missing column, we'll retry without it
          scorecardData.template_version_id = data.template_id;
        }
        
        // Validate account_id is provided and is a non-empty string
        if (scorecardData.account_id && typeof scorecardData.account_id !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Invalid account_id format. Must be a string.'
          });
        }
        
        let { data: created, error } = await supabase
          .from('scorecard_responses')
          .insert(scorecardData)
          .select()
          .single();
        
        // If error is due to missing template_version_id column, retry without it
        if (error && error.message && error.message.includes('template_version_id')) {
          console.warn('⚠️ template_version_id column not found, retrying without it');
          delete scorecardData.template_version_id;
          const retryResult = await supabase
            .from('scorecard_responses')
            .insert(scorecardData)
            .select()
            .single();
          created = retryResult.data;
          error = retryResult.error;
        }
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
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
      // Update scorecard response by ID in Supabase
      const { id, ...updateData } = req.body;
      updateData.updated_at = new Date().toISOString();
      
      const { data: updated, error } = await supabase
        .from('scorecard_responses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Scorecard response not found'
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
        data: updated
      });
    }
    
    if (req.method === 'DELETE') {
      // Delete scorecard response by ID from Supabase
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID is required'
        });
      }
      
      const { error } = await supabase
        .from('scorecard_responses')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Scorecard response deleted successfully'
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

