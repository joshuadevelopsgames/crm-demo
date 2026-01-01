/**
 * Supabase Client
 * Connects to your Supabase database and handles authentication
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// For client-side usage (with auth)
let supabaseClient = null;

// For server-side usage (in API routes)
export function getSupabaseClient() {
  // Check if we're in a server environment (Vercel function)
  if (typeof window === 'undefined') {
    // Server-side: Use service role key for admin access
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
    }
    
    return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } else {
    // Client-side: Use anon key with auth support
    if (!supabaseClient) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Decode JWT to verify project ID matches URL
      let projectIdFromKey = null;
      let projectIdFromUrl = null;
      
      if (supabaseUrl) {
        const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
        projectIdFromUrl = urlMatch ? urlMatch[1] : null;
      }
      
      if (supabaseAnonKey) {
        try {
          // Decode JWT payload (second part, base64)
          const parts = supabaseAnonKey.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            projectIdFromKey = payload.ref || null;
          }
        } catch (e) {
          console.warn('Could not decode anon key:', e);
        }
      }
      
      console.log('🔧 Supabase client initialization:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
        urlLength: supabaseUrl?.length || 0,
        keyLength: supabaseAnonKey?.length || 0,
        urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing',
        keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : 'missing',
        projectIdFromUrl: projectIdFromUrl,
        projectIdFromKey: projectIdFromKey,
        keysMatch: projectIdFromUrl === projectIdFromKey
      });
      
      if (projectIdFromUrl && projectIdFromKey && projectIdFromUrl !== projectIdFromKey) {
        console.error('❌ PROJECT ID MISMATCH!', {
          urlProjectId: projectIdFromUrl,
          keyProjectId: projectIdFromKey,
          message: 'The URL and anon key are from different Supabase projects!'
        });
      }
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️ Supabase client-side keys not configured. Using API endpoints instead.');
        console.warn('⚠️ Missing:', {
          url: !supabaseUrl,
          key: !supabaseAnonKey
        });
        return null;
      }
      
      console.log('✅ Creating Supabase client with provided keys');
      supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      console.log('✅ Supabase client created successfully');
    }
    
    return supabaseClient;
  }
}

// Helper to check if Supabase is configured
export function isSupabaseConfigured() {
  if (typeof window === 'undefined') {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  } else {
    return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  }
}

// Get the client-side Supabase instance (for auth)
export function getSupabaseAuth() {
  if (typeof window === 'undefined') {
    return null;
  }
  return getSupabaseClient();
}






