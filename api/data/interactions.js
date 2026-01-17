/**
 * API endpoint for storing and retrieving interactions
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
      // Fetch all interactions using pagination to bypass Supabase's 1000 row limit
      let allInteractions = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('interactions')
          .select('*')
          .order('interaction_date', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        if (data && data.length > 0) {
          allInteractions = allInteractions.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return res.status(200).json({
        success: true,
        data: allInteractions,
        count: allInteractions.length
      });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'create') {
        // Create new interaction in Supabase
        const { id, account_id, contact_id, ...dataWithoutIds } = data;
        const interactionData = { 
          ...dataWithoutIds,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Handle account_id - try to find UUID if passed as text ID
        if (account_id) {
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account_id)) {
            // Already a UUID
            interactionData.account_id = account_id;
          } else {
            // Try to find account by text ID (in case app uses text IDs)
            const { data: account } = await supabase
              .from('accounts')
              .select('id')
              .eq('id', account_id)
              .maybeSingle();
            if (account) {
              interactionData.account_id = account.id;
            } else {
              // If not found, try lmn_crm_id
              const { data: accountByLmnId } = await supabase
                .from('accounts')
                .select('id')
                .eq('lmn_crm_id', account_id)
                .maybeSingle();
              if (accountByLmnId) {
                interactionData.account_id = accountByLmnId.id;
              }
            }
          }
        }
        
        // Handle contact_id - try to find UUID if passed as text ID
        if (contact_id) {
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contact_id)) {
            // Already a UUID
            interactionData.contact_id = contact_id;
          } else {
            // Try to find contact by text ID
            const { data: contact } = await supabase
              .from('contacts')
              .select('id')
              .eq('id', contact_id)
              .maybeSingle();
            if (contact) {
              interactionData.contact_id = contact.id;
            } else {
              // If not found, try lmn_contact_id
              const { data: contactByLmnId } = await supabase
                .from('contacts')
                .select('id')
                .eq('lmn_contact_id', contact_id)
                .maybeSingle();
              if (contactByLmnId) {
                interactionData.contact_id = contactByLmnId.id;
              }
            }
          }
        }
        
        // Only include id if it's a valid UUID format
        if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          interactionData.id = id;
        }
        
        const { data: newInteraction, error } = await supabase
          .from('interactions')
          .insert(interactionData)
          .select()
          .single();
        
        if (error) {
          console.error('Error creating interaction:', error);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
        return res.status(201).json({
          success: true,
          data: newInteraction
        });
      }
    }
    
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Interaction ID is required'
        });
      }
      
      // Remove id from update data and add updated_at timestamp
      const { id: _, ...dataWithoutId } = updateData;
      const interactionData = {
        ...dataWithoutId,
        updated_at: new Date().toISOString()
      };
      
      // Handle account_id lookup if not UUID
      if (interactionData.account_id) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(interactionData.account_id)) {
          const { data: account } = await supabase
            .from('accounts')
            .select('id')
            .eq('lmn_crm_id', interactionData.account_id)
            .maybeSingle();
          if (account) {
            interactionData.account_id = account.id;
          } else {
            delete interactionData.account_id;
          }
        }
      }
      
      // Handle contact_id lookup if not UUID
      if (interactionData.contact_id) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(interactionData.contact_id)) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('lmn_contact_id', interactionData.contact_id)
            .maybeSingle();
          if (contact) {
            interactionData.contact_id = contact.id;
          } else {
            delete interactionData.contact_id;
          }
        }
      }
      
      const { data: updatedInteraction, error } = await supabase
        .from('interactions')
        .update(interactionData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating interaction:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        data: updatedInteraction
      });
    }
    
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Interaction ID is required'
        });
      }
      
      const { error } = await supabase
        .from('interactions')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting interaction:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Interaction deleted successfully'
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
