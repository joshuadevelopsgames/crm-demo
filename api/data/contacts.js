/**
 * API endpoint for storing and retrieving contacts
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
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app'
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
      // Fetch all contacts using pagination to bypass Supabase's 1000 row limit
      let allContacts = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('contacts')
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
          allContacts = allContacts.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return res.status(200).json({
        success: true,
        data: allContacts,
        count: allContacts.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'upsert') {
        const { contact, lookupField = 'lmn_contact_id' } = data;
        
        const { data: existing, error: findError } = await supabase
          .from('contacts')
          .select('*')
          .eq(lookupField, contact[lookupField])
          .single();
        
        if (findError && findError.code !== 'PGRST116') {
          throw findError;
        }
        
        // Use the imported ID directly (e.g., "lmn-contact-P6857868")
        // Also remove internal tracking fields that don't exist in the schema
        const { id, account_id, data_source, matched, ...contactWithoutId } = contact;
        const contactData = {
          ...contactWithoutId,
          updated_at: new Date().toISOString()
        };
        
        // Include account_id if provided (should be text like "lmn-account-XXXXX")
        if (account_id) {
          contactData.account_id = account_id;
        } else {
          contactData.account_id = null;
        }
        
        // Include id if provided (should be from import like "lmn-contact-XXXXX")
        if (id) {
          contactData.id = id;
        }
        
        if (existing) {
          const { data: updated, error: updateError } = await supabase
            .from('contacts')
            .update(contactData)
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
          contactData.created_at = new Date().toISOString();
          const { data: created, error: createError } = await supabase
            .from('contacts')
            .insert(contactData)
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
        // IMPORTANT: We use ID-based matching (lmn_contact_id) ONLY, never name/email matching
        // IDs are immutable and reliable, while names/emails can change
        const { contacts, lookupField = 'lmn_contact_id' } = data;
        let created = 0;
        let updated = 0;
        
        const BATCH_SIZE = 100;
        for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
          const batch = contacts.slice(i, i + BATCH_SIZE);
          
          const lookupValues = batch.map(c => c[lookupField]).filter(Boolean);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select(`id, ${lookupField}`)
            .in(lookupField, lookupValues);
          
          const existingMap = new Map();
          existingContacts?.forEach(cont => {
            if (cont[lookupField]) {
              existingMap.set(cont[lookupField], cont.id);
            }
          });
          
          const toInsert = [];
          const toUpdate = [];
          const seenInBatch = new Set(); // Track duplicates within batch
          
          batch.forEach(contact => {
            const lookupValue = contact[lookupField];
            
            // Skip if no lookup value (can't match duplicates)
            if (!lookupValue) {
              console.warn(`Skipping contact without ${lookupField}:`, contact.email || contact.first_name || contact.id);
              return;
            }
            
            // Skip if we've already seen this lookup value in this batch (duplicate in same batch)
            if (seenInBatch.has(lookupValue)) {
              console.warn(`Skipping duplicate ${lookupField} in batch:`, lookupValue);
              return;
            }
            seenInBatch.add(lookupValue);
            
            // Use the imported ID directly (e.g., "lmn-contact-P6857868")
            // Also remove internal tracking fields that don't exist in the schema
            const { id, account_id, data_source, matched, ...contactWithoutIds } = contact;
            const contactData = {
              ...contactWithoutIds,
              updated_at: new Date().toISOString()
            };
            
            // CRITICAL: Always preserve id, lmn_contact_id, and account_id
            // These MUST be preserved to ensure data integrity - all fields stay with their correct ID
            // id is required for inserts (Supabase doesn't auto-generate if we provide custom format)
            // lmn_contact_id is used for matching existing records
            if (id) {
              contactData.id = id;
            }
            // Explicitly preserve lmn_contact_id if it exists (should always be present from parser)
            if (contact.lmn_contact_id !== undefined) {
              contactData.lmn_contact_id = contact.lmn_contact_id;
            }
            
            // Include account_id if provided (should be text like "lmn-account-XXXXX")
            // This links the contact to the correct account
            if (account_id) {
              contactData.account_id = account_id;
            } else {
              // Set to null if not provided
              contactData.account_id = null;
            }
            
            if (existingMap.has(lookupValue)) {
              toUpdate.push({ id: existingMap.get(lookupValue), data: contactData });
            } else {
              contactData.created_at = new Date().toISOString();
              toInsert.push(contactData);
            }
          });
          
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('contacts')
              .insert(toInsert);
            
            if (insertError) {
              // Handle unique constraint violations gracefully
              if (insertError.code === '23505') { // Unique violation
                console.warn('Unique constraint violation - some contacts may already exist:', insertError.message);
                // Try to insert one by one to identify which ones failed
                let successCount = 0;
                for (const contactData of toInsert) {
                  try {
                    const { error: singleError } = await supabase
                      .from('contacts')
                      .insert(contactData);
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
                .from('contacts')
                .update(updateData)
                .eq('id', id)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Bulk update error for contact ${id}:`, error);
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
          total: contacts.length
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
          error: 'Contact ID is required'
        });
      }
      
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting contact:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Contact deleted successfully'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error in contacts API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}


