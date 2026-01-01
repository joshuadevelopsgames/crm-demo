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

      // Get the requesting user's ID from the auth header or session
      // For now, we'll need to pass it in the request or get it from a session
      // This is a simplified check - in production, you'd get this from the authenticated session
      const requestingUserId = req.headers['x-user-id'] || req.body.requestingUserId;
      
      // Check if target user is system admin - prevent permission changes
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error(`❌ [${requestId}] Error fetching user profile:`, profileError);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify user role',
          requestId
        });
      }

      if (userProfile?.role === 'system_admin') {
        console.log(`⚠️ [${requestId}] Attempt to modify system admin permissions blocked for user:`, userId);
        return res.status(403).json({
          success: false,
          error: 'System Admin permissions cannot be modified',
          requestId
        });
      }

      // If requesting user is provided, check if they have the permission they're trying to modify
      if (requestingUserId) {
        const { data: requestingUserProfile } = await supabase
          .from('profiles')
          .select('role, email')
          .eq('id', requestingUserId)
          .single();

        // System admin can modify any permission
        if (requestingUserProfile?.role !== 'system_admin') {
          // Check if requesting user has this permission
          const { data: requestingUserPerms } = await supabase
            .from('user_permissions')
            .select('enabled')
            .eq('user_id', requestingUserId)
            .eq('permission_id', permissionId)
            .single();

          // Determine if requesting user has this permission
          let hasPermission = false;
          
          // Special case: manage_permissions is always available to admins
          if (permissionId === 'manage_permissions' && requestingUserProfile?.role === 'admin') {
            hasPermission = true;
          } 
          // Special case: access_scoring and manage_icp_template are available to admins
          else if ((permissionId === 'access_scoring' || permissionId === 'manage_icp_template') && requestingUserProfile?.role === 'admin') {
            hasPermission = true;
          }
          // Check database permission
          else if (requestingUserPerms?.enabled === true) {
            hasPermission = true;
          }
          // If no database record exists, check default (most permissions default to true)
          else if (requestingUserPerms === null) {
            // Default to true for most permissions unless explicitly false
            hasPermission = true; // Most permissions default to enabled
          }
          
          if (!hasPermission) {
            console.log(`⚠️ [${requestId}] Admin ${requestingUserId} attempted to modify permission ${permissionId} they don't have`);
            return res.status(403).json({
              success: false,
              error: 'You can only modify permissions that you have access to',
              requestId
            });
          }
        }
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

      // Check if user is system admin - prevent permission deletion
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error(`❌ [${requestId}] Error fetching user profile:`, profileError);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify user role',
          requestId
        });
      }

      if (userProfile?.role === 'system_admin') {
        console.log(`⚠️ [${requestId}] Attempt to delete system admin permissions blocked for user:`, userId);
        return res.status(403).json({
          success: false,
          error: 'System Admin permissions cannot be modified',
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

