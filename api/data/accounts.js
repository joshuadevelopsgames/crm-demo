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
      const maxPages = 100; // Safety limit to prevent infinite loops (supports up to 100k accounts, minimum 5 pages = 5k accounts guaranteed)

      console.log(`📥 Starting to fetch all accounts with pagination (max ${maxPages} pages = ${maxPages * pageSize} accounts)...`);
      
      while (hasMore && page < maxPages) {
        const from = page * pageSize;
        const to = (page + 1) * pageSize - 1;
        
        console.log(`📄 Fetching page ${page + 1} (rows ${from} to ${to})...`);
        
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);
        
        if (error) {
          console.error('❌ Supabase error on page', page + 1, ':', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        if (data && data.length > 0) {
          allAccounts = allAccounts.concat(data);
          console.log(`✅ Page ${page + 1}: Fetched ${data.length} accounts (total so far: ${allAccounts.length})`);
          // Continue if we got a full page (might be more)
          hasMore = data.length === pageSize;
          page++;
        } else {
          console.log(`✅ Page ${page + 1}: No more accounts (total: ${allAccounts.length})`);
          hasMore = false;
        }
      }
      
      if (page >= maxPages) {
        console.warn(`⚠️ Reached max pages limit (${maxPages}). There may be more accounts.`);
      }
      
      console.log(`✅ Finished fetching accounts. Total: ${allAccounts.length}`);
      
      // Log response size estimate
      const responseSize = JSON.stringify(allAccounts).length;
      const responseSizeMB = (responseSize / 1024 / 1024).toFixed(2);
      console.log(`📊 Response size: ${responseSizeMB} MB (${responseSize} bytes)`);
      
      // Vercel has a 4.5MB response limit, warn if approaching
      if (responseSize > 4 * 1024 * 1024) {
        console.warn(`⚠️ Response size (${responseSizeMB} MB) is approaching Vercel's 4.5MB limit`);
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
          // Update existing - preserve existing segment if new data doesn't have one
          if (!accountData.revenue_segment && existing.revenue_segment) {
            accountData.revenue_segment = existing.revenue_segment;
          } else if (!accountData.revenue_segment) {
            accountData.revenue_segment = 'C'; // Default to 'C' if missing
          }
          
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
          // Create new - ensure revenue_segment is always set (default to 'C' if missing)
          accountData.revenue_segment = account.revenue_segment || 'C';
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
            const { id: importedId, ...accountWithoutId } = account;
            const accountData = {
              ...accountWithoutId,
              // Ensure revenue_segment is always set (default to 'C' if missing)
              revenue_segment: account.revenue_segment || 'C',
              updated_at: new Date().toISOString()
            };
            
            // Always use the imported ID if provided (should be from import like "lmn-account-XXXXX")
            if (importedId) {
              accountData.id = importedId;
            }
            
            if (existingMap.has(lookupValue)) {
              // Update existing account - use the existing database ID for the update
              const existingId = existingMap.get(lookupValue);
              
              // If the imported ID is different from the existing ID, log a warning
              // We can't easily change primary keys, so we keep the existing ID
              // but ensure lmn_crm_id is set correctly for future matching
              if (importedId && importedId !== existingId) {
                console.warn(`Account ${lookupValue} has different ID: existing=${existingId}, imported=${importedId}. Keeping existing ID.`);
              }
              
              // Don't include id in update data (can't update primary key)
              const { id, ...updateDataWithoutId } = accountData;
              toUpdate.push({ id: existingId, data: updateDataWithoutId });
            } else {
              // Create new - use the imported ID (must be included for new accounts)
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
                    console.warn('Failed to insert account:', accountData.id || accountData.name, e);
                    // Skip duplicates
                  }
                }
                created += successCount;
              } else {
                console.error('Bulk insert error:', insertError);
                console.error('Error details:', JSON.stringify(insertError, null, 2));
                console.error('Sample account data:', JSON.stringify(toInsert[0], null, 2));
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
                .from('accounts')
                .update(updateData)
                .eq('id', id)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Bulk update error for account ${id}:`, error);
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
      
      // Validate that id is provided
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Account ID is required'
        });
      }
      
      // Remove any undefined or null values from updateData
      const cleanUpdateData = {};
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && updateData[key] !== null) {
          cleanUpdateData[key] = updateData[key];
        }
      });
      
      // Ensure updated_at is set
      cleanUpdateData.updated_at = new Date().toISOString();
      
      // Don't allow updating the id field
      delete cleanUpdateData.id;
      
      const { data: updated, error } = await supabase
        .from('accounts')
        .update(cleanUpdateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating account:', error);
        console.error('Account ID:', id);
        console.error('Update data:', cleanUpdateData);
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
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}


