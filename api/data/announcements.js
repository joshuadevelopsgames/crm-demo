/**
 * API endpoint for managing announcements
 * Only admins can create/update/delete announcements
 * All authenticated users can read active announcements
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

// Check if user is admin
async function isAdmin(supabase, userId) {
  if (!userId) return false;
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !profile) return false;
  
  return profile.role === 'admin' || profile.role === 'system_admin';
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    // Get the user from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - No valid token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid token'
      });
    }

    if (req.method === 'GET') {
      // Get all active announcements (all authenticated users can read)
      const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
          return res.status(500).json({
            success: false,
            error: 'announcements table not found. Please create the table in Supabase first.'
          });
        }
        throw error;
      }

      return res.status(200).json({
        success: true,
        data: announcements || []
      });
    }

    if (req.method === 'POST') {
      // Only admins can create announcements
      const userIsAdmin = await isAdmin(supabase, user.id);
      if (!userIsAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden - Only admins can create announcements'
        });
      }

      const { action, data } = req.body;
      
      if (action === 'create') {
        const { id, ...dataWithoutId } = data;
        const announcementData = { 
          ...dataWithoutId,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Convert empty strings to null for date fields
        if (announcementData.expires_at === '' || announcementData.expires_at === null || announcementData.expires_at === undefined) {
          announcementData.expires_at = null;
        }
        
        // Set defaults
        if (announcementData.is_active === undefined) {
          announcementData.is_active = true;
        }
        if (!announcementData.priority) {
          announcementData.priority = 'normal';
        }
        
        // Only include id if it's provided and valid
        if (id) {
          announcementData.id = id;
        }
        
        const { data: created, error } = await supabase
          .from('announcements')
          .insert(announcementData)
          .select()
          .single();
        
        if (error) {
          if (error.message && (error.message.includes('schema cache') || error.message.includes('relation') || error.code === 'PGRST204')) {
            return res.status(500).json({
              success: false,
              error: 'announcements table not found. Please create the table in Supabase first.'
            });
          }
          throw error;
        }

        // Announcements are displayed as banners, not notifications
        // No need to create individual notifications
        
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
      // Only admins can update announcements
      const userIsAdmin = await isAdmin(supabase, user.id);
      if (!userIsAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden - Only admins can update announcements'
        });
      }

      const { id, ...updateData } = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Announcement ID is required'
        });
      }

      // Convert empty strings to null for date fields
      if (updateData.expires_at === '') {
        updateData.expires_at = null;
      }

      updateData.updated_at = new Date().toISOString();
      
      const { data: updated, error } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        data: updated
      });
    }

    if (req.method === 'DELETE') {
      // Only admins can delete announcements
      const userIsAdmin = await isAdmin(supabase, user.id);
      if (!userIsAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden - Only admins can delete announcements'
        });
      }

      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Announcement ID is required'
        });
      }

      // Soft delete by setting is_active to false
      const { data: deleted, error } = await supabase
        .from('announcements')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        data: deleted
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

