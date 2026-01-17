/**
 * API endpoint for account attachments
 * Files are stored in Supabase Storage
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    
    if (req.method === 'GET') {
      const accountId = req.query.account_id;
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'account_id query parameter is required'
        });
      }

      const { data, error } = await supabase
        .from('account_attachments')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      // For private buckets, we need to generate fresh signed URLs
      // Check if bucket is public or private
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucket = buckets?.find(b => b.id === 'account-attachments');
      const isPublic = bucket?.public || false;

      // If bucket is private, generate signed URLs for each attachment
      if (!isPublic && data && data.length > 0) {
        const attachmentsWithUrls = await Promise.all(
          data.map(async (attachment) => {
            if (attachment.storage_path) {
              const { data: signedUrlData } = await supabase.storage
                .from('account-attachments')
                .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiration
              
              if (signedUrlData) {
                return {
                  ...attachment,
                  file_url: signedUrlData.signedUrl
                };
              }
            }
            return attachment;
          })
        );
        
        return res.status(200).json({
          success: true,
          data: attachmentsWithUrls || [],
          count: attachmentsWithUrls?.length || 0
        });
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0
      });
    }
    
    if (req.method === 'POST') {
      const { account_id, user_id, user_email, file_name, file_url, file_size, file_type, storage_path } = req.body;
      
      if (!account_id || !user_id || !file_name || !file_url) {
        return res.status(400).json({
          success: false,
          error: 'account_id, user_id, file_name, and file_url are required'
        });
      }

      const { data, error } = await supabase
        .from('account_attachments')
        .insert({
          account_id,
          user_id,
          user_email: user_email || null,
          file_name,
          file_url,
          file_size: file_size || null,
          file_type: file_type || null,
          storage_path: storage_path || null
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      return res.status(201).json({
        success: true,
        data
      });
    }
    
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'id query parameter is required'
        });
      }

      // First, get the attachment to delete the file from storage
      const { data: attachment, error: fetchError } = await supabase
        .from('account_attachments')
        .select('storage_path')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching attachment:', fetchError);
        return res.status(500).json({
          success: false,
          error: fetchError.message
        });
      }

      // Delete file from storage if storage_path exists
      if (attachment?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('account-attachments')
          .remove([attachment.storage_path]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('account_attachments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      return res.status(200).json({
        success: true
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

