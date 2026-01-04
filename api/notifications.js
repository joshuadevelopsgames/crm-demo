/**
 * Unified Notification API Endpoint
 * 
 * Provides a single endpoint for all notification types:
 * - at-risk-accounts: Cached at-risk accounts (from notification_cache)
 * - neglected-accounts: Cached neglected accounts (from notification_cache)
 * - duplicate-estimates: Duplicate at-risk estimates (bad data)
 * - all: Combined notifications for a user
 * 
 * Query params:
 * - user_id (required for 'all' type)
 * - type (optional: 'at-risk-accounts', 'neglected-accounts', 'duplicate-estimates', 'all')
 */

import { getSupabaseClient } from '../src/services/supabaseClient.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const supabase = getSupabaseClient();
    const { user_id, type } = req.query;
    
    if (type === 'at-risk-accounts') {
      // Return cached at-risk accounts
      const { data: cache, error } = await supabase
        .from('notification_cache')
        .select('*')
        .eq('cache_key', 'at-risk-accounts')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching at-risk accounts cache:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      if (!cache || new Date(cache.expires_at) < new Date()) {
        // Cache expired or missing - return empty (background job should refresh)
        return res.json({ 
          success: true, 
          data: [], 
          stale: true,
          message: 'Cache expired or missing. Background job will refresh shortly.'
        });
      }
      
      return res.json({ 
        success: true, 
        data: cache.cache_data?.accounts || [],
        updated_at: cache.updated_at
      });
    }
    
    if (type === 'neglected-accounts') {
      // Return cached neglected accounts
      const { data: cache, error } = await supabase
        .from('notification_cache')
        .select('*')
        .eq('cache_key', 'neglected-accounts')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching neglected accounts cache:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      if (!cache || new Date(cache.expires_at) < new Date()) {
        // Cache expired or missing
        return res.json({ 
          success: true, 
          data: [], 
          stale: true,
          message: 'Cache expired or missing. Background job will refresh shortly.'
        });
      }
      
      return res.json({ 
        success: true, 
        data: cache.cache_data?.accounts || [],
        updated_at: cache.updated_at
      });
    }
    
    if (type === 'duplicate-estimates') {
      // Get unresolved duplicate estimates
      const { data: duplicates, error } = await supabase
        .from('duplicate_at_risk_estimates')
        .select('*')
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching duplicate estimates:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      return res.json({ success: true, data: duplicates || [] });
    }
    
    if (type === 'all' || !type) {
      // Return all notifications for user
      if (!user_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'user_id query parameter is required for type=all' 
        });
      }
      
      // Fetch all notification sources in parallel
      const [
        atRiskCache,
        neglectedCache,
        taskNotifs,
        systemNotifs,
        duplicates
      ] = await Promise.all([
        // At-risk accounts (cached)
        supabase.from('notification_cache')
          .select('*')
          .eq('cache_key', 'at-risk-accounts')
          .single(),
        
        // Neglected accounts (cached)
        supabase.from('notification_cache')
          .select('*')
          .eq('cache_key', 'neglected-accounts')
          .single(),
        
        // Task notifications (individual rows)
        supabase.from('notifications')
          .select('*')
          .eq('user_id', user_id)
          .in('type', ['task_assigned', 'task_overdue', 'task_due_today', 'task_reminder'])
          .order('created_at', { ascending: false }),
        
        // System notifications (individual rows)
        supabase.from('notifications')
          .select('*')
          .eq('user_id', user_id)
          .in('type', ['bug_report', 'end_of_year_analysis', 'duplicate_at_risk_estimates'])
          .order('created_at', { ascending: false }),
        
        // Duplicate estimates (unresolved)
        supabase.from('duplicate_at_risk_estimates')
          .select('*')
          .is('resolved_at', null)
          .order('detected_at', { ascending: false })
      ]);
      
      // Extract data from cache results
      const atRiskAccounts = atRiskCache.data && new Date(atRiskCache.data.expires_at) >= new Date()
        ? (atRiskCache.data.cache_data?.accounts || [])
        : [];
      
      const neglectedAccounts = neglectedCache.data && new Date(neglectedCache.data.expires_at) >= new Date()
        ? (neglectedCache.data.cache_data?.accounts || [])
        : [];
      
      return res.json({
        success: true,
        data: {
          atRiskAccounts,
          neglectedAccounts,
          taskNotifications: taskNotifs.data || [],
          systemNotifications: systemNotifs.data || [],
          duplicateEstimates: duplicates.data || []
        },
        cache: {
          atRiskStale: !atRiskCache.data || new Date(atRiskCache.data.expires_at) < new Date(),
          neglectedStale: !neglectedCache.data || new Date(neglectedCache.data.expires_at) < new Date()
        }
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid type parameter. Use: at-risk-accounts, neglected-accounts, duplicate-estimates, or all' 
    });
    
  } catch (error) {
    console.error('Error in notifications API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

