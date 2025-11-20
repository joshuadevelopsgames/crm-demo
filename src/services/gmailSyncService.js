/**
 * Gmail Sync Service
 * Syncs Gmail emails to CRM interactions
 */

import { fetchNewEmails, getLastSyncTimestamp, updateLastSyncTimestamp, isGmailConnected } from './gmailService';
import { matchEmailToCRM, convertEmailToInteraction } from './emailMatchingService';
import { base44 } from '@/api/base44Client';

/**
 * Sync Gmail emails to CRM interactions
 */
export async function syncGmailToCRM(contacts = [], accounts = [], currentUserEmail = '') {
  if (!isGmailConnected()) {
    throw new Error('Gmail is not connected. Please connect your Gmail account first.');
  }

  try {
    // Get last sync timestamp
    const lastSync = getLastSyncTimestamp();
    
    // Fetch new emails since last sync
    const emails = await fetchNewEmails(lastSync);
    
    if (emails.length === 0) {
      return {
        success: true,
        synced: 0,
        skipped: 0,
        errors: 0,
        message: 'No new emails to sync'
      };
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];

    // Process each email
    for (const email of emails) {
      try {
        // Match email to contact/account
        const match = matchEmailToCRM(email, contacts, accounts);
        
        // Skip if no match found
        if (!match.account && !match.contact) {
          skipped++;
          continue;
        }

        // Check if interaction already exists (by Gmail message ID)
        const existingInteractions = await base44.entities.Interaction.filter({
          gmail_message_id: email.id
        });

        if (existingInteractions.length > 0) {
          skipped++;
          continue;
        }

        // Convert email to interaction
        const interaction = convertEmailToInteraction(
          email,
          match.contact,
          match.account,
          currentUserEmail
        );

        // Create interaction in CRM
        await base44.entities.Interaction.create(interaction);

        // Update account's last interaction date if we have an account
        if (match.account) {
          const interactionDate = new Date(interaction.interaction_date);
          const accountLastInteraction = match.account.last_interaction_date 
            ? new Date(match.account.last_interaction_date)
            : null;

          if (!accountLastInteraction || interactionDate > accountLastInteraction) {
            await base44.entities.Account.update(match.account.id, {
              last_interaction_date: interactionDate.toISOString().split('T')[0]
            });
          }
        }

        synced++;
      } catch (error) {
        errors++;
        errorsList.push({
          emailId: email.id,
          subject: email.subject,
          error: error.message
        });
        console.error('Error syncing email:', error);
      }
    }

    // Update last sync timestamp
    updateLastSyncTimestamp();

    return {
      success: true,
      synced,
      skipped,
      errors,
      errorsList,
      message: `Synced ${synced} emails, skipped ${skipped}, ${errors} errors`
    };
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


