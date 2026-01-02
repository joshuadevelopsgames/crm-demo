/**
 * API endpoint for storing and retrieving jobsites
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

      // Fetch jobsites using pagination to bypass Supabase's 1000 row limit
      let allJobsites = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      // For import validation, only fetch fields needed for comparison to reduce response size
      // This prevents hitting Vercel's 4.5MB response limit
      // Fields needed: id for matching, plus all fields used in findJobsiteDifferences
      const fields = accountId ? '*' : 'id, lmn_jobsite_id, name, address_1, address_2, city, state, postal_code, country, notes';

      while (hasMore) {
        let query = supabase
          .from('jobsites')
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
          allJobsites = allJobsites.concat(data);
          hasMore = data.length === pageSize;
          page++;
          console.log(`📄 Jobsites page ${page}: Fetched ${data.length} jobsites (total so far: ${allJobsites.length})`);
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Finished fetching jobsites. Total: ${allJobsites.length}`);
      
      // Log response size estimate
      const responseSize = JSON.stringify(allJobsites).length;
      const responseSizeMB = (responseSize / 1024 / 1024).toFixed(2);
      console.log(`📊 Jobsites response size: ${responseSizeMB} MB (${responseSize} bytes)`);
      
      // Vercel has a 4.5MB response limit, warn if approaching
      if (responseSize > 4 * 1024 * 1024) {
        console.warn(`⚠️ Jobsites response size (${responseSizeMB} MB) is approaching Vercel's 4.5MB limit`);
      }
      
      return res.status(200).json({
        success: true,
        data: allJobsites,
        count: allJobsites.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'upsert') {
        const { jobsite, lookupField = 'lmn_jobsite_id' } = data;
        
        const { data: existing, error: findError } = await supabase
          .from('jobsites')
          .select('*')
          .eq(lookupField, jobsite[lookupField])
          .single();
        
        if (findError && findError.code !== 'PGRST116') {
          throw findError;
        }
        
        // Use the imported ID directly (e.g., from import)
        // Also remove internal tracking fields that don't exist in the schema
        const { id, account_id, contact_id, _is_orphaned, _link_method, ...jobsiteWithoutId } = jobsite;
        const jobsiteData = {
          ...jobsiteWithoutId,
          updated_at: new Date().toISOString()
        };
        
        // Include account_id if provided (should be text like "lmn-account-XXXXX")
        if (account_id) {
          jobsiteData.account_id = account_id;
        } else {
          jobsiteData.account_id = null;
        }
        
        // Include contact_id if provided (should be text like "lmn-contact-XXXXX")
        if (contact_id) {
          jobsiteData.contact_id = contact_id;
        } else {
          jobsiteData.contact_id = null;
        }
        
        // Include id if provided (should be from import)
        if (id) {
          jobsiteData.id = id;
        }
        
        if (existing) {
          const { data: updated, error: updateError } = await supabase
            .from('jobsites')
            .update(jobsiteData)
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
          jobsiteData.created_at = new Date().toISOString();
          const { data: created, error: createError } = await supabase
            .from('jobsites')
            .insert(jobsiteData)
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
        // IMPORTANT: We use ID-based matching (lmn_jobsite_id) ONLY, never name/address matching
        // IDs are immutable and reliable, while names/addresses can change
        const { jobsites, lookupField = 'lmn_jobsite_id' } = data;
        let created = 0;
        let updated = 0;
        
        const BATCH_SIZE = 100;
        for (let i = 0; i < jobsites.length; i += BATCH_SIZE) {
          const batch = jobsites.slice(i, i + BATCH_SIZE);
          
          const lookupValues = batch.map(j => j[lookupField]).filter(Boolean);
          const { data: existingJobsites } = await supabase
            .from('jobsites')
            .select(`id, ${lookupField}`)
            .in(lookupField, lookupValues);
          
          const existingMap = new Map();
          existingJobsites?.forEach(job => {
            if (job[lookupField]) {
              existingMap.set(job[lookupField], job.id);
            }
          });
          
          // Get all contact IDs that exist in the database to validate references
          const contactIdsInBatch = batch.map(j => j.contact_id).filter(Boolean);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('id')
            .in('id', contactIdsInBatch);
          
          const validContactIds = new Set(existingContacts?.map(c => c.id) || []);
          
          const toInsert = [];
          const toUpdate = [];
          const seenInBatch = new Set(); // Track duplicates within batch
          
          batch.forEach(jobsite => {
            const lookupValue = jobsite[lookupField];
            
            // Skip if no lookup value (can't match duplicates)
            if (!lookupValue) {
              console.warn(`Skipping jobsite without ${lookupField}:`, jobsite.name || jobsite.id);
              return;
            }
            
            // Skip if we've already seen this lookup value in this batch (duplicate in same batch)
            if (seenInBatch.has(lookupValue)) {
              console.warn(`Skipping duplicate ${lookupField} in batch:`, lookupValue);
              return;
            }
            seenInBatch.add(lookupValue);
            
            // Use the imported ID directly (e.g., from import)
            // Also remove internal tracking fields that don't exist in the schema
            const { id, account_id, contact_id, _is_orphaned, _link_method, ...jobsiteWithoutIds } = jobsite;
            const jobsiteData = {
              ...jobsiteWithoutIds,
              updated_at: new Date().toISOString()
            };
            
            // CRITICAL: Always preserve id, lmn_jobsite_id, account_id, and contact_id
            // These MUST be preserved to ensure data integrity - all fields stay with their correct ID
            // id is required for inserts (Supabase doesn't auto-generate if we provide custom format)
            // lmn_jobsite_id is used for matching existing records
            if (id) {
              jobsiteData.id = id;
            }
            // Explicitly preserve lmn_jobsite_id if it exists (should always be present from parser)
            if (jobsite.lmn_jobsite_id !== undefined) {
              jobsiteData.lmn_jobsite_id = jobsite.lmn_jobsite_id;
            }
            
            // Include account_id if provided (should be text like "lmn-account-XXXXX")
            if (account_id) {
              jobsiteData.account_id = account_id;
            } else {
              jobsiteData.account_id = null;
            }
            
            // Include contact_id if provided AND the contact exists in the database
            // If contact doesn't exist, set to null to avoid foreign key constraint violation
            if (contact_id && validContactIds.has(contact_id)) {
              jobsiteData.contact_id = contact_id;
            } else {
              if (contact_id && !validContactIds.has(contact_id)) {
                console.warn(`Jobsite ${jobsite.lmn_jobsite_id || jobsite.id} references non-existent contact ${contact_id}, setting to null`);
              }
              jobsiteData.contact_id = null;
            }
            
            if (existingMap.has(lookupValue)) {
              toUpdate.push({ id: existingMap.get(lookupValue), data: jobsiteData });
            } else {
              jobsiteData.created_at = new Date().toISOString();
              toInsert.push(jobsiteData);
            }
          });
          
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('jobsites')
              .insert(toInsert);
            
            if (insertError) {
              // Handle unique constraint violations gracefully
              if (insertError.code === '23505') { // Unique violation
                console.warn('Unique constraint violation - some jobsites may already exist:', insertError.message);
                // Try to insert one by one to identify which ones failed
                let successCount = 0;
                for (const jobsiteData of toInsert) {
                  try {
                    const { error: singleError } = await supabase
                      .from('jobsites')
                      .insert(jobsiteData);
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
                .from('jobsites')
                .update(updateData)
                .eq('id', id)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Bulk update error for jobsite ${id}:`, error);
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
          total: jobsites.length
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
          error: 'Jobsite ID is required'
        });
      }
      
      const { error } = await supabase
        .from('jobsites')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting jobsite:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Jobsite deleted successfully'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in jobsites API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}


