/**
 * Merge data from both LMN CSV exports
 * Combines Contacts Export (IDs, Tags, Archived) with Leads List (Position, Do Not fields)
 */

/**
 * Merge contact data from both CSVs
 */
export function mergeContactData(contactsExportData, leadsListData) {
  const { accounts, contacts: baseContacts } = contactsExportData;
  const { contactsData: supplementalData } = leadsListData;
  
  // Create lookup map for supplemental data (from Leads List)
  const supplementalMap = new Map();
  
  supplementalData.forEach(supp => {
    const key = supp.match_key;
    if (key) {
      supplementalMap.set(key, supp);
    }
    
    // Also try email-only match
    if (supp.email_1) {
      supplementalMap.set(supp.email_1.toLowerCase(), supp);
    }
  });

  // Merge data into contacts
  const mergedContacts = baseContacts.map(contact => {
    // Try to find matching supplemental data
    const matchKey = createMatchKey(
      contact.first_name, 
      contact.last_name, 
      contact.email_1, 
      contact.email_2
    );
    
    let supplemental = supplementalMap.get(matchKey);
    
    // Try email-only match if not found
    if (!supplemental && contact.email_1) {
      supplemental = supplementalMap.get(contact.email_1.toLowerCase());
    }
    if (!supplemental && contact.email) {
      supplemental = supplementalMap.get(contact.email.toLowerCase());
    }

    // Merge supplemental data if found
    if (supplemental) {
      const position = supplemental.position || contact.position || '';
      
      return {
        ...contact,
        position: position,
        title: position, // Use position as title
        role: contact.role || determineRoleFromPosition(position),
        do_not_email: supplemental.do_not_email !== null ? supplemental.do_not_email : false,
        do_not_mail: supplemental.do_not_mail !== null ? supplemental.do_not_mail : false,
        do_not_call: supplemental.do_not_call !== null ? supplemental.do_not_call : false,
        referral_source: supplemental.referral_source || '',
        // Merge notes
        notes: mergeNotes(contact.notes, supplemental.notes_supplement),
        data_source: 'merged',
        matched: true
      };
    }

    // No match found - use base data only
    return {
      ...contact,
      position: '',
      title: contact.title || '',
      role: contact.role || 'user',
      do_not_email: false,
      do_not_mail: false,
      do_not_call: false,
      data_source: 'contacts_export_only',
      matched: false
    };
  });

  // Calculate stats
  const matchedCount = mergedContacts.filter(c => c.matched).length;
  const unmatchedCount = mergedContacts.filter(c => !c.matched).length;

  return {
    accounts: Array.from(accounts.values()),
    contacts: mergedContacts,
    stats: {
      totalAccounts: accounts.size,
      totalContacts: mergedContacts.length,
      matchedContacts: matchedCount,
      unmatchedContacts: unmatchedCount,
      matchRate: mergedContacts.length > 0 
        ? Math.round((matchedCount / mergedContacts.length) * 100) 
        : 0
    }
  };
}

/**
 * Create match key for contact matching
 */
function createMatchKey(firstName, lastName, email1, email2) {
  const parts = [];
  
  if (firstName) parts.push(firstName.toLowerCase().trim());
  if (lastName) parts.push(lastName.toLowerCase().trim());
  if (email1) parts.push(email1.toLowerCase().trim());
  
  return parts.join('|');
}

/**
 * Merge notes from both sources
 */
function mergeNotes(notes1, notes2) {
  const parts = [];
  
  if (notes1) parts.push(notes1);
  if (notes2 && notes2 !== notes1) parts.push(notes2);
  
  return parts.join('\n\n');
}

/**
 * Determine role from position/title
 */
function determineRoleFromPosition(position) {
  if (!position) return 'user';
  
  const normalized = position.toLowerCase();
  
  // Decision makers
  if (normalized.includes('owner') || normalized.includes('ceo') || 
      normalized.includes('president') || normalized.includes('cfo') ||
      normalized.includes('coo') || normalized.includes('founder')) {
    return 'decision_maker';
  }
  
  // Influencers
  if (normalized.includes('manager') || normalized.includes('director') || 
      normalized.includes('head of') || normalized.includes('vp') ||
      normalized.includes('vice president')) {
    return 'influencer';
  }
  
  // Default
  return 'user';
}
