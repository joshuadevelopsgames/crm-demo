/**
 * API endpoint to generate a signed download URL for Supabase Storage.
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const storagePath = req.query.path;
    if (!storagePath) {
      return res.status(400).json({ success: false, error: 'Missing path' });
    }

    const { data, error } = await supabase.storage
      .from('account-attachments')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      console.error('Storage signed URL error:', error);
      return res.status(500).json({ success: false, error: error?.message || 'Failed to generate download URL' });
    }

    res.writeHead(302, { Location: data.signedUrl });
    return res.end();
  } catch (error) {
    console.error('Storage download error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
/**
 * API endpoint for downloading task attachments
 * This proxy endpoint sets proper Content-Disposition headers to force download
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const supabase = getSupabase();
    const { path, filename } = req.query;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'path query parameter is required'
      });
    }

    // Download file from storage
    const { data, error } = await supabase.storage
      .from('task-attachments')
      .download(path);

    if (error) {
      console.error('Error downloading file:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to download file'
      });
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set headers to force download
    const downloadFilename = filename || path.split('/').pop() || 'download';
    res.setHeader('Content-Type', data.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send file
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

