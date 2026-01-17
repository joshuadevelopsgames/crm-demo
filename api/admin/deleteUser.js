/**
 * API endpoint for deleting users (admin only)
 * Uses Supabase service role key to delete users from auth.users
 * Profile will be automatically deleted via CASCADE
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
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app'
  ];
  
  console.log(`\n🗑️ [${timestamp}] [${requestId}] DELETE USER API endpoint called:`, req.method, req.url);
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log(`🗑️ [${requestId}] CORS origin allowed:`, origin);
  } else {
    console.log(`⚠️ [${requestId}] CORS origin not in allowed list:`, origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] OPTIONS preflight request, returning 200`);
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    console.error(`❌ [${requestId}] Invalid method:`, req.method);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      requestId
    });
  }

  try {
    console.log(`\n🗑️ [${requestId}] ========== DELETE USER REQUEST START ==========`);
    console.log(`🗑️ [${requestId}] Request method:`, req.method);
    console.log(`🗑️ [${requestId}] Request URL:`, req.url);
    console.log(`🗑️ [${requestId}] Request query:`, req.query);
    
    const { userId } = req.query;
    
    if (!userId) {
      console.error(`❌ [${requestId}] Missing userId in query parameters`);
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        requestId
      });
    }

    console.log(`🗑️ [${requestId}] Step 1: Validating user ID:`, userId);

    const supabase = getSupabase();
    console.log(`✅ [${requestId}] Supabase client created`);
    console.log(`🗑️ [${requestId}] Step 2: Attempting to delete user from auth.users...`);

    // Check if admin API is available
    if (!supabase.auth.admin) {
      console.error(`❌ [${requestId}] supabase.auth.admin is not available`);
      return res.status(500).json({
        success: false,
        error: 'Admin API not available. Make sure you are using the service role key.',
        requestId
      });
    }

    // First, get user info for logging
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
    
    if (getUserError) {
      console.error(`❌ [${requestId}] Error fetching user:`, getUserError);
      // User might not exist, but we'll still try to delete
    } else {
      console.log(`🗑️ [${requestId}] User to delete:`, userData.user?.email);
    }

    // Delete user from auth.users (profile will be deleted via CASCADE)
    const { data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error(`❌ [${requestId}] ERROR deleting user:`);
      console.error(`   - Error message:`, deleteError.message);
      console.error(`   - Error status:`, deleteError.status);
      console.error(`   - Full error:`, JSON.stringify(deleteError, null, 2));
      return res.status(400).json({
        success: false,
        error: deleteError.message || 'Failed to delete user',
        requestId,
        details: {
          status: deleteError.status,
          message: deleteError.message,
          error: deleteError
        }
      });
    }

    console.log(`✅ [${requestId}] User deleted from auth.users`);
    console.log(`✅ [${requestId}] ========== DELETE USER REQUEST SUCCESS ==========\n`);
    
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      requestId,
      data: deleteData
    });

  } catch (error) {
    console.error(`❌ [${requestId}] TOP-LEVEL ERROR in deleteUser API:`);
    console.error(`   - Error message:`, error.message);
    console.error(`   - Error name:`, error.name);
    console.error(`   - Error stack:`, error.stack);
    
    try {
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        requestId,
        details: {
          name: error.name,
          message: error.message
        }
      });
    } catch (responseError) {
      console.error(`❌ [${requestId}] Failed to send error response:`, responseError);
      return res.status(500).end('Internal server error');
    }
  }
}

