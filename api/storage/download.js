/**
 * API endpoint for generating signed URLs or forcing download
 * for Supabase Storage files (account and task attachments).
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
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app'
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
    const filename = req.query.filename || 'attachment';
    const forceDownload = req.query.download === '1';
    const bucket = req.query.bucket || 'account-attachments';

    if (!storagePath) {
      return res.status(400).json({ success: false, error: 'Missing path' });
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      console.error('Storage signed URL error:', error);
      return res.status(500).json({ success: false, error: error?.message || 'Failed to generate download URL' });
    }

    if (!forceDownload) {
      res.writeHead(302, { Location: data.signedUrl });
      return res.end();
    }

    const upstream = await fetch(data.signedUrl);
    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => '');
      console.error('Storage fetch error:', errorText);
      return res.status(500).json({ success: false, error: 'Failed to download file' });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Storage download error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}

