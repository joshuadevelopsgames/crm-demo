/**
 * API endpoint for storing and retrieving estimates
 * Data is stored in Supabase database
 */

import { createClient } from '@supabase/supabase-js';

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

      while (hasMore) {
        let query = supabase
          .from('estimates')
          .select('*')
          .order('created_at', { ascending: false });
        
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
        } else {
          hasMore = false;
        }
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
        
        // Always preserve contract_start and contract_end from incoming data, even if they're null
        // This ensures contract dates are properly saved during import
        if (estimate.contract_start !== undefined) {
          estimateData.contract_start = estimate.contract_start;
        }
        if (estimate.contract_end !== undefined) {
          estimateData.contract_end = estimate.contract_end;
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
              console.log(`🔍 API: Sample estimate ${lookupValue}:`, {
                status: estimate.status,
                hasContractEnd: !!estimate.contract_end,
                contractEnd: estimate.contract_end,
                contractEndType: typeof estimate.contract_end,
                hasContractStart: !!estimate.contract_start,
                contractStart: estimate.contract_start,
                account_id: estimate.account_id
              });
            }
            
            // Remove id if it's not a valid UUID - let Supabase generate it
            // Also remove internal tracking fields and fields that don't exist in the schema
            const { id, account_id, contact_id, _is_orphaned, _link_method, ...estimateWithoutIds } = estimate;
            const estimateData = {
              ...estimateWithoutIds,
              updated_at: new Date().toISOString()
            };
            
            // Debug: Verify contract_end is in estimateData
            if (seenInBatch.size <= 5) {
              console.log(`🔍 API: estimateData for ${lookupValue}:`, {
                status: estimateData.status,
                hasContractEnd: !!estimateData.contract_end,
                contractEnd: estimateData.contract_end,
                contractEndType: typeof estimateData.contract_end,
                hasContractStart: !!estimateData.contract_start,
                contractStart: estimateData.contract_start
              });
            }
            
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
            
            // Always preserve contract_start and contract_end from incoming data, even if they're null
            // This ensures contract dates are properly saved during import
            if (estimate.contract_start !== undefined) {
              estimateData.contract_start = estimate.contract_start;
            }
            if (estimate.contract_end !== undefined) {
              estimateData.contract_end = estimate.contract_end;
            }
            
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
        
        return res.status(200).json({
          success: true,
          created,
          updated,
          total: estimates.length
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


