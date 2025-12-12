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
      const { data, error } = await supabase
        .from('estimates')
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
        const { estimate, lookupField = 'lmn_estimate_id' } = data;
        
        const { data: existing, error: findError } = await supabase
          .from('estimates')
          .select('*')
          .eq(lookupField, estimate[lookupField])
          .single();
        
        if (findError && findError.code !== 'PGRST116') {
          throw findError;
        }
        
        const estimateData = {
          ...estimate,
          id: estimate.id || `est_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          updated_at: new Date().toISOString()
        };
        
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
        const { estimates, lookupField = 'lmn_estimate_id' } = data;
        let created = 0;
        let updated = 0;
        
        const BATCH_SIZE = 100;
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
          
          const toInsert = [];
          const toUpdate = [];
          
          batch.forEach(estimate => {
            const estimateData = {
              ...estimate,
              id: estimate.id || `est_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              updated_at: new Date().toISOString()
            };
            
            const lookupValue = estimate[lookupField];
            if (lookupValue && existingMap.has(lookupValue)) {
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
              console.error('Bulk insert error:', insertError);
              throw insertError;
            }
            created += toInsert.length;
          }
          
          for (const { id, data: updateData } of toUpdate) {
            const { error: updateError } = await supabase
              .from('estimates')
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
          total: estimates.length
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
    console.error('Error in estimates API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

