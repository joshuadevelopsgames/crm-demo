/**
 * Parser for LMN "Leads List.csv" format
 * This is the export with Position, DoNotEmail, DoNotMail, DoNotCall, ReferralSource
 */

import { parseCSV } from './csvParser';

/**
 * Parse Leads List CSV
 * Returns: { contactsData: [], stats: {} }
 */
export function parseLeadsList(csvText) {
  try {
    const rows = parseCSV(csvText);
    
    if (!rows || rows.length < 2) {
      return { contactsData: [], stats: { error: 'Empty or invalid CSV' } };
    }

    const headers = rows[0];
    if (!Array.isArray(headers)) {
      return { contactsData: [], stats: { error: 'Invalid CSV headers' } };
    }

    // Map column indices
    const colMap = {
      leadName: headers.findIndex(h => h === 'Lead Name'),
      firstName: headers.findIndex(h => h === 'First Name'),
      lastName: headers.findIndex(h => h === 'Last Name'),
      position: headers.findIndex(h => h === 'Position'),
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
      type: headers.findIndex(h => h === 'Type'),
      created: headers.findIndex(h => h === 'Created'),
      classification: headers.findIndex(h => h === 'Classification'),
      doNotEmail: headers.findIndex(h => h === 'DoNotEmail'),
      doNotMail: headers.findIndex(h => h === 'DoNotMail'),
      doNotCall: headers.findIndex(h => h === 'DoNotCall'),
      customClientId: headers.findIndex(h => h === 'CustomClientID'),
      referralSource: headers.findIndex(h => h === 'ReferralSource')
    };

    if (colMap.leadName === -1) {
      return { 
        contactsData: [], 
        stats: { error: 'Missing required column: Lead Name' } 
      };
    }

    const contactsData = [];
    let rowNum = 1;

    for (const row of rows.slice(1)) {
      rowNum++;
      
      const leadName = row[colMap.leadName]?.trim();
      const firstName = row[colMap.firstName]?.trim();
      const lastName = row[colMap.lastName]?.trim();
      const email1 = row[colMap.email1]?.trim() || '';
      const email2 = row[colMap.email2]?.trim() || '';
      
      if (!leadName) continue;

      contactsData.push({
        lead_name: leadName,
        first_name: firstName || '',
        last_name: lastName || '',
        position: row[colMap.position]?.trim() || '',
        email_1: email1,
        email_2: email2,
        phone_1: row[colMap.phone1]?.trim() || '',
        phone_2: row[colMap.phone2]?.trim() || '',
        // Communication preferences
        do_not_email: parseYesNo(row[colMap.doNotEmail]),
        do_not_mail: parseYesNo(row[colMap.doNotMail]),
        do_not_call: parseYesNo(row[colMap.doNotCall]),
        // Additional fields
        referral_source: row[colMap.referralSource]?.trim() || '',
        created_date: row[colMap.created]?.trim() || '',
        notes_supplement: row[colMap.notes]?.trim() || '',
        // For matching
        match_key: createMatchKey(firstName, lastName, email1, email2)
      });
    }

    return {
      contactsData,
      stats: {
        totalRows: rows.length - 1,
        contactsFound: contactsData.length,
        source: 'Leads List CSV'
      }
    };
  } catch (error) {
    console.error('Error parsing Leads List:', error);
    return {
      contactsData: [],
      stats: { error: `Failed to parse: ${error.message}` }
    };
  }
}

/**
 * Parse Y/N or blank values
 */
function parseYesNo(value) {
  if (!value) return false;
  const normalized = value.toString().trim().toUpperCase();
  return normalized === 'Y' || normalized === 'YES' || normalized === 'TRUE' || normalized === '1';
}

/**
 * Create match key for finding contacts across both CSVs
 */
function createMatchKey(firstName, lastName, email1, email2) {
  // Try to create a unique key to match contacts
  const parts = [];
  
  if (firstName) parts.push(firstName.toLowerCase().trim());
  if (lastName) parts.push(lastName.toLowerCase().trim());
  if (email1) parts.push(email1.toLowerCase().trim());
  
  return parts.join('|');
}
















