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
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase client-side keys not configured. Using API endpoints instead.');
        return null;
      }
      
      supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
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






