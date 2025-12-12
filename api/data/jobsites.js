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
      const { data, error } = await supabase
        .from('jobsites')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0
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
        
        // Remove id if it's not a valid UUID - let Supabase generate it
        const { id, ...jobsiteWithoutId } = jobsite;
        const jobsiteData = {
          ...jobsiteWithoutId,
          updated_at: new Date().toISOString()
        };
        
        // Only include id if it's a valid UUID format
        if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
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
            
            // Remove id if it's not a valid UUID - let Supabase generate it
            const { id, account_id, contact_id, ...jobsiteWithoutIds } = jobsite;
            const jobsiteData = {
              ...jobsiteWithoutIds,
              updated_at: new Date().toISOString()
            };
            
            // Only include id if it's a valid UUID format
            if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
              jobsiteData.id = id;
            }
            
            // Only include account_id if it's a valid UUID format (foreign key constraint)
            if (account_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account_id)) {
              jobsiteData.account_id = account_id;
            } else {
              jobsiteData.account_id = null;
            }
            
            // Only include contact_id if it's a valid UUID format (foreign key constraint)
            if (contact_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contact_id)) {
              jobsiteData.contact_id = contact_id;
            } else {
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
          
          for (const { id, data: updateData } of toUpdate) {
            const { error: updateError } = await supabase
              .from('jobsites')
              .update(updateData)
              .eq('id', id);
            
            if (updateError) {
              console.error('Bulk update error:', updateError);
            } else {
              updated++;
            }
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


