/**
 * Parser for LMN "Contacts Export.csv" format
 * This is the export with CRM ID, Contact ID, PrimaryContact, Tags, Archived
 */

import { parseCSV } from './csvParser';

/**
 * Parse Contacts Export CSV/XLSX
 * Accepts either CSV text string or array of arrays (from XLSX)
 * Returns: { accounts: Map, contacts: [], stats: {} }
 */
export function parseContactsExport(csvTextOrRows) {
  try {
    // If it's already an array of arrays (from XLSX), use it directly
    // Otherwise, parse CSV text
    const rows = Array.isArray(csvTextOrRows) && Array.isArray(csvTextOrRows[0])
      ? csvTextOrRows
      : parseCSV(csvTextOrRows);
    
    if (!rows || rows.length < 2) {
      return { accounts: new Map(), contacts: [], stats: { error: 'Empty or invalid CSV' } };
    }

    const headers = rows[0];
    if (!Array.isArray(headers)) {
      return { accounts: new Map(), contacts: [], stats: { error: 'Invalid CSV headers' } };
    }

    // Map column indices with flexible matching
    // Use trim() and case-insensitive matching for robustness
    const findColumn = (exactName, ...alternatives) => {
      const exact = headers.findIndex(h => h && h.toString().trim() === exactName);
      if (exact >= 0) return exact;
      // Try case-insensitive
      const caseInsensitive = headers.findIndex(h => h && h.toString().trim().toLowerCase() === exactName.toLowerCase());
      if (caseInsensitive >= 0) return caseInsensitive;
      // Try alternatives
      for (const alt of alternatives) {
        const altMatch = headers.findIndex(h => h && h.toString().trim().toLowerCase() === alt.toLowerCase());
        if (altMatch >= 0) return altMatch;
      }
      return -1;
    };
    
    const colMap = {
      crmId: findColumn('CRM ID', 'Crm Id', 'crm id', 'CRM_ID', 'CrmId'),
      contactId: findColumn('Contact ID', 'Contact Id', 'contact id', 'CONTACT_ID', 'ContactId'),
      crmName: findColumn('CRM Name', 'Crm Name', 'crm name', 'CRM_NAME', 'CrmName', 'Account Name', 'account name'),
      type: headers.findIndex(h => h && h.toString().trim() === 'Type'),
      primaryContact: headers.findIndex(h => h && h.toString().trim() === 'PrimaryContact'),
      firstName: headers.findIndex(h => h && h.toString().trim() === 'First Name'),
      lastName: headers.findIndex(h => h && h.toString().trim() === 'Last Name'),
      address1: headers.findIndex(h => h && h.toString().trim() === 'Address 1'),
      address2: headers.findIndex(h => h && h.toString().trim() === 'Address 2'),
      city: headers.findIndex(h => h && h.toString().trim() === 'City'),
      state: headers.findIndex(h => h && h.toString().trim() === 'State'),
      zip: headers.findIndex(h => h && h.toString().trim() === 'Zip'),
      country: headers.findIndex(h => h && h.toString().trim() === 'Country'),
      phone1: headers.findIndex(h => h && h.toString().trim() === 'Phone 1'),
      phone2: headers.findIndex(h => h && h.toString().trim() === 'Phone 2'),
      email1: headers.findIndex(h => h && h.toString().trim() === 'Email 1'),
      email2: headers.findIndex(h => h && h.toString().trim() === 'Email 2'),
      notes: headers.findIndex(h => h && h.toString().trim() === 'Notes'),
      tags: headers.findIndex(h => h && h.toString().trim() === 'Tags'),
      archived: headers.findIndex(h => h && h.toString().trim() === 'Archived'),
      classification: headers.findIndex(h => h && h.toString().trim() === 'Classification')
    };

    if (colMap.crmId === -1 || colMap.crmName === -1) {
      // Log available headers for debugging
      console.warn('⚠️ Contacts Export: Missing required columns. Available headers:', headers.filter(h => h).slice(0, 20));
      console.warn('Looking for columns containing "crm" or "name":', headers.filter(h => h && (h.toString().toLowerCase().includes('crm') || h.toString().toLowerCase().includes('name'))).map((h, i) => `${i}: "${h}"`));
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
        
        const classificationLower = classification.toLowerCase();
        // Set ICP status: residential accounts default to N/A
        const icpStatus = classificationLower === 'residential' ? 'na' : 'required';
        const icpRequired = classificationLower !== 'residential';
        
        accountsMap.set(crmId, {
          id: accountId, // Stable ID for merging
          lmn_crm_id: crmId, // Original LMN ID for future lookups
          name: crmName,
          account_type: type.toLowerCase(), // lead, client, other
          classification: classificationLower,
          status: archived ? 'archived' : 'active',
          archived: archived, // Boolean field for consistency
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
          source: 'lmn_contacts_export',
          created_date: new Date().toISOString(),
          // ICP status: residential defaults to N/A
          icp_status: icpStatus,
          icp_required: icpRequired,
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
        // Preserve Contact ID with prefix (e.g., "P2357388" -> "p2357388")
        // Normalize to lowercase for consistency
        const contactIdRaw = row[colMap.contactId]?.trim();
        const contactId = contactIdRaw ? contactIdRaw.toLowerCase() : null;
        const primaryContact = row[colMap.primaryContact]?.trim().toLowerCase() === 'true';
        const email1 = row[colMap.email1]?.trim() || '';
        const email2 = row[colMap.email2]?.trim() || '';
        
        // Ensure contact always has a unique, stable ID based on LMN Contact ID
        const stableContactId = contactId ? `lmn-contact-${contactId}` : `lmn-contact-${crmId}-${rowNum}`;
        const accountId = `lmn-account-${crmId}`;
        
        const contactArchived = row[colMap.archived]?.trim().toLowerCase() === 'true';
        
        contactsList.push({
          id: stableContactId, // Stable ID for merging
          lmn_contact_id: contactId, // Original LMN Contact ID for future lookups (normalized to lowercase)
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
















