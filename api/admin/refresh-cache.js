/**
 * Admin endpoint to manually refresh notification cache
 * Only accessible to admins (system_admin or admin role)
 */

import { createClient } from '@supabase/supabase-js';
import { calculateAtRiskAccounts, calculateNeglectedAccounts } from '../../../src/utils/atRiskCalculator.js';

// Get Supabase service client (for data operations)
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

// Get Supabase anon client (for auth verification)
function getSupabaseAnon() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 
                          process.env.VITE_SUPABASE_ANON_KEY ||
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase anon key for token verification. Add SUPABASE_ANON_KEY to Vercel environment variables.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Check if user is admin
async function isAdmin(userId, supabaseService) {
  if (!userId) return false;
  
  const { data: profile, error } = await supabaseService
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .single();
  
  if (error || !profile) return false;
  
  // System admin email always has admin access
  return profile.role === 'admin' || 
         profile.role === 'system_admin' || 
         profile.email === 'jrsschroeder@gmail.com';
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://lecrm-dev.vercel.app',
    'https://lecrm.vercel.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Get user from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token using anon client (service role can't verify user tokens)
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
      console.error('Token verification error:', authError);
      return res.status(401).json({ success: false, error: 'Unauthorized - Invalid token' });
    }

    // Get service client for data operations
    let supabase;
    try {
      supabase = getSupabaseService();
    } catch (error) {
      console.error('Failed to create service client:', error);
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: ' + error.message
      });
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id, supabase);
    if (!userIsAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden - Admin access required' });
    }

    console.log(`🔄 Admin ${user.email} manually refreshing notification cache...`);

    // 1. Fetch all accounts and estimates
    const [accountsRes, estimatesRes, snoozesRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('archived', false),
      supabase.from('estimates').select('*').eq('archived', false),
      supabase.from('notification_snoozes').select('*')
    ]);
    
    if (accountsRes.error) throw accountsRes.error;
    if (estimatesRes.error) throw estimatesRes.error;
    if (snoozesRes.error) throw snoozesRes.error;
    
    const accounts = accountsRes.data || [];
    const estimates = estimatesRes.data || [];
    const snoozes = snoozesRes.data || [];
    
    console.log(`📊 Fetched ${accounts.length} accounts, ${estimates.length} estimates, ${snoozes.length} snoozes`);
    
    // 2. Calculate at-risk accounts (with renewal detection)
    const { atRiskAccounts, duplicateEstimates } = calculateAtRiskAccounts(accounts, estimates, snoozes);
    
    // 3. Calculate neglected accounts
    const neglectedAccounts = calculateNeglectedAccounts(accounts, snoozes);
    
    console.log(`✅ Calculated ${atRiskAccounts.length} at-risk accounts, ${neglectedAccounts.length} neglected accounts, ${duplicateEstimates.length} duplicate estimate groups`);
    
    // 4. Update cache
    const cacheExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min from now
    
    await Promise.all([
      // At-risk accounts cache
      supabase.from('notification_cache').upsert({
        cache_key: 'at-risk-accounts',
        cache_data: { 
          accounts: atRiskAccounts, 
          updated_at: new Date().toISOString(),
          count: atRiskAccounts.length
        },
        expires_at: cacheExpiry.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'cache_key'
      }),
      
      // Neglected accounts cache
      supabase.from('notification_cache').upsert({
        cache_key: 'neglected-accounts',
        cache_data: { 
          accounts: neglectedAccounts, 
          updated_at: new Date().toISOString(),
          count: neglectedAccounts.length
        },
        expires_at: cacheExpiry.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'cache_key'
      })
    ]);
    
    // 5. Handle duplicate estimates (bad data)
    let duplicateInsertCount = 0;
    if (duplicateEstimates.length > 0) {
      // Check which duplicates are already in the database (unresolved)
      const { data: existingDuplicates } = await supabase
        .from('duplicate_at_risk_estimates')
        .select('account_id')
        .is('resolved_at', null);
      
      const existingAccountIds = new Set((existingDuplicates || []).map(d => d.account_id));
      
      // Only insert new duplicates
      const newDuplicates = duplicateEstimates.filter(dup => !existingAccountIds.has(dup.account_id));
      
      if (newDuplicates.length > 0) {
        const duplicateRecords = newDuplicates.map(dup => ({
          account_id: dup.account_id,
          account_name: dup.account_name,
          division: dup.estimates[0]?.division || null,
          address: dup.estimates[0]?.address || null,
          estimate_ids: dup.estimates.map(e => e.id),
          estimate_numbers: dup.estimates.map(e => e.estimate_number).filter(Boolean),
          contract_ends: dup.estimates.map(e => e.contract_end).filter(Boolean),
          detected_at: new Date().toISOString()
        }));
        
        const { error: insertError } = await supabase
          .from('duplicate_at_risk_estimates')
          .insert(duplicateRecords);
        
        if (insertError) {
          console.error('Error inserting duplicate estimates:', insertError);
        } else {
          duplicateInsertCount = newDuplicates.length;
          console.log(`📝 Inserted ${duplicateInsertCount} new duplicate estimate groups`);
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        atRiskCount: atRiskAccounts.length,
        neglectedCount: neglectedAccounts.length,
        duplicateCount: duplicateEstimates.length,
        duplicateInsertCount
      },
      message: `Cache refreshed successfully. ${atRiskAccounts.length} at-risk accounts, ${neglectedAccounts.length} neglected accounts.`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error refreshing cache:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

