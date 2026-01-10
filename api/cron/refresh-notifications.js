/**
 * Background job to refresh notification cache
 * Runs every 5 minutes via Vercel Cron
 * 
 * Calculates:
 * - At-risk accounts (with renewal detection)
 * - Neglected accounts
 * - Segment downgrades (accounts that moved to lower segments)
 * - Duplicate estimates (bad data)
 * 
 * Updates notification_cache table and creates notifications for duplicates
 */

import { getSupabaseClient } from '../../src/services/supabaseClient.js';

// Dynamic import for server-side compatibility (Vercel serverless functions)
async function getAtRiskCalculator() {
  try {
    const module = await import('../../src/utils/atRiskCalculator.js');
    return {
      calculateAtRiskAccounts: module.calculateAtRiskAccounts,
      calculateNeglectedAccounts: module.calculateNeglectedAccounts,
      calculateSegmentDowngrades: module.calculateSegmentDowngrades
    };
  } catch (error) {
    console.error('Error importing atRiskCalculator:', error);
    throw new Error(`Failed to import atRiskCalculator: ${error.message}`);
  }
}

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
    
    // 1. Fetch all accounts (with pagination)
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
      
      if (error) throw error;
      if (data && data.length > 0) {
        allAccounts = allAccounts.concat(data);
        hasMoreAccounts = data.length === pageSize;
        accountsPage++;
      } else {
        hasMoreAccounts = false;
      }
    }
    
    // 2. Fetch all estimates (with pagination to handle > 1000 rows)
    let allEstimates = [];
    let estimatesPage = 0;
    let hasMoreEstimates = true;
    
    while (hasMoreEstimates) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('archived', false)
        .range(estimatesPage * pageSize, (estimatesPage + 1) * pageSize - 1);
      
      if (error) throw error;
      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        hasMoreEstimates = data.length === pageSize;
        estimatesPage++;
      } else {
        hasMoreEstimates = false;
      }
    }
    
    // 3. Fetch all snoozes
    const { data: snoozes, error: snoozesError } = await supabase
      .from('notification_snoozes')
      .select('*');
    
    if (snoozesError) throw snoozesError;
    
    const accounts = allAccounts;
    const estimates = allEstimates;
    
    console.log(`📊 Fetched ${accounts.length} accounts, ${estimates.length} estimates, ${snoozes.length} snoozes`);
    
    // 2. Import calculator functions (dynamic import for server-side compatibility)
    console.log('📦 Importing calculator functions...');
    const { calculateAtRiskAccounts, calculateNeglectedAccounts, calculateSegmentDowngrades } = await getAtRiskCalculator();
    
    // 3. Calculate at-risk accounts (with renewal detection)
    console.log('🧮 Calculating at-risk accounts...');
    const { atRiskAccounts, duplicateEstimates } = calculateAtRiskAccounts(accounts, estimates, snoozes);
    
    // 4. Calculate neglected accounts
    console.log('🧮 Calculating neglected accounts...');
    const neglectedAccounts = calculateNeglectedAccounts(accounts, snoozes);
    
    // 5. Calculate segment downgrades
    console.log('🧮 Calculating segment downgrades...');
    const segmentDowngrades = calculateSegmentDowngrades(accounts, snoozes);
    
    console.log(`✅ Calculated ${atRiskAccounts.length} at-risk accounts, ${neglectedAccounts.length} neglected accounts, ${segmentDowngrades.length} segment downgrades, ${duplicateEstimates.length} duplicate estimate groups`);
    
    // 6. Update cache
    // Set expiry to 24 hours (effectively never expires since cron refreshes every 5 min)
    const cacheExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
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
      }),
      
      // Segment downgrades cache
      supabase.from('notification_cache').upsert({
        cache_key: 'segment-downgrades',
        cache_data: { 
          accounts: segmentDowngrades, 
          updated_at: new Date().toISOString(),
          count: segmentDowngrades.length
        },
        expires_at: cacheExpiry.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'cache_key'
      })
    ]);
    
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
      
      // Create notifications for new duplicates
      if (newDuplicates.length > 0) {
        await createDuplicateEstimateNotifications(newDuplicates, supabase);
      }
    }
    
    // 5. Create notifications for contract date typos
    console.log('🔍 Checking for contract date typos...');
    try {
      const { createContractTypoNotifications } = await import('../../src/services/notificationService.js');
      await createContractTypoNotifications(allEstimates, supabase);
    } catch (error) {
      console.error('Error creating contract typo notifications:', error);
      // Don't fail the whole request if this fails
    }
    
    // 6. Create notifications for segment downgrades
    console.log('🔍 Creating segment downgrade notifications...');
    try {
      const { createSegmentDowngradeNotifications } = await import('../../src/services/notificationService.js');
      await createSegmentDowngradeNotifications(segmentDowngrades, supabase);
    } catch (error) {
      console.error('Error creating segment downgrade notifications:', error);
      // Don't fail the whole request if this fails
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

