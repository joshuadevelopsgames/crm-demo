/**
 * Admin endpoint to manually refresh notification cache
 * Only accessible to admins (system_admin or admin role)
 */

import { createClient } from '@supabase/supabase-js';

// Dynamic import for server-side compatibility (Vercel serverless functions)
async function getAtRiskCalculator() {
  try {
    const module = await import('../../src/utils/atRiskCalculator.js');
    return {
      calculateAtRiskAccounts: module.calculateAtRiskAccounts,
      calculateNeglectedAccounts: module.calculateNeglectedAccounts
    };
  } catch (error) {
    console.error('Error importing atRiskCalculator:', error);
    throw new Error(`Failed to import atRiskCalculator: ${error.message}`);
  }
}

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
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
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

    // 1. Fetch all accounts (with pagination)
    console.log('📥 Fetching accounts from Supabase...');
    let allAccounts = [];
    let accountsPage = 0;
    const pageSize = 1000;
    let hasMoreAccounts = true;
    
    while (hasMoreAccounts) {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('archived', false)
        .range(accountsPage * pageSize, (accountsPage + 1) * pageSize - 1);
      
      if (error) {
        console.error('❌ Error fetching accounts:', error);
        throw new Error(`Failed to fetch accounts: ${error.message}`);
      }
      if (data && data.length > 0) {
        allAccounts = allAccounts.concat(data);
        hasMoreAccounts = data.length === pageSize;
        accountsPage++;
      } else {
        hasMoreAccounts = false;
      }
    }
    
    // 2. Fetch all estimates (with pagination to handle > 1000 rows)
    console.log('📥 Fetching estimates from Supabase...');
    let allEstimates = [];
    let estimatesPage = 0;
    let hasMoreEstimates = true;
    
    while (hasMoreEstimates) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('archived', false)
        .range(estimatesPage * pageSize, (estimatesPage + 1) * pageSize - 1);
      
      if (error) {
        console.error('❌ Error fetching estimates:', error);
        throw new Error(`Failed to fetch estimates: ${error.message}`);
      }
      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        hasMoreEstimates = data.length === pageSize;
        estimatesPage++;
      } else {
        hasMoreEstimates = false;
      }
    }
    
    // 3. Fetch all snoozes
    console.log('📥 Fetching snoozes from Supabase...');
    const { data: snoozes, error: snoozesError } = await supabase
      .from('notification_snoozes')
      .select('*');
    
    if (snoozesError) {
      console.error('❌ Error fetching snoozes:', snoozesError);
      throw new Error(`Failed to fetch snoozes: ${snoozesError.message}`);
    }
    
    const accounts = allAccounts;
    const estimates = allEstimates;
    
    console.log(`📊 Fetched ${accounts.length} accounts, ${estimates.length} estimates, ${snoozes.length} snoozes`);
    
    // 2. Import calculator functions (dynamic import for server-side compatibility)
    console.log('📦 Importing calculator functions...');
    const { calculateAtRiskAccounts, calculateNeglectedAccounts } = await getAtRiskCalculator();
    
    // 3. Calculate at-risk accounts (with renewal detection)
    console.log('🧮 Calculating at-risk accounts...');
    let atRiskAccounts, duplicateEstimates;
    try {
      const result = calculateAtRiskAccounts(accounts, estimates, snoozes);
      atRiskAccounts = result.atRiskAccounts;
      duplicateEstimates = result.duplicateEstimates;
    } catch (calcError) {
      console.error('❌ Error calculating at-risk accounts:', calcError);
      throw new Error(`Failed to calculate at-risk accounts: ${calcError.message}`);
    }
    
    // 4. Calculate neglected accounts
    console.log('🧮 Calculating neglected accounts...');
    let neglectedAccounts;
    try {
      neglectedAccounts = calculateNeglectedAccounts(accounts, snoozes);
    } catch (calcError) {
      console.error('❌ Error calculating neglected accounts:', calcError);
      throw new Error(`Failed to calculate neglected accounts: ${calcError.message}`);
    }
    
    console.log(`✅ Calculated ${atRiskAccounts.length} at-risk accounts, ${neglectedAccounts.length} neglected accounts, ${duplicateEstimates.length} duplicate estimate groups`);
    
    // 5. Update cache
    console.log('💾 Updating notification cache...');
    // Set expiry to 24 hours (effectively never expires since cron refreshes every 5 min)
    const cacheExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const [atRiskCacheRes, neglectedCacheRes] = await Promise.all([
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
    
    if (atRiskCacheRes.error) {
      console.error('❌ Error updating at-risk cache:', atRiskCacheRes.error);
      throw new Error(`Failed to update at-risk cache: ${atRiskCacheRes.error.message}`);
    }
    if (neglectedCacheRes.error) {
      console.error('❌ Error updating neglected cache:', neglectedCacheRes.error);
      throw new Error(`Failed to update neglected cache: ${neglectedCacheRes.error.message}`);
    }
    
    console.log('✅ Cache updated successfully');
    
    // 6. Handle duplicate estimates (bad data)
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
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause
    });
    return res.status(500).json({ 
      success: false,
      error: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

