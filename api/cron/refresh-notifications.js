/**
 * Background job to refresh notification cache
 * Runs every 5 minutes via Vercel Cron
 * 
 * Calculates:
 * - At-risk accounts (with renewal detection)
 * - Neglected accounts
 * - Duplicate estimates (bad data)
 * 
 * Updates notification_cache table and creates notifications for duplicates
 */

import { getSupabaseClient } from '../../src/services/supabaseClient.js';
import { calculateAtRiskAccounts, calculateNeglectedAccounts } from '../../src/utils/atRiskCalculator.js';

export default async function handler(req, res) {
  // Verify cron request is authorized
  // Vercel automatically adds CRON_SECRET to the Authorization header as "Bearer ${CRON_SECRET}"
  // This is the security mechanism recommended by Vercel
  const expectedSecret = process.env.CRON_SECRET;
  
  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable not set');
    return res.status(500).json({ error: 'Cron secret not configured' });
  }
  
  // Check Authorization header (Vercel sends: "Bearer ${CRON_SECRET}")
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron request - invalid Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const supabase = getSupabaseClient();
  
  try {
    console.log('🔄 Starting notification cache refresh...');
    
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
      
      // Create notifications for new duplicates
      if (newDuplicates.length > 0) {
        await createDuplicateEstimateNotifications(newDuplicates, supabase);
      }
    }
    
    // Supabase Realtime automatically broadcasts cache updates
    
    return res.status(200).json({
      success: true,
      data: {
        atRiskCount: atRiskAccounts.length,
        neglectedCount: neglectedAccounts.length,
        duplicateCount: duplicateEstimates.length,
        duplicateInsertCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error refreshing notifications:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Create notifications for duplicate at-risk estimates (bad data)
 */
async function createDuplicateEstimateNotifications(duplicates, supabase) {
  try {
    // Get all users
    const { data: users } = await supabase.from('profiles').select('id');
    if (!users || users.length === 0) {
      console.log('No users found for duplicate notifications');
      return;
    }
    
    const notifications = [];
    const now = new Date().toISOString();
    
    for (const dup of duplicates) {
      for (const user of users) {
        // Check if notification already exists (unread)
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'duplicate_at_risk_estimates')
          .eq('related_account_id', dup.account_id)
          .eq('is_read', false)
          .maybeSingle();
        
        if (existing) continue; // Already notified
        
        notifications.push({
          user_id: user.id,
          type: 'duplicate_at_risk_estimates',
          title: 'Duplicate At-Risk Estimates Detected',
          message: `Account "${dup.account_name}" has ${dup.estimates.length} at-risk estimates with the same department and address. Please review.`,
          related_account_id: dup.account_id,
          metadata: JSON.stringify({
            estimate_ids: dup.estimates.map(e => e.id),
            estimate_numbers: dup.estimates.map(e => e.estimate_number),
            division: dup.estimates[0]?.division,
            address: dup.estimates[0]?.address
          }),
          is_read: false,
          created_at: now
        });
      }
    }
    
    if (notifications.length > 0) {
      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) {
        console.error('Error creating duplicate estimate notifications:', error);
      } else {
        console.log(`🔔 Created ${notifications.length} duplicate estimate notifications`);
      }
    }
  } catch (error) {
    console.error('Error in createDuplicateEstimateNotifications:', error);
  }
}

