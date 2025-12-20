/**
 * Parser for LMN "Contacts Export.csv" format
 * This is the export with CRM ID, Contact ID, PrimaryContact, Tags, Archived
 */

import { parseCSV } from './csvParser';

/**
 * Parse Contacts Export CSV
 * Returns: { accounts: Map, contacts: [], stats: {} }
 */
export function parseContactsExport(csvText) {
  try {
    const rows = parseCSV(csvText);
    
    if (!rows || rows.length < 2) {
      return { accounts: new Map(), contacts: [], stats: { error: 'Empty or invalid CSV' } };
    }

    const headers = rows[0];
    if (!Array.isArray(headers)) {
      return { accounts: new Map(), contacts: [], stats: { error: 'Invalid CSV headers' } };
    }

    // Map column indices
    const colMap = {
      crmId: headers.findIndex(h => h === 'CRM ID'),
      contactId: headers.findIndex(h => h === 'Contact ID'),
      crmName: headers.findIndex(h => h === 'CRM Name'),
      type: headers.findIndex(h => h === 'Type'),
      primaryContact: headers.findIndex(h => h === 'PrimaryContact'),
      firstName: headers.findIndex(h => h === 'First Name'),
      lastName: headers.findIndex(h => h === 'Last Name'),
      address1: headers.findIndex(h => h === 'Address 1'),
      address2: headers.findIndex(h => h === 'Address 2'),
      city: headers.findIndex(h => h === 'City'),
      state: headers.findIndex(h => h === 'State'),
      zip: headers.findIndex(h => h === 'Zip'),
      country: headers.findIndex(h => h === 'Country'),
      phone1: headers.findIndex(h => h === 'Phone 1'),
      phone2: headers.findIndex(h => h === 'Phone 2'),
      email1: headers.findIndex(h => h === 'Email 1'),
      email2: headers.findIndex(h => h === 'Email 2'),
      notes: headers.findIndex(h => h === 'Notes'),
      tags: headers.findIndex(h => h === 'Tags'),
      archived: headers.findIndex(h => h === 'Archived'),
      classification: headers.findIndex(h => h === 'Classification')
    };

    if (colMap.crmId === -1 || colMap.crmName === -1) {
      return { 
        accounts: new Map(), 
        contacts: [], 
        stats: { error: 'Missing required columns: CRM ID or CRM Name' } 
      };
    }

    const accountsMap = new Map();
    const contactsList = [];
    let rowNum = 1;

    for (const row of rows.slice(1)) {
      rowNum++;
      
      const crmId = row[colMap.crmId]?.trim();
      const crmName = row[colMap.crmName]?.trim();
      
      if (!crmId || !crmName) continue;

      // Create or get account
      if (!accountsMap.has(crmId)) {
        const type = row[colMap.type]?.trim() || 'Lead';
        const classification = row[colMap.classification]?.trim() || 'Undefined';
        const tags = row[colMap.tags]?.trim() || '';
        const archived = row[colMap.archived]?.trim().toLowerCase() === 'true';
        
        // Ensure account always has a unique, stable ID based on LMN CRM ID
        const accountId = `lmn-account-${crmId}`;
        
        accountsMap.set(crmId, {
          id: accountId, // Stable ID for merging
          lmn_crm_id: crmId, // Original LMN ID for future lookups
          name: crmName,
          account_type: type.toLowerCase(), // lead, client, other
          classification: classification.toLowerCase(),
          status: archived ? 'archived' : 'active',
          archived: archived, // Boolean field for consistency
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
          source: 'lmn_contacts_export',
          created_date: new Date().toISOString(),
          // Address from first contact
          address_1: row[colMap.address1]?.trim() || '',
          address_2: row[colMap.address2]?.trim() || '',
          city: row[colMap.city]?.trim() || '',
          state: row[colMap.state]?.trim() || '',
          postal_code: row[colMap.zip]?.trim() || '',
          country: row[colMap.country]?.trim() || 'Canada'
        });
      }

      // Create contact
      const firstName = row[colMap.firstName]?.trim();
      const lastName = row[colMap.lastName]?.trim();
      
      if (firstName || lastName) {
        const contactId = row[colMap.contactId]?.trim();
        const primaryContact = row[colMap.primaryContact]?.trim().toLowerCase() === 'true';
        const email1 = row[colMap.email1]?.trim() || '';
        const email2 = row[colMap.email2]?.trim() || '';
        
        // Ensure contact always has a unique, stable ID based on LMN Contact ID
        const stableContactId = contactId ? `lmn-contact-${contactId}` : `lmn-contact-${crmId}-${rowNum}`;
        const accountId = `lmn-account-${crmId}`;
        
        const contactArchived = row[colMap.archived]?.trim().toLowerCase() === 'true';
        
        contactsList.push({
          id: stableContactId, // Stable ID for merging
          lmn_contact_id: contactId, // Original LMN Contact ID for future lookups
          account_id: accountId, // Link to parent account (always present)
          account_name: crmName,
          first_name: firstName || '',
          last_name: lastName || '',
          email: email1,
          email_1: email1,
          email_2: email2,
          phone: row[colMap.phone1]?.trim() || '',
          phone_1: row[colMap.phone1]?.trim() || '',
          phone_2: row[colMap.phone2]?.trim() || '',
          primary_contact: primaryContact,
          role: 'user', // Default role, will be enriched from position
          title: '', // Will be enriched from position
          archived: contactArchived, // Archived status from CSV
          notes: row[colMap.notes]?.trim() || '',
          source: 'lmn_contacts_export',
          created_date: new Date().toISOString(),
          // Will be enriched with data from Leads List
          position: null,
          do_not_email: false,
          do_not_mail: false,
          do_not_call: false
        });
      }
    }

    return {
      accounts: accountsMap,
      contacts: contactsList,
      stats: {
        totalRows: rows.length - 1,
        accountsFound: accountsMap.size,
        contactsFound: contactsList.length,
        source: 'Contacts Export CSV'
      }
    };
  } catch (error) {
    console.error('Error parsing Contacts Export:', error);
    return {
      accounts: new Map(),
      contacts: [],
      stats: { error: `Failed to parse: ${error.message}` }
    };
  }
}














