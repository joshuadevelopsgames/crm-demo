/**
 * API endpoint for storing and retrieving sequences
 * Data is stored in Supabase database
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      // Try to fetch from sequences table
      // If table doesn't exist, return empty array
      let allSequences = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('sequences')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          // If table doesn't exist, return empty array
          if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
            console.warn('sequences table not found, returning empty array');
            return res.status(200).json({
              success: true,
              data: [],
              count: 0
            });
          }
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        if (data && data.length > 0) {
          allSequences = allSequences.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return res.status(200).json({
        success: true,
        data: allSequences,
        count: allSequences.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        // Create new sequence in Supabase
        const { id, ...dataWithoutId } = data;
        const sequenceData = { 
          ...dataWithoutId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Ensure steps is a valid JSON array
        if (sequenceData.steps && !Array.isArray(sequenceData.steps)) {
          sequenceData.steps = [];
        }
        
        // Only include id if it's provided and valid
        if (id) {
          sequenceData.id = id;
        } else {
          // Generate a simple ID if not provided
          sequenceData.id = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        const { data: created, error } = await supabase
          .from('sequences')
          .insert(sequenceData)
          .select()
          .single();
        
        if (error) {
          // Provide helpful error message if table doesn't exist
          if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
            return res.status(500).json({
              success: false,
              error: 'sequences table not found. Please create the table in Supabase first.'
            });
          }
          throw error;
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
      // Update sequence by ID in Supabase
      const { id, ...updateData } = req.body;
      updateData.updated_at = new Date().toISOString();
      
      // Validate that id is provided
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Sequence ID is required'
        });
      }
      
      // Don't allow updating the id field
      delete updateData.id;
      
      const { data: updated, error } = await supabase
        .from('sequences')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Sequence not found'
          });
        }
        if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
          return res.status(500).json({
            success: false,
            error: 'sequences table not found. Please create the table in Supabase first.'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        data: updated
      });
    }
    
    if (req.method === 'DELETE') {
      // Delete sequence by ID from Supabase
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Sequence ID is required'
        });
      }
      
      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
          return res.status(500).json({
            success: false,
            error: 'sequences table not found. Please create the table in Supabase first.'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'Sequence deleted successfully'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in sequences API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

