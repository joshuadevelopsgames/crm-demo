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
      // Fetch all accounts using pagination to bypass Supabase's 1000 row limit
      let allAccounts = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        if (data && data.length > 0) {
          allAccounts = allAccounts.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return res.status(200).json({
        success: true,
        data: allAccounts,
        count: allAccounts.length
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
        
        // Use the imported ID directly (e.g., "lmn-account-6857868")
        const { id, ...accountWithoutId } = account;
        const accountData = {
          ...accountWithoutId,
          updated_at: new Date().toISOString()
        };
        
        // Include id if provided (should be from import like "lmn-account-XXXXX")
        if (id) {
          accountData.id = id;
        }
        
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
        // IMPORTANT: We use ID-based matching (lmn_crm_id) ONLY, never name matching
        // IDs are immutable and reliable, while names can change (typos, rebranding, etc.)
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
          const seenInBatch = new Set(); // Track duplicates within batch
          
          batch.forEach(account => {
            const lookupValue = account[lookupField];
            
            // Skip if no lookup value (can't match duplicates)
            if (!lookupValue) {
              console.warn(`Skipping account without ${lookupField}:`, account.name || account.id);
              return;
            }
            
            // Skip if we've already seen this lookup value in this batch (duplicate in same batch)
            if (seenInBatch.has(lookupValue)) {
              console.warn(`Skipping duplicate ${lookupField} in batch:`, lookupValue);
              return;
            }
            seenInBatch.add(lookupValue);
            
            // Use the imported ID directly (e.g., "lmn-account-6857868")
            const { id, ...accountWithoutId } = account;
            const accountData = {
              ...accountWithoutId,
              updated_at: new Date().toISOString()
            };
            
            // Include id if provided (should be from import like "lmn-account-XXXXX")
            if (id) {
              accountData.id = id;
            }
            
            if (existingMap.has(lookupValue)) {
              // Update existing - use the ID from database
              toUpdate.push({ id: existingMap.get(lookupValue), data: accountData });
            } else {
              // Create new - use the imported ID
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
              // Handle unique constraint violations gracefully
              if (insertError.code === '23505') { // Unique violation
                console.warn('Unique constraint violation - some accounts may already exist:', insertError.message);
                // Try to insert one by one to identify which ones failed
                let successCount = 0;
                for (const accountData of toInsert) {
                  try {
                    const { error: singleError } = await supabase
                      .from('accounts')
                      .insert(accountData);
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
        // Use the imported ID directly (e.g., "lmn-account-6857868")
        const { id, ...dataWithoutId } = data;
        const accountData = { 
          ...dataWithoutId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Include id if provided (should be from import like "lmn-account-XXXXX")
        if (id) {
          accountData.id = id;
        }
        
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


