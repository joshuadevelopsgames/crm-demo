import { createClient } from '@supabase/supabase-js';

function getSupabaseService() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getSupabaseAnon() {
  const supabaseUrl = process.env.SUPABASE_URL;
  // Try multiple possible env var names for anon key (case-insensitive check)
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 
                          process.env.supabase_anon_key ||
                          process.env.VITE_SUPABASE_ANON_KEY ||
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Log all environment variables that might be relevant (for debugging)
    const envKeys = Object.keys(process.env).filter(key => 
      key.toLowerCase().includes('supabase') && key.toLowerCase().includes('anon')
    );
    console.error('Missing Supabase anon key. Available env vars:', {
      hasUrl: !!process.env.SUPABASE_URL,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasLowerAnonKey: !!process.env.supabase_anon_key,
      hasViteAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
      hasNextAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      relevantKeys: envKeys
    });
    throw new Error('Missing Supabase anon key for token verification. Add SUPABASE_ANON_KEY (uppercase) to Vercel environment variables.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
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
    'https://crm-demo.vercel.app',
    'https://crm-demo*.vercel.app' // Allow all Vercel preview URLs
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the user from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - No valid token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token using anon key client (service role can't verify user tokens)
    let supabaseAnon;
    try {
      supabaseAnon = getSupabaseAnon();
    } catch (error) {
      console.error('Failed to create anon client:', error);
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: ' + error.message
      });
    }
    
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Token verification error:', {
        error: authError,
        errorMessage: authError?.message,
        errorStatus: authError?.status,
        hasUser: !!user,
        tokenPreview: token.substring(0, 20) + '...'
      });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid token. Please log out and log back in.',
        details: authError?.message
      });
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = getSupabaseService();

    if (req.method === 'GET') {
      // Get user's own profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, return empty profile
          return res.status(200).json({
            success: true,
            data: {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              phone_number: null,
              role: 'user'
            }
          });
        }
        throw error;
      }

      return res.status(200).json({
        success: true,
        data: profile
      });
    }

    if (req.method === 'PUT') {
      // Update user's own profile
      const { full_name, phone_number, avatar_url, notification_preferences } = req.body;

      // Build update object
      const updateData = {
        id: user.id,
        email: user.email,
        updated_at: new Date().toISOString()
      };

      if (full_name !== undefined) {
        updateData.full_name = full_name || null;
      }
      if (phone_number !== undefined) {
        updateData.phone_number = phone_number || null;
      }
      if (avatar_url !== undefined) {
        updateData.avatar_url = avatar_url || null;
      }
      if (notification_preferences !== undefined) {
        updateData.notification_preferences = notification_preferences;
      }

      // Validate that user is only updating their own profile
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .upsert(updateData, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        // If error is about missing notification_preferences column, retry without it
        if (error.message?.includes('notification_preferences') && 
            (error.code === 'PGRST204' || error.message?.includes('schema cache')) &&
            notification_preferences !== undefined) {
          console.warn('notification_preferences column missing, retrying update without it...');
          const retryData = { ...updateData };
          delete retryData.notification_preferences;
          
          const { data: retryProfile, error: retryError } = await supabase
            .from('profiles')
            .upsert(retryData, {
              onConflict: 'id'
            })
            .select()
            .single();
          
          if (retryError) {
            console.error('Error updating profile (retry):', retryError);
            return res.status(500).json({
              success: false,
              error: retryError.message || 'Failed to update profile'
            });
          }
          
          return res.status(200).json({
            success: true,
            data: retryProfile,
            warning: 'notification_preferences column is missing. Other fields updated successfully. Please run add_notification_preferences_to_profiles.sql migration in Supabase SQL Editor to enable notification preferences.'
          });
        }
        
        console.error('Error updating profile:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to update profile',
          code: error.code
        });
      }

      return res.status(200).json({
        success: true,
        data: updatedProfile
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

