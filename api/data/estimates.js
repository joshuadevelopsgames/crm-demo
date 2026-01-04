/**
 * API endpoint for storing and retrieving estimates
 * Data is stored in Supabase database
 */

import { createClient } from '@supabase/supabase-js';

// Import at-risk calculator (using dynamic import for server-side compatibility)
async function calculateAtRiskAccountsForImport(accounts, estimates, snoozes) {
  try {
    // Dynamic import for server-side compatibility
    const { calculateAtRiskAccounts } = await import('../../src/utils/atRiskCalculator.js');
    return calculateAtRiskAccounts(accounts, estimates, snoozes);
  } catch (error) {
    console.error('Error importing atRiskCalculator:', error);
    // Fallback: return empty duplicates if import fails
    return { atRiskAccounts: [], duplicateEstimates: [] };
  }
}

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export default async function handler(req, res) {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      // Support filtering by account_id via query parameter
      const accountId = req.query.account_id;

      // Fetch estimates using pagination to bypass Supabase's 1000 row limit
      let allEstimates = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      // For import validation, only fetch fields needed for comparison to reduce response size
      // This prevents hitting Vercel's 4.5MB response limit
      // Fields needed: id for matching, plus all fields used in findEstimateDifferences
      // CRITICAL: Must include account_id for renewal date calculations (at-risk accounts)
      const fields = accountId ? '*' : 'id, lmn_estimate_id, estimate_number, estimate_type, estimate_date, contract_start, contract_end, total_price, total_price_with_tax, status, division, project_name, account_id';

      while (hasMore) {
        let query = supabase
          .from('estimates')
          .select(fields)
          // Order by id as fallback to ensure consistent ordering and include NULL created_at records
          .order('id', { ascending: true });
        
        // Filter by account_id if provided (server-side filtering for accuracy)
        if (accountId) {
          query = query.eq('account_id', accountId);
        }
        
        const { data, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        if (data && data.length > 0) {
          allEstimates = allEstimates.concat(data);
          hasMore = data.length === pageSize;
          page++;
          console.log(`📄 Estimates page ${page}: Fetched ${data.length} estimates (total so far: ${allEstimates.length})`);
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Finished fetching estimates. Total: ${allEstimates.length}`);
      
      // Log response size estimate
      const responseSize = JSON.stringify(allEstimates).length;
      const responseSizeMB = (responseSize / 1024 / 1024).toFixed(2);
      console.log(`📊 Estimates response size: ${responseSizeMB} MB (${responseSize} bytes)`);
      
      // Vercel has a 4.5MB response limit, warn if approaching
      if (responseSize > 4 * 1024 * 1024) {
        console.warn(`⚠️ Estimates response size (${responseSizeMB} MB) is approaching Vercel's 4.5MB limit`);
      }
      
      return res.status(200).json({
        success: true,
        data: allEstimates,
        count: allEstimates.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'upsert') {
        const { estimate, lookupField = 'lmn_estimate_id' } = data;
        
        const { data: existing, error: findError } = await supabase
          .from('estimates')
          .select('*')
          .eq(lookupField, estimate[lookupField])
          .single();
        
        if (findError && findError.code !== 'PGRST116') {
          throw findError;
        }
        
        // Use the imported ID directly (e.g., from import)
        // Also remove internal tracking fields and fields that don't exist in the schema
        // NOTE: The spread operator preserves ALL fields including dates - matching dev version approach
        const { id, account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutId } = estimate;
        const estimateData = {
          ...estimateWithoutId,
          updated_at: new Date().toISOString()
        };
        
        // Include account_id if provided (should be text like "lmn-account-XXXXX")
        if (account_id) {
          estimateData.account_id = account_id;
        } else {
          estimateData.account_id = null;
        }
        
        // Include contact_id if provided (should be text like "lmn-contact-XXXXX")
        if (contact_id) {
          estimateData.contact_id = contact_id;
        } else {
          estimateData.contact_id = null;
        }
        
        // Include id if provided (should be from import)
        if (id) {
          estimateData.id = id;
        }
        
        if (existing) {
          const { data: updated, error: updateError } = await supabase
            .from('estimates')
            .update(estimateData)
            .eq('id', existing.id)
            .select()
            .single();
          
          if (updateError) throw updateError;
          
          return res.status(200).json({
            success: true,
            data: updated,
            action: 'updated'
          });
        } else {
          estimateData.created_at = new Date().toISOString();
          const { data: created, error: createError } = await supabase
            .from('estimates')
            .insert(estimateData)
            .select()
            .single();
          
          if (createError) throw createError;
          
          return res.status(201).json({
            success: true,
            data: created,
            action: 'created'
          });
        }
      }
      
      if (action === 'bulk_upsert') {
        // IMPORTANT: We use ID-based matching (lmn_estimate_id) ONLY, never name/number matching
        // IDs are immutable and reliable, while estimate numbers/names can change
        const { estimates, lookupField = 'lmn_estimate_id' } = data;
        let created = 0;
        let updated = 0;
        
        // Use smaller batch size for estimates due to larger payload size
        const BATCH_SIZE = 50;
        for (let i = 0; i < estimates.length; i += BATCH_SIZE) {
          const batch = estimates.slice(i, i + BATCH_SIZE);
          
          const lookupValues = batch.map(e => e[lookupField]).filter(Boolean);
          const { data: existingEstimates } = await supabase
            .from('estimates')
            .select(`id, ${lookupField}`)
            .in(lookupField, lookupValues);
          
          const existingMap = new Map();
          existingEstimates?.forEach(est => {
            if (est[lookupField]) {
              existingMap.set(est[lookupField], est.id);
            }
          });
          
          // Get all account IDs that exist in the database to validate references
          const accountIdsInBatch = batch.map(e => e.account_id).filter(Boolean);
          const { data: existingAccounts } = await supabase
            .from('accounts')
            .select('id')
            .in('id', accountIdsInBatch);
          
          const validAccountIds = new Set(existingAccounts?.map(a => a.id) || []);
          
          // Get all contact IDs that exist in the database to validate references
          const contactIdsInBatch = batch.map(e => e.contact_id).filter(Boolean);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('id')
            .in('id', contactIdsInBatch);
          
          const validContactIds = new Set(existingContacts?.map(c => c.id) || []);
          
          const toInsert = [];
          const toUpdate = [];
          const seenInBatch = new Set(); // Track duplicates within batch
          
          batch.forEach(estimate => {
            const lookupValue = estimate[lookupField];
            
            // Skip if no lookup value (can't match duplicates)
            if (!lookupValue) {
              console.warn(`Skipping estimate without ${lookupField}:`, estimate.estimate_number || estimate.id);
              return;
            }
            
            // Skip if we've already seen this lookup value in this batch (duplicate in same batch)
            if (seenInBatch.has(lookupValue)) {
              console.warn(`Skipping duplicate ${lookupField} in batch:`, lookupValue);
              return;
            }
            seenInBatch.add(lookupValue);
            
            // Debug: Log contract_end for first few estimates to diagnose missing dates
            if (seenInBatch.size <= 5) {
              console.log(`🔍 API: Sample estimate ${lookupValue} (INCOMING):`, {
                status: estimate.status,
                hasContractEnd: !!estimate.contract_end,
                contractEnd: estimate.contract_end,
                contractEndType: typeof estimate.contract_end,
                contractEndIsNull: estimate.contract_end === null,
                contractEndIsUndefined: estimate.contract_end === undefined,
                hasContractStart: !!estimate.contract_start,
                contractStart: estimate.contract_start,
                account_id: estimate.account_id,
                allKeys: Object.keys(estimate).filter(k => k.includes('contract') || k.includes('date'))
              });
            }
            
            // Remove id if it's not a valid UUID - let Supabase generate it
            // Also remove internal tracking fields and fields that don't exist in the schema
            // NOTE: The spread operator preserves ALL fields including dates, lmn_estimate_id, estimate_number - matching dev version
            const { id, account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutIds } = estimate;
            const estimateData = {
              ...estimateWithoutIds,
              updated_at: new Date().toISOString()
            };
            
            // Include id if provided (should be from import)
            if (id) {
              estimateData.id = id;
            }
            
            // Include account_id if provided AND the account exists in the database
            // If account doesn't exist, set to null to avoid foreign key constraint violation
            if (account_id && validAccountIds.has(account_id)) {
              estimateData.account_id = account_id;
            } else {
              if (account_id && !validAccountIds.has(account_id)) {
                console.warn(`Estimate ${estimate.lmn_estimate_id || estimate.id} references non-existent account ${account_id}, setting to null`);
              }
              estimateData.account_id = null;
            }
            
            // Include contact_id if provided AND the contact exists in the database
            // If contact doesn't exist, set to null to avoid foreign key constraint violation
            if (contact_id && validContactIds.has(contact_id)) {
              estimateData.contact_id = contact_id;
            } else {
              if (contact_id && !validContactIds.has(contact_id)) {
                console.warn(`Estimate ${estimate.lmn_estimate_id || estimate.id} references non-existent contact ${contact_id}, setting to null`);
              }
              estimateData.contact_id = null;
            }
            
            // NOTE: Date fields (estimate_date, estimate_close_date, contract_start, contract_end) are preserved
            // by the spread operator above - no need to explicitly preserve them
            // The dev version works this way and dates are saved correctly
            
            if (existingMap.has(lookupValue)) {
              toUpdate.push({ id: existingMap.get(lookupValue), data: estimateData });
            } else {
              estimateData.created_at = new Date().toISOString();
              toInsert.push(estimateData);
            }
          });
          
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('estimates')
              .insert(toInsert);
            
            if (insertError) {
              // Handle unique constraint violations gracefully
              if (insertError.code === '23505') { // Unique violation
                console.warn('Unique constraint violation - some estimates may already exist:', insertError.message);
                // Try to insert one by one to identify which ones failed
                let successCount = 0;
                for (const estimateData of toInsert) {
                  try {
                    const { error: singleError } = await supabase
                      .from('estimates')
                      .insert(estimateData);
                    if (!singleError) successCount++;
                  } catch (e) {
                    // Skip duplicates
                  }
                }
                created += successCount;
              } else {
                console.error('Bulk insert error:', insertError);
                throw insertError;
              }
            } else {
              created += toInsert.length;
            }
          }
          
          // Parallelize updates to speed up the process
          if (toUpdate.length > 0) {
            const updatePromises = toUpdate.map(({ id, data: updateData }) =>
              supabase
                .from('estimates')
                .update(updateData)
                .eq('id', id)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Bulk update error for estimate ${id}:`, error);
                    return false;
                  }
                  return true;
                })
            );
            
            const updateResults = await Promise.all(updatePromises);
            updated += updateResults.filter(r => r === true).length;
          }
        }
        
        // Check for duplicate at-risk estimates after import
        let duplicateWarnings = null;
        try {
          // Fetch all accounts and estimates to check for duplicates
          const [accountsRes, estimatesRes, snoozesRes] = await Promise.all([
            supabase.from('accounts').select('*').eq('archived', false),
            supabase.from('estimates').select('*').eq('archived', false),
            supabase.from('notification_snoozes').select('*')
          ]);
          
          if (accountsRes.data && estimatesRes.data) {
            const { duplicateEstimates } = await calculateAtRiskAccountsForImport(
              accountsRes.data,
              estimatesRes.data,
              snoozesRes.data || []
            );
            
            if (duplicateEstimates.length > 0) {
              duplicateWarnings = {
                duplicateEstimates: duplicateEstimates.length,
                message: `⚠️ Found ${duplicateEstimates.length} account(s) with duplicate at-risk estimates (same department and address). Please review.`
              };
              
              // Create notifications for duplicate estimates
              const { data: users } = await supabase.from('profiles').select('id');
              if (users && users.length > 0) {
                const notifications = [];
                const now = new Date().toISOString();
                
                for (const dup of duplicateEstimates) {
                  for (const user of users) {
                    // Check if notification already exists
                    const { data: existing } = await supabase
                      .from('notifications')
                      .select('id')
                      .eq('user_id', user.id)
                      .eq('type', 'duplicate_at_risk_estimates')
                      .eq('related_account_id', dup.account_id)
                      .eq('is_read', false)
                      .maybeSingle();
                    
                    if (existing) continue;
                    
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
                  await supabase.from('notifications').insert(notifications);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error checking for duplicate estimates after import:', error);
          // Don't fail the import if duplicate check fails
        }
        
        return res.status(200).json({
          success: true,
          created,
          updated,
          total: estimates.length,
          warnings: duplicateWarnings
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }
    
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Estimate ID is required'
        });
      }
      
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting estimate:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Estimate deleted successfully'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in estimates API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}


