/**
 * Gmail API Service
 * Handles Gmail OAuth and email fetching
 */

// Gmail API Configuration
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const REDIRECT_URI = window.location.origin + '/gmail-callback';

/**
 * Initialize Gmail OAuth flow
 * Note: This is a fallback for separate Gmail OAuth.
 * Primary method is using Gmail scopes from Supabase Google OAuth login.
 */
export function initGmailAuth() {
  if (!CLIENT_ID) {
    // Only warn if this is actually being used (not just checked)
    // The warning will show when user clicks "Connect Gmail" and we need the separate flow
    return null;
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(GMAIL_SCOPES)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  return authUrl;
}

/**
 * Exchange authorization code for access token
 * 
 * NOTE: This requires a backend service for security.
 * See GMAIL_INTEGRATION_SETUP.md for setup instructions.
 */
export async function exchangeCodeForToken(code) {
  try {
    // Try to exchange via backend API
    const response = await fetch('/api/gmail/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          'Backend API not found. Please set up the Gmail token exchange endpoint. ' +
          'See GMAIL_INTEGRATION_SETUP.md for instructions.'
        );
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to exchange code for token');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
}

/**
 * Store Gmail access token (server-side)
 * Tokens are now stored securely in Supabase, not localStorage
 */
export async function storeGmailToken(tokenData) {
  try {
    // Get current user session
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
    const response = await fetch('/api/gmail/integration', {
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
      throw new Error(error.error || 'Failed to store Gmail token');
    }

    // Also store last sync timestamp in localStorage (non-sensitive)
    if (tokenData.last_sync) {
      localStorage.setItem('gmail_last_sync', String(tokenData.last_sync));
    }
  } catch (error) {
    console.error('Error storing Gmail token:', error);
    throw error;
  }
}

/**
 * Get Gmail connection status (server-side)
 */
export async function isGmailConnected() {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      console.log('❌ isGmailConnected: Supabase not configured');
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('❌ isGmailConnected: No session found');
      return false;
    }

    console.log('🔍 isGmailConnected: Checking API endpoint...');
    const response = await fetch('/api/gmail/integration', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      console.log('❌ isGmailConnected: API response not OK:', response.status, response.statusText);
      return false;
    }
    
    const result = await response.json();
    const connected = result.success && result.connected === true;
    console.log('📊 isGmailConnected: API result:', { success: result.success, connected: result.connected, final: connected });
    return connected;
  } catch (error) {
    console.error('❌ Error checking Gmail connection:', error);
    return false;
  }
}

/**
 * Disconnect Gmail (server-side)
 */
export async function disconnectGmail() {
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

    const response = await fetch('/api/gmail/integration', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to disconnect Gmail');
    }

    // Clear localStorage sync timestamp
    localStorage.removeItem('gmail_last_sync');
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    throw error;
  }
}

/**
 * Get valid access token (via server proxy)
 * Tokens are never exposed to the frontend
 */
async function getValidAccessToken() {
  // Check if Gmail is connected
  const connected = await isGmailConnected();
  if (!connected) {
    throw new Error('Gmail not connected');
  }

  // Token is handled server-side via proxy
  // This function is kept for compatibility but tokens are managed by the proxy
  return 'proxy'; // Placeholder - actual token is used server-side
}

/**
 * Refresh access token (handled server-side)
 * Tokens are now managed server-side, so this is a no-op
 * The proxy endpoint handles token refresh automatically
 */
async function refreshAccessToken(refreshToken) {
  // Token refresh is now handled server-side by the proxy endpoint
  // This function is kept for compatibility but should not be called directly
  throw new Error('Token refresh is handled server-side. Please use the proxy endpoint.');
}

/**
 * Fetch emails from Gmail API (via secure proxy)
 * Tokens are handled server-side and never exposed to frontend
 */
export async function fetchGmailMessages(options = {}) {
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
      maxResults = 50,
      query = '',
      pageToken = null
    } = options;

    // Build query params
    const params = new URLSearchParams({
      endpoint: 'users/me/messages',
      maxResults: String(maxResults)
    });
    if (query) {
      params.append('q', query);
    }
    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    // Use proxy endpoint (tokens handled server-side)
    const response = await fetch(`/api/gmail/proxy?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) {
        await disconnectGmail();
        throw new Error('Gmail authorization expired. Please reconnect.');
      }
      throw new Error(error.error || `Gmail API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    throw error;
  }
}

/**
 * Get full message details (via secure proxy)
 */
export async function getGmailMessage(messageId) {
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

    // Use proxy endpoint
    const response = await fetch(`/api/gmail/proxy?endpoint=users/me/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to fetch message: ${response.statusText}`);
    }

    const result = await response.json();
    return parseGmailMessage(result.data);
  } catch (error) {
    console.error('Error fetching Gmail message:', error);
    throw error;
  }
}

/**
 * Parse Gmail message into structured format
 */
function parseGmailMessage(message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract email body
  let body = '';
  if (message.payload?.body?.data) {
    body = decodeBase64(message.payload.body.data);
  } else if (message.payload?.parts) {
    // Try to find text/plain or text/html part
    const textPart = message.payload.parts.find(p => 
      p.mimeType === 'text/plain' || p.mimeType === 'text/html'
    );
    if (textPart?.body?.data) {
      body = decodeBase64(textPart.body.data);
    }
  }

  // Extract participants
  const from = parseEmailAddress(getHeader('from'));
  const to = parseEmailAddresses(getHeader('to'));
  const cc = parseEmailAddresses(getHeader('cc'));
  const bcc = parseEmailAddresses(getHeader('bcc'));

  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet,
    subject: getHeader('subject'),
    from: from,
    to: to,
    cc: cc,
    bcc: bcc,
    date: new Date(parseInt(message.internalDate)),
    body: body,
    labels: message.labelIds || [],
    isRead: !message.labelIds?.includes('UNREAD'),
    isSent: message.labelIds?.includes('SENT')
  };
}

/**
 * Parse single email address
 */
function parseEmailAddress(addressStr) {
  if (!addressStr) return null;
  
  // Format: "Name <email@domain.com>" or "email@domain.com"
  const match = addressStr.match(/(.+?)\s*<(.+?)>/);
  if (match) {
    return {
      name: match[1].trim().replace(/"/g, ''),
      email: match[2].trim()
    };
  }
  
  return {
    name: '',
    email: addressStr.trim()
  };
}

/**
 * Parse multiple email addresses
 */
function parseEmailAddresses(addressesStr) {
  if (!addressesStr) return [];
  
  return addressesStr.split(',').map(addr => parseEmailAddress(addr.trim())).filter(Boolean);
}

/**
 * Decode base64 string
 */
function decodeBase64(str) {
  try {
    // Gmail uses URL-safe base64, need to convert
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return decoded;
  } catch (error) {
    console.error('Error decoding base64:', error);
    return '';
  }
}

/**
 * Fetch emails since last sync
 */
export async function fetchNewEmails(sinceDate = null) {
  let query = '';
  
  if (sinceDate) {
    const timestamp = Math.floor(sinceDate.getTime() / 1000);
    query = `after:${timestamp}`;
  } else {
    // Default: last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const timestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);
    query = `after:${timestamp}`;
  }

  const messages = await fetchGmailMessages({ query, maxResults: 500 });
  
  // Fetch full message details for each
  const messagePromises = (messages.messages || []).map(msg => 
    getGmailMessage(msg.id)
  );
  
  const fullMessages = await Promise.all(messagePromises);
  return fullMessages;
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTimestamp() {
  const lastSync = localStorage.getItem('gmail_last_sync');
  return lastSync ? new Date(parseInt(lastSync)) : null;
}

/**
 * Update last sync timestamp
 */
export function updateLastSyncTimestamp() {
  localStorage.setItem('gmail_last_sync', String(Date.now()));
}

