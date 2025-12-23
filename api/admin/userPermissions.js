/**
 * API endpoint for managing user permissions (admin only)
 * Allows system admin to enable/disable individual permissions for any user
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
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(7);
  
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
  ];
  
  console.log(`\n🔐 [${timestamp}] [${requestId}] USER PERMISSIONS API called:`, req.method, req.url);
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      // Get all permissions for a user
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
          requestId
        });
      }

      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error(`❌ [${requestId}] Error fetching permissions:`, error);
        return res.status(500).json({
          success: false,
          error: error.message,
          requestId
        });
      }

      // Convert array to object keyed by permission_id
      const permissions = {};
      data.forEach(perm => {
        permissions[perm.permission_id] = perm.enabled;
      });

      return res.status(200).json({
        success: true,
        data: permissions,
        requestId
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Upsert a permission for a user
      const { userId, permissionId, enabled } = req.body;

      if (!userId || !permissionId || typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'userId, permissionId, and enabled (boolean) are required',
          requestId
        });
      }

      const { data, error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          permission_id: permissionId,
          enabled: enabled
        }, {
          onConflict: 'user_id,permission_id'
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ [${requestId}] Error upserting permission:`, error);
        return res.status(500).json({
          success: false,
          error: error.message,
          requestId
        });
      }

      return res.status(200).json({
        success: true,
        data: data,
        requestId
      });
    }

    if (req.method === 'DELETE') {
      // Delete a permission for a user
      const { userId, permissionId } = req.query;

      if (!userId || !permissionId) {
        return res.status(400).json({
          success: false,
          error: 'userId and permissionId are required',
          requestId
        });
      }

      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission_id', permissionId);

      if (error) {
        console.error(`❌ [${requestId}] Error deleting permission:`, error);
        return res.status(500).json({
          success: false,
          error: error.message,
          requestId
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Permission deleted',
        requestId
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      requestId
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error in userPermissions API:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      requestId
    });
  }
}

