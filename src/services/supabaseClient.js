/**
 * Supabase Client
 * Connects to your Supabase database
 */

// For client-side usage (if needed)
let supabaseClient = null;

// For server-side usage (in API routes)
export function getSupabaseClient() {
  // Check if we're in a server environment (Vercel function)
  if (typeof window === 'undefined') {
    // Server-side: Use service role key for admin access
    const { createClient } = require('@supabase/supabase-js');
    
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
  } else {
    // Client-side: Use anon key (read-only, with RLS policies)
    if (!supabaseClient) {
      const { createClient } = require('@supabase/supabase-js');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase client-side keys not configured. Using API endpoints instead.');
        return null;
      }
      
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
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



