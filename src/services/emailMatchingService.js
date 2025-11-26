/**
 * Email Matching Service
 * Matches Gmail emails to CRM contacts and accounts
 */

/**
 * Match email to contacts and accounts
 */
export function matchEmailToCRM(email, contacts = [], accounts = []) {
  const results = {
    contact: null,
    account: null,
    confidence: 'none' // 'exact', 'domain', 'none'
  };

  // Extract email addresses from email
  const emailAddresses = [
    email.from?.email,
    ...(email.to || []).map(e => e.email),
    ...(email.cc || []).map(e => e.email),
    ...(email.bcc || []).map(e => e.email)
  ].filter(Boolean);

  // Try exact match first
  for (const emailAddr of emailAddresses) {
    const contact = contacts.find(c => 
      c.email?.toLowerCase() === emailAddr.toLowerCase()
    );

    if (contact) {
      results.contact = contact;
      results.confidence = 'exact';
      
      // Find associated account
      if (contact.account_id) {
        results.account = accounts.find(a => a.id === contact.account_id);
      }
      
      return results;
    }
  }

  // Try domain match (if email domain matches account domain)
  for (const emailAddr of emailAddresses) {
    const domain = emailAddr.split('@')[1]?.toLowerCase();
    if (!domain) continue;

    // Check if any account name matches domain
    const account = accounts.find(a => {
      const accountDomain = a.name?.toLowerCase().replace(/\s+/g, '');
      return domain.includes(accountDomain) || accountDomain.includes(domain.split('.')[0]);
    });

    if (account) {
      results.account = account;
      results.confidence = 'domain';
      
      // Try to find contact in that account
      results.contact = contacts.find(c => 
        c.account_id === account.id && 
        c.email?.toLowerCase().includes(domain.split('.')[0])
      );
      
      return results;
    }
  }

  return results;
}

/**
 * Determine interaction direction
 */
export function getInteractionDirection(email, currentUserEmail) {
  // Check if email was sent by current user
  const fromEmail = email.from?.email?.toLowerCase();
  const userEmail = currentUserEmail?.toLowerCase();
  
  if (fromEmail === userEmail) {
    return 'outbound';
  }
  
  // Check if current user is in recipients
  const allRecipients = [
    ...(email.to || []).map(e => e.email?.toLowerCase()),
    ...(email.cc || []).map(e => e.email?.toLowerCase()),
    ...(email.bcc || []).map(e => e.email?.toLowerCase())
  ].filter(Boolean);
  
  if (allRecipients.includes(userEmail)) {
    return 'inbound';
  }
  
  // Default to inbound if we can't determine
  return 'inbound';
}

/**
 * Extract interaction type from email
 */
export function getInteractionType(email) {
  if (email.isSent) {
    return 'email_sent';
  }
  return 'email_received';
}

/**
 * Extract tags from email content/subject
 */
export function extractTagsFromEmail(email) {
  const tags = [];
  const subject = (email.subject || '').toLowerCase();
  const body = (email.body || '').toLowerCase();
  const combined = `${subject} ${body}`;

  // Common tag patterns
  if (combined.includes('meeting') || combined.includes('call')) {
    tags.push('meeting');
  }
  if (combined.includes('proposal') || combined.includes('quote')) {
    tags.push('proposal');
  }
  if (combined.includes('contract') || combined.includes('agreement')) {
    tags.push('contract');
  }
  if (combined.includes('invoice') || combined.includes('payment')) {
    tags.push('billing');
  }
  if (combined.includes('support') || combined.includes('issue')) {
    tags.push('support');
  }
  if (combined.includes('thank') || combined.includes('appreciate')) {
    tags.push('positive_feedback');
  }
  if (combined.includes('complaint') || combined.includes('unhappy')) {
    tags.push('complaint');
  }

  return tags;
}

/**
 * Convert Gmail email to Interaction entity
 */
export function convertEmailToInteraction(email, contact, account, currentUserEmail) {
  const direction = getInteractionDirection(email, currentUserEmail);
  const type = getInteractionType(email);
  const tags = extractTagsFromEmail(email);

  // Use email body or snippet as content
  const content = email.body || email.snippet || '';

  return {
    type: type,
    account_id: account?.id || '',
    contact_id: contact?.id || '',
    subject: email.subject || '(No Subject)',
    content: content.substring(0, 5000), // Limit content length
    interaction_date: email.date.toISOString(),
    direction: direction,
    sentiment: 'neutral', // Could be enhanced with sentiment analysis
    logged_by: currentUserEmail || 'system@gmail-sync',
    tags: tags,
    // Gmail-specific fields
    gmail_thread_id: email.threadId,
    gmail_message_id: email.id,
    gmail_link: `https://mail.google.com/mail/u/0/#inbox/${email.threadId}`,
    // Metadata
    metadata: {
      from: email.from,
      to: email.to,
      cc: email.cc,
      labels: email.labels,
      is_read: email.isRead
    }
  };
}




