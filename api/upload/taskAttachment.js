/**
 * API endpoint for uploading task attachment files to Supabase Storage
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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // 10MB max file size
    },
  },
};

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const supabase = getSupabase();
    
    // Get file from request
    const { file, fileName, taskId, userId, userEmail } = req.body;
    
    if (!file || !fileName || !taskId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'file, fileName, taskId, and userId are required'
      });
    }

    // Convert base64 to buffer if needed
    let fileBuffer;
    if (typeof file === 'string' && file.startsWith('data:')) {
      // Base64 data URL
      const base64Data = file.split(',')[1];
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else if (typeof file === 'string') {
      // Base64 string
      fileBuffer = Buffer.from(file, 'base64');
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid file format. Expected base64 string or data URL.'
      });
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${taskId}/${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('task-attachments')
      .upload(filePath, fileBuffer, {
        contentType: req.body.fileType || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: uploadError.message || 'Failed to upload file'
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('task-attachments')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // Save attachment record to database
    const { data: attachmentData, error: dbError } = await supabase
      .from('task_attachments')
      .insert({
        task_id: taskId,
        user_id: userId,
        user_email: userEmail || null,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileBuffer.length,
        file_type: req.body.fileType || null,
        storage_path: filePath
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage
        .from('task-attachments')
        .remove([filePath]);
      
      return res.status(500).json({
        success: false,
        error: dbError.message || 'Failed to save attachment record'
      });
    }

    return res.status(201).json({
      success: true,
      data: attachmentData
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

