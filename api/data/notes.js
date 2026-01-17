/**
 * API endpoint for storing and retrieving research notes
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
      
      // Fetch notes using pagination to bypass Supabase's 1000 row limit
      let allNotes = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('research_notes')
          .select('*')
          .order('recorded_date', { ascending: false });
        
        // Filter by account_id if provided
        if (accountId) {
          query = query.eq('account_id', accountId);
        }
        
        const { data, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch research notes'
          });
        }
        
        if (data && data.length > 0) {
          allNotes = allNotes.concat(data);
        }
        
        hasMore = data && data.length === pageSize;
        page++;
      }

      return res.status(200).json({
        success: true,
        data: allNotes
      });
    }

    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        const { data: note, error } = await supabase
          .from('research_notes')
          .insert({
            ...data,
            id: data.id || undefined, // Use provided ID or let DB generate
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) {
          console.error('Error creating note:', error);
          return res.status(500).json({
            success: false,
            error: error.message || 'Failed to create research note'
          });
        }
        
        return res.status(201).json({
          success: true,
          data: note
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "create"'
      });
    }

    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID is required for update'
        });
      }
      
      const { data: note, error } = await supabase
        .from('research_notes')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating note:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to update research note'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: note
      });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID is required for deletion'
        });
      }
      
      const { error } = await supabase
        .from('research_notes')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting note:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to delete research note'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Research note deleted successfully'
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

