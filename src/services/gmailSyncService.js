/**
 * Gmail Sync Service
 * Phase 1: Syncs Gmail emails to database (gmail_messages table)
 * Then converts important emails to interactions
 */

import { isGmailConnected } from './gmailService';
import { getSupabaseAuth } from './supabaseClient';

/**
 * Sync Gmail emails using the new API endpoint
 * Phase 1: Stores messages in gmail_messages table first
 */
export async function syncGmailToCRM(contacts = [], accounts = [], currentUserEmail = '') {
  const connected = await isGmailConnected();
  if (!connected) {
    throw new Error('Gmail is not connected. Please connect your Gmail account first.');
  }

  try {
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Call the sync API endpoint
    const response = await fetch('/api/gmail/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to sync Gmail messages');
    }

    const result = await response.json();
    
    // After syncing messages, convert important ones to interactions
    // This is a separate step that can be done asynchronously
    if (result.success && result.synced > 0) {
      // TODO: Convert important messages to interactions
      // This will be implemented after messages are stored
    }

    return result;
  } catch (error) {
    console.error('Error syncing Gmail:', error);
    return {
      success: false,
      synced: 0,
      skipped: 0,
      errors: 1,
      errorsList: [{ error: error.message }],
      message: `Sync failed: ${error.message}`
    };
  }
}

/**
 * Sync specific email thread
 */
export async function syncEmailThread(threadId, contacts = [], accounts = [], currentUserEmail = '') {
  // This would fetch a specific thread and sync all messages in it
  // Implementation similar to syncGmailToCRM but for a specific thread
  // For now, we'll use the general sync function
  return syncGmailToCRM(contacts, accounts, currentUserEmail);
}




