/**
 * API endpoint for syncing Gmail emails
 * Phase 1: Basic email sync with contact matching and keyword filtering
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase configuration missing');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Gmail API base URL
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

// Simple keyword-based filtering (Phase 1, no AI)
const BUSINESS_KEYWORDS = [
  'quote', 'quotation', 'proposal', 'estimate', 'contract', 'agreement',
  'meeting', 'call', 'appointment', 'follow-up', 'follow up',
  'invoice', 'payment', 'billing', 'purchase order', 'po',
  'project', 'work', 'service', 'client', 'customer',
  'deadline', 'delivery', 'shipment', 'order', 'request'
];

const MARKETING_KEYWORDS = [
  'unsubscribe', 'newsletter', 'promotion', 'sale', 'discount',
  'marketing', 'advertisement', 'spam', 'opt-out'
];

/**
 * Check if email is likely business-related using simple keyword matching
 */
function isBusinessEmail(subject, snippet, body) {
  const text = `${subject || ''} ${snippet || ''} ${body || ''}`.toLowerCase();
  
  // Check for marketing keywords first (exclude these)
  const hasMarketingKeywords = MARKETING_KEYWORDS.some(keyword => 
    text.includes(keyword)
  );
  
  if (hasMarketingKeywords) {
    return false;
  }
  
  // Check for business keywords
  const matchedKeywords = BUSINESS_KEYWORDS.filter(keyword => 
    text.includes(keyword)
  );
  
  // If we have business keywords, it's likely important
  return matchedKeywords.length > 0;
}

/**
 * Match email sender to contact in database
 */
async function matchEmailToContact(senderEmail, supabase) {
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id, email, account_id')
    .eq('email', senderEmail.toLowerCase())
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error matching contact:', error);
    return null;
  }
  
  return contact;
}

/**
 * Fetch messages from Gmail API
 */
async function fetchGmailMessages(accessToken, sinceDate = null) {
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
  
  // List messages
  const listUrl = `${GMAIL_API_BASE}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`;
  const listResponse = await fetch(listUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!listResponse.ok) {
    throw new Error(`Gmail API error: ${listResponse.statusText}`);
  }
  
  const listData = await listResponse.json();
  const messageIds = (listData.messages || []).map(msg => msg.id);
  
  // Fetch full message details
  const messages = [];
  for (const messageId of messageIds.slice(0, 100)) { // Limit to 100 for performance
    try {
      const messageUrl = `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`;
      const messageResponse = await fetch(messageUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (messageResponse.ok) {
        const messageData = await messageResponse.json();
        messages.push(messageData);
      }
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
    }
  }
  
  return messages;
}

/**
 * Parse Gmail message into structured format
 */
function parseGmailMessage(message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name)?.value || '';
  
  const subject = getHeader('subject');
  const from = getHeader('from');
  const to = getHeader('to');
  const date = getHeader('date');
  const inReplyTo = getHeader('in-reply-to');
  const references = getHeader('references');
  
  // Extract email addresses
  const fromMatch = from.match(/<(.+?)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  const senderEmail = fromMatch ? fromMatch[1] || fromMatch[0] : from;
  
  const toMatch = to.match(/<(.+?)>/) || to.match(/([^\s<>]+@[^\s<>]+)/);
  const recipientEmail = toMatch ? toMatch[1] || toMatch[0] : to;
  
  // Extract body
  let body = '';
  const snippet = message.snippet || '';
  
  const extractBody = (part) => {
    if (part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };
  
  if (message.payload) {
    extractBody(message.payload);
  }
  
  return {
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId,
    subject,
    snippet,
    body: body.substring(0, 10000), // Limit body size
    sender_email: senderEmail.toLowerCase(),
    recipient_email: recipientEmail.toLowerCase(),
    received_at: date ? new Date(date) : new Date(),
    in_reply_to: inReplyTo,
    references
  };
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }
    
    // Get user ID from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - No token provided' 
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - Invalid token' 
      });
    }
    
    const userId = user.id;
    const userEmail = user.email;
    
    // Get Gmail integration for user
    const { data: integration, error: integrationError } = await supabase
      .from('gmail_integrations')
      .select('access_token, refresh_token, token_expiry, last_sync')
      .eq('user_id', userId)
      .single();
    
    if (integrationError || !integration) {
      return res.status(401).json({ 
        success: false, 
        error: 'Gmail not connected' 
      });
    }
    
    // Check if token is expired (simplified - would need refresh logic)
    if (integration.token_expiry && new Date(integration.token_expiry) < new Date()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Gmail token expired. Please reconnect.' 
      });
    }
    
    // Get last sync date
    const lastSync = integration.last_sync ? new Date(integration.last_sync) : null;
    
    // Fetch messages from Gmail
    console.log(`📧 Fetching Gmail messages for user ${userId} since ${lastSync || '30 days ago'}`);
    const rawMessages = await fetchGmailMessages(integration.access_token, lastSync);
    console.log(`📧 Fetched ${rawMessages.length} messages from Gmail`);
    
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];
    
    // Process each message
    for (const rawMessage of rawMessages) {
      try {
        // Parse message
        const parsed = parseGmailMessage(rawMessage);
        
        // Check if message already exists
        const { data: existing } = await supabase
          .from('gmail_messages')
          .select('id')
          .eq('user_id', userId)
          .eq('gmail_message_id', parsed.gmail_message_id)
          .maybeSingle();
        
        if (existing) {
          skipped++;
          continue;
        }
        
        // Match to contact
        const contact = await matchEmailToContact(parsed.sender_email, supabase);
        const accountId = contact?.account_id || null;
        
        // Determine direction
        const direction = parsed.sender_email.toLowerCase() === userEmail.toLowerCase() 
          ? 'outbound' 
          : 'inbound';
        
        // Simple keyword-based filtering
        const isImportant = isBusinessEmail(parsed.subject, parsed.snippet, parsed.body);
        const text = `${parsed.subject || ''} ${parsed.snippet || ''} ${parsed.body || ''}`.toLowerCase();
        const matchedKeywords = BUSINESS_KEYWORDS.filter(keyword => text.includes(keyword));
        
        // Store message in database
        const { error: insertError } = await supabase
          .from('gmail_messages')
          .insert({
            user_id: userId,
            gmail_message_id: parsed.gmail_message_id,
            gmail_thread_id: parsed.gmail_thread_id,
            contact_id: contact?.id || null,
            account_id: accountId,
            direction,
            subject: parsed.subject,
            snippet: parsed.snippet,
            body: parsed.body,
            sender_email: parsed.sender_email,
            recipient_email: parsed.recipient_email,
            received_at: parsed.received_at,
            is_important: isImportant,
            keyword_matches: matchedKeywords
          });
        
        if (insertError) {
          throw insertError;
        }
        
        synced++;
      } catch (error) {
        errors++;
        errorsList.push({
          message_id: rawMessage.id,
          error: error.message
        });
        console.error('Error processing message:', error);
      }
    }
    
    // Update last sync timestamp
    await supabase
      .from('gmail_integrations')
      .update({ 
        last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    return res.status(200).json({
      success: true,
      synced,
      skipped,
      errors,
      errorsList: errorsList.slice(0, 10), // Limit error list
      message: `Synced ${synced} messages, skipped ${skipped} duplicates, ${errors} errors`
    });
    
  } catch (error) {
    console.error('Error syncing Gmail:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync Gmail messages'
    });
  }
}

