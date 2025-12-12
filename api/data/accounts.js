/**
 * API endpoint for storing and retrieving accounts
 * Data is stored in Supabase database
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      // Return all accounts from Supabase
      const { data, error } = await supabase
        .from('accounts')
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
        // Upsert: create or update in Supabase
        const { account, lookupField = 'lmn_crm_id' } = data;
        
        // Check if account exists
        const { data: existing, error: findError } = await supabase
          .from('accounts')
          .select('*')
          .eq(lookupField, account[lookupField])
          .single();
        
        if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
          throw findError;
        }
        
        const accountData = {
          ...account,
          id: account.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          updated_at: new Date().toISOString()
        };
        
        if (existing) {
          // Update existing
          const { data: updated, error: updateError } = await supabase
            .from('accounts')
            .update(accountData)
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
          // Create new
          accountData.created_at = new Date().toISOString();
          const { data: created, error: createError } = await supabase
            .from('accounts')
            .insert(accountData)
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
        // Bulk upsert multiple accounts in Supabase
        const { accounts, lookupField = 'lmn_crm_id' } = data;
        let created = 0;
        let updated = 0;
        
        // Process in batches to avoid overwhelming Supabase
        const BATCH_SIZE = 100;
        for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
          const batch = accounts.slice(i, i + BATCH_SIZE);
          
          // Get existing accounts for this batch
          const lookupValues = batch.map(a => a[lookupField]).filter(Boolean);
          const { data: existingAccounts } = await supabase
            .from('accounts')
            .select(`id, ${lookupField}`)
            .in(lookupField, lookupValues);
          
          const existingMap = new Map();
          existingAccounts?.forEach(acc => {
            if (acc[lookupField]) {
              existingMap.set(acc[lookupField], acc.id);
            }
          });
          
          const toInsert = [];
          const toUpdate = [];
          
          batch.forEach(account => {
            const accountData = {
              ...account,
              id: account.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              updated_at: new Date().toISOString()
            };
            
            const lookupValue = account[lookupField];
            if (lookupValue && existingMap.has(lookupValue)) {
              // Update existing
              toUpdate.push({ id: existingMap.get(lookupValue), data: accountData });
            } else {
              // Create new
              accountData.created_at = new Date().toISOString();
              toInsert.push(accountData);
            }
          });
          
          // Insert new accounts
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('accounts')
              .insert(toInsert);
            
            if (insertError) {
              console.error('Bulk insert error:', insertError);
              throw insertError;
            }
            created += toInsert.length;
          }
          
          // Update existing accounts
          for (const { id, data: updateData } of toUpdate) {
            const { error: updateError } = await supabase
              .from('accounts')
              .update(updateData)
              .eq('id', id);
            
            if (updateError) {
              console.error('Bulk update error:', updateError);
              // Continue with other updates
            } else {
              updated++;
            }
          }
        }
        
        return res.status(200).json({
          success: true,
          created,
          updated,
          total: accounts.length
        });
      }
      
      if (action === 'create') {
        // Create new account in Supabase
        const accountData = { 
          ...data, 
          id: data.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data: created, error } = await supabase
          .from('accounts')
          .insert(accountData)
          .select()
          .single();
        
        if (error) throw error;
        
        return res.status(201).json({
          success: true,
          data: created
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "create", "upsert", or "bulk_upsert"'
      });
    }
    
    if (req.method === 'PUT') {
      // Update account by ID in Supabase
      const { id, ...updateData } = req.body;
      updateData.updated_at = new Date().toISOString();
      
      const { data: updated, error } = await supabase
        .from('accounts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Account not found'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        data: updated
      });
    }
    
    if (req.method === 'DELETE') {
      // Delete account by ID from Supabase
      const { id } = req.query;
      
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Account not found'
          });
        }
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'Account deleted'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in accounts API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

