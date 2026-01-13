/**
 * Google Drive API Service
 * Handles Drive OAuth and file management
 * Follows the same pattern as gmailService.js
 */

// Drive API Configuration
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

/**
 * Store Drive access token (server-side)
 * Tokens are stored securely in Supabase, not localStorage
 */
export async function storeDriveToken(tokenData) {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Store token on server via API
    const response = await fetch('/api/drive/integration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to store Drive token');
    }
  } catch (error) {
    console.error('Error storing Drive token:', error);
    throw error;
  }
}

/**
 * Get Drive connection status (server-side)
 */
export async function isDriveConnected() {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return false;
    }

    const response = await fetch('/api/drive/integration', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      return false;
    }
    
    const result = await response.json();
    return result.success && result.connected === true;
  } catch (error) {
    console.error('Error checking Drive connection:', error);
    return false;
  }
}

/**
 * Disconnect Drive (server-side)
 */
export async function disconnectDrive() {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/drive/integration', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to disconnect Drive');
    }
  } catch (error) {
    console.error('Error disconnecting Drive:', error);
    throw error;
  }
}

/**
 * List Drive files (via secure proxy)
 * Tokens are handled server-side and never exposed to frontend
 */
export async function listDriveFiles(options = {}) {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const {
      q = '', // Query string for filtering
      pageSize = 50,
      pageToken = null,
      fields = 'files(id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,createdTime,modifiedTime,shared)'
    } = options;

    // Build query params
    const params = new URLSearchParams({
      endpoint: 'files',
      pageSize: String(pageSize),
      fields: fields
    });
    
    if (q) {
      params.append('q', q);
    }
    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    // Use proxy endpoint (tokens handled server-side)
    const response = await fetch(`/api/drive/proxy?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) {
        await disconnectDrive();
        throw new Error('Drive authorization expired. Please reconnect.');
      }
      throw new Error(error.error || `Drive API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error listing Drive files:', error);
    throw error;
  }
}

/**
 * Get file metadata (via secure proxy)
 */
export async function getDriveFile(fileId) {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/drive/proxy?endpoint=files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to get Drive file: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error getting Drive file:', error);
    throw error;
  }
}

/**
 * Search files by name or in folder (via secure proxy)
 */
export async function searchDriveFiles(query, folderId = null) {
  let searchQuery = query;
  
  if (folderId) {
    searchQuery = `'${folderId}' in parents and ${query}`;
  }

  return listDriveFiles({
    q: searchQuery,
    pageSize: 100
  });
}
