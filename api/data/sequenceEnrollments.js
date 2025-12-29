/**
 * API endpoint for storing and retrieving sequence enrollments
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
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
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
      // Try to fetch from sequence_enrollments table
      // If table doesn't exist, return empty array
      let allEnrollments = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('sequence_enrollments')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          // If table doesn't exist, return empty array
          if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
            console.warn('sequence_enrollments table not found, returning empty array');
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
          allEnrollments = allEnrollments.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return res.status(200).json({
        success: true,
        data: allEnrollments,
        count: allEnrollments.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        // Create new enrollment in Supabase
        const { id, ...dataWithoutId } = data;
        const enrollmentData = { 
          ...dataWithoutId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Convert empty strings to null for date fields
        if (enrollmentData.started_date === '' || enrollmentData.started_date === null || enrollmentData.started_date === undefined) {
          enrollmentData.started_date = null;
        }
        if (enrollmentData.next_action_date === '' || enrollmentData.next_action_date === null || enrollmentData.next_action_date === undefined) {
          enrollmentData.next_action_date = null;
        }
        
        // Convert empty strings to null for text fields
        if (enrollmentData.account_id === '' || enrollmentData.account_id === null || enrollmentData.account_id === undefined) {
          enrollmentData.account_id = null;
        }
        if (enrollmentData.sequence_id === '' || enrollmentData.sequence_id === null || enrollmentData.sequence_id === undefined) {
          enrollmentData.sequence_id = null;
        }
        
        // Generate ID if not provided
        if (id) {
          enrollmentData.id = id;
        } else {
          // Generate a simple ID if not provided
          enrollmentData.id = `enroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        const { data: created, error } = await supabase
          .from('sequence_enrollments')
          .insert(enrollmentData)
          .select()
          .single();
        
        if (error) {
          // Log the actual error for debugging
          console.error('Error creating sequence enrollment:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          console.error('Enrollment data:', enrollmentData);
          
          // Provide helpful error message if table doesn't exist
          if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204' || error.code === '42P01')) {
            return res.status(500).json({
              success: false,
              error: `sequence_enrollments table not found. Please create the table in Supabase first. Error: ${error.message}`
            });
          }
          
          // Return the actual error message
          return res.status(500).json({
            success: false,
            error: error.message || error.details || 'Failed to create sequence enrollment',
            errorCode: error.code,
            errorHint: error.hint
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
      // Update enrollment by ID in Supabase
      const { id, ...updateData } = req.body;
      updateData.updated_at = new Date().toISOString();
      
      // Convert empty strings to null for date fields
      if (updateData.started_date === '' || updateData.started_date === null || updateData.started_date === undefined) {
        updateData.started_date = null;
      }
      if (updateData.next_action_date === '' || updateData.next_action_date === null || updateData.next_action_date === undefined) {
        updateData.next_action_date = null;
      }
      
      const { data: updated, error } = await supabase
        .from('sequence_enrollments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Sequence enrollment not found'
          });
        }
        if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
          return res.status(500).json({
            success: false,
            error: 'sequence_enrollments table not found. Please create the table in Supabase first.'
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
      // Delete enrollment by ID from Supabase
      const { id } = req.query;
      
      const { error } = await supabase
        .from('sequence_enrollments')
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Sequence enrollment not found'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'Sequence enrollment deleted'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in sequenceEnrollments API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

