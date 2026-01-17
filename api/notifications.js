/**
 * Unified Notification API Endpoint
 * 
 * Provides a single endpoint for all notification types:
 * - at-risk-accounts: Cached at-risk accounts (from notification_cache)
 * - neglected-accounts: Cached neglected accounts (from notification_cache)
 * - segment-downgrades: Cached accounts with downgraded segments (from notification_cache)
 * - duplicate-estimates: Duplicate at-risk estimates (bad data)
 * - all: Combined notifications for a user
 * 
 * Query params:
 * - user_id (required for 'all' type)
 * - type (optional: 'at-risk-accounts', 'neglected-accounts', 'segment-downgrades', 'duplicate-estimates', 'all')
 */

import { getSupabaseClient } from '../src/services/supabaseClient.js';

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app'
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/notifications.js:42',message:'API handler entry',data:{method:req.method,type:req.query?.type,hasUserId:!!req.query?.user_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (clientError) {
      console.error('Error creating Supabase client:', clientError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to initialize database connection',
        details: clientError.message
      });
    }
    
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        error: 'Supabase client is null. Check environment variables.'
      });
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/notifications.js:45',message:'Supabase client created',data:{hasClient:!!supabase,hasUrl:!!process.env.SUPABASE_URL,hasKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const { user_id, type } = req.query;
    
    if (type === 'at-risk-accounts') {
      // Return cached at-risk accounts
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/notifications.js:50',message:'Querying notification_cache',data:{cache_key:'at-risk-accounts'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const { data: cache, error } = await supabase
        .from('notification_cache')
        .select('*')
        .eq('cache_key', 'at-risk-accounts')
        .single();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/notifications.js:58',message:'Cache query result',data:{hasError:!!error,errorCode:error?.code,errorMessage:error?.message,hasData:!!cache,hasExpiresAt:!!cache?.expires_at},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (error) {
        // If table doesn't exist (PGRST116 = no rows, but other codes might indicate missing table)
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist') || error.code === 'PGRST204') {
          // Table doesn't exist or cache is empty - return empty array
          console.warn('notification_cache table not found or empty, returning empty array');
          return res.json({ 
            success: true, 
            data: [], 
            stale: true,
            message: 'Cache not available. Background job will create it shortly.'
          });
        }
        console.error('Error fetching at-risk accounts cache:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return res.status(500).json({ 
          success: false, 
          error: error.message || 'Failed to fetch at-risk accounts cache',
          code: error.code
        });
      }
      
      if (!cache) {
        // Cache missing - return empty
        return res.json({ 
          success: true, 
          data: [], 
          stale: true,
          message: 'Cache not available. Background job will create it shortly.'
        });
      }
      
      // If cache exists but is expired, still return it (stale data is better than no data)
      // The cron job will refresh it, but we don't want to show empty lists
      const isExpired = new Date(cache.expires_at) < new Date();
      if (isExpired) {
        console.warn('⚠️ Cache expired but returning stale data:', cache.cache_key);
      }
      
      return res.json({ 
        success: true, 
        data: cache.cache_data?.accounts || [],
        updated_at: cache.updated_at,
        stale: isExpired
      });
    }
    
    if (type === 'neglected-accounts') {
      // Return cached neglected accounts
      const { data: cache, error } = await supabase
        .from('notification_cache')
        .select('*')
        .eq('cache_key', 'neglected-accounts')
        .single();
      
      if (error) {
        // If table doesn't exist
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('notification_cache table not found or empty, returning empty array');
          return res.json({ 
            success: true, 
            data: [], 
            stale: true,
            message: 'Cache not available. Background job will create it shortly.'
          });
        }
        console.error('Error fetching neglected accounts cache:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      if (!cache) {
        // Cache missing - return empty
        return res.json({ 
          success: true, 
          data: [], 
          stale: true,
          message: 'Cache not available. Background job will create it shortly.'
        });
      }
      
      // If cache exists but is expired, still return it (stale data is better than no data)
      // The cron job will refresh it, but we don't want to show empty lists
      const isExpired = new Date(cache.expires_at) < new Date();
      if (isExpired) {
        console.warn('⚠️ Cache expired but returning stale data:', cache.cache_key);
      }
      
      return res.json({ 
        success: true, 
        data: cache.cache_data?.accounts || [],
        updated_at: cache.updated_at,
        stale: isExpired
      });
    }
    
    if (type === 'segment-downgrades') {
      // Return cached segment downgrades
      const { data: cache, error } = await supabase
        .from('notification_cache')
        .select('*')
        .eq('cache_key', 'segment-downgrades')
        .single();
      
      if (error) {
        // If table doesn't exist
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('notification_cache table not found or empty, returning empty array');
          return res.json({ 
            success: true, 
            data: [], 
            stale: true,
            message: 'Cache not available. Background job will create it shortly.'
          });
        }
        console.error('Error fetching segment downgrades cache:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      if (!cache) {
        // Cache missing - return empty
        return res.json({ 
          success: true, 
          data: [], 
          stale: true,
          message: 'Cache not available. Background job will create it shortly.'
        });
      }
      
      // If cache exists but is expired, still return it (stale data is better than no data)
      const isExpired = new Date(cache.expires_at) < new Date();
      if (isExpired) {
        console.warn('⚠️ Cache expired but returning stale data:', cache.cache_key);
      }
      
      return res.json({ 
        success: true, 
        data: cache.cache_data?.accounts || [],
        updated_at: cache.updated_at,
        stale: isExpired
      });
    }
    
    if (type === 'duplicate-estimates') {
      // Get unresolved duplicate estimates
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/notifications.js:108',message:'Querying duplicate_at_risk_estimates',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const { data: duplicates, error } = await supabase
        .from('duplicate_at_risk_estimates')
        .select('*')
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/notifications.js:116',message:'Duplicate estimates query result',data:{hasError:!!error,errorCode:error?.code,errorMessage:error?.message,hasData:!!duplicates,dataLength:duplicates?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (error) {
        // If table doesn't exist
        if (error.message?.includes('relation') || error.message?.includes('does not exist') || error.code === 'PGRST204' || error.code === 'PGRST116') {
          console.warn('duplicate_at_risk_estimates table not found or empty, returning empty array');
          return res.json({ success: true, data: [] });
        }
        console.error('Error fetching duplicate estimates:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return res.status(500).json({ 
          success: false, 
          error: error.message || 'Failed to fetch duplicate estimates',
          code: error.code
        });
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
        segmentDowngradesCache,
        taskNotifs,
        systemNotifs,
        ticketNotifs,
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
        
        // Segment downgrades (cached)
        supabase.from('notification_cache')
          .select('*')
          .eq('cache_key', 'segment-downgrades')
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
          .in('type', ['bug_report', 'end_of_year_analysis', 'duplicate_at_risk_estimates', 'contract_date_typo'])
          .order('created_at', { ascending: false }),
        
        // Ticket notifications (individual rows)
        supabase.from('notifications')
          .select('*')
          .eq('user_id', user_id)
          .in('type', ['ticket_opened', 'ticket_comment', 'ticket_status_change', 'ticket_assigned', 'ticket_archived'])
          .order('created_at', { ascending: false }),
        
        // Duplicate estimates (unresolved)
        supabase.from('duplicate_at_risk_estimates')
          .select('*')
          .is('resolved_at', null)
          .order('detected_at', { ascending: false })
      ]);
      
      // Extract data from cache results
      // Return stale data if cache exists but is expired (better than empty)
      // This matches the behavior of individual cache endpoints
      const atRiskAccounts = atRiskCache.data
        ? (atRiskCache.data.cache_data?.accounts || [])
        : [];
      
      const neglectedAccounts = neglectedCache.data
        ? (neglectedCache.data.cache_data?.accounts || [])
        : [];
      
      const segmentDowngrades = segmentDowngradesCache.data
        ? (segmentDowngradesCache.data.cache_data?.accounts || [])
        : [];
      
      // Check if caches are stale (expired but still returned)
      const atRiskStale = !atRiskCache.data || new Date(atRiskCache.data.expires_at) < new Date();
      const neglectedStale = !neglectedCache.data || new Date(neglectedCache.data.expires_at) < new Date();
      const segmentDowngradesStale = !segmentDowngradesCache.data || new Date(segmentDowngradesCache.data.expires_at) < new Date();
      
      // Include contract date typo notifications in system notifications
      const systemNotificationsWithTypos = (systemNotifs.data || []).concat(
        // Contract date typo notifications are already included in systemNotifs query above
        []
      );
      
      return res.json({
        success: true,
        data: {
          atRiskAccounts,
          neglectedAccounts,
          segmentDowngrades,
          taskNotifications: taskNotifs.data || [],
          systemNotifications: systemNotificationsWithTypos,
          ticketNotifications: ticketNotifs.data || [],
          duplicateEstimates: duplicates.data || []
        },
        cache: {
          atRiskStale: !atRiskCache.data || new Date(atRiskCache.data.expires_at) < new Date(),
          neglectedStale: !neglectedCache.data || new Date(neglectedCache.data.expires_at) < new Date(),
          segmentDowngradesStale: !segmentDowngradesCache.data || new Date(segmentDowngradesCache.data.expires_at) < new Date()
        }
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid type parameter. Use: at-risk-accounts, neglected-accounts, segment-downgrades, duplicate-estimates, or all' 
    });
    
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/notifications.js:202',message:'API handler error',data:{errorMessage:error?.message,errorStack:error?.stack?.substring(0,200),errorName:error?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('Error in notifications API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

