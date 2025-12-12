/**
 * LMN (golmn.com) CSV Parser
 * Parses leads CSV and creates Accounts and Contacts
 */

import { parseCSV, parseCurrency, parseDate } from './csvParser';

/**
 * Parse LMN CSV data into accounts and contacts
 * 
 * Expected CSV columns from LMN:
 * - Lead Name (becomes Account)
 * - First Name (Contact)
 * - Last Name (Contact)
 * - Email, Phone, Address, etc.
 * 
 * Returns: { accounts: [], contacts: [], stats: {} }
 */
export function parseLmnCsv(csvText) {
  try {
    const rows = parseCSV(csvText);
    
    if (!rows || rows.length < 2) {
      return { accounts: [], contacts: [], stats: { error: 'Empty or invalid CSV' } };
    }

    const headers = rows[0];
    
    // Validate headers is an array
    if (!Array.isArray(headers) || headers.length === 0) {
      return { accounts: [], contacts: [], stats: { error: 'Invalid CSV format - no headers found' } };
    }

    const dataRows = rows.slice(1);

    // Find column indices
    const columnMap = mapColumns(headers);
  
  if (!columnMap.leadName) {
    return { 
      accounts: [], 
      contacts: [], 
      stats: { error: 'Missing "Lead Name" column. Required for account creation.' }
    };
  }

  // Group contacts by account (Lead Name)
  const accountsMap = new Map();
  const contactsList = [];
  const errors = [];
  let rowNumber = 1; // Start at 1 (after header)

  for (const row of dataRows) {
    rowNumber++;
    
    try {
      const leadName = row[columnMap.leadName]?.trim();
      const firstName = row[columnMap.firstName]?.trim();
      const lastName = row[columnMap.lastName]?.trim();

      // Skip rows without a lead name
      if (!leadName) {
        errors.push(`Row ${rowNumber}: Missing Lead Name, skipped`);
        continue;
      }

      // Create or get account
      if (!accountsMap.has(leadName)) {
        accountsMap.set(leadName, {
          id: `lmn-account-${accountsMap.size + 1}`,
          name: leadName,
          account_type: 'prospect', // Default to prospect
          status: 'active',
          revenue_segment: 'smb',
          source: 'lmn_import',
          notes: `Imported from LMN on ${new Date().toLocaleDateString()}`,
          created_date: new Date().toISOString(),
          // Optional fields from CSV
          website: row[columnMap.website]?.trim() || '',
          phone: row[columnMap.phone]?.trim() || row[columnMap.phone1]?.trim() || '',
          address: buildAddress(row, columnMap),
          industry: row[columnMap.industry]?.trim() || '',
          annual_revenue: columnMap.revenue ? parseCurrency(row[columnMap.revenue]) : null
        });
      }

      // Create contact if we have name information
      if (firstName || lastName) {
        const account = accountsMap.get(leadName);
        
        contactsList.push({
          id: `lmn-contact-${contactsList.length + 1}`,
          account_id: account.id,
          account_name: leadName,
          first_name: firstName || '',
          last_name: lastName || '',
          position: row[columnMap.position]?.trim() || '',
          
          // Billing contact
          billing_contact: parseBoolean(row[columnMap.billingContact]),
          
          // Email fields
          email: row[columnMap.email]?.trim() || row[columnMap.email1]?.trim() || '',
          email_1: row[columnMap.email1]?.trim() || '',
          email_2: row[columnMap.email2]?.trim() || '',
          
          // Phone fields
          phone: row[columnMap.phone1]?.trim() || row[columnMap.phone]?.trim() || '',
          phone_1: row[columnMap.phone1]?.trim() || row[columnMap.phone]?.trim() || '',
          phone_2: row[columnMap.phone2]?.trim() || '',
          
          // Communication preferences
          do_not_email: parseBoolean(row[columnMap.doNotEmail]),
          do_not_mail: parseBoolean(row[columnMap.doNotMail]),
          do_not_call: parseBoolean(row[columnMap.doNotCall]),
          send_sms: row[columnMap.sendSms]?.trim() || 'do_not_sms', // Phone 1, Phone 2, or Do not SMS
          
          // Notes
          notes: row[columnMap.notes]?.trim() || `Imported from LMN on ${new Date().toLocaleDateString()}`,
          
          // System fields
          title: row[columnMap.position]?.trim() || '',
          role: determineContactRole(row[columnMap.position]),
          source: 'lmn_import',
          created_date: new Date().toISOString()
        });
      }
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error.message}`);
    }
  }

  const accounts = Array.from(accountsMap.values());
  
  return {
    accounts,
    contacts: contactsList,
    stats: {
      totalRows: dataRows.length,
      accountsCreated: accounts.length,
      contactsCreated: contactsList.length,
      errors: errors.length > 0 ? errors : null,
      averageContactsPerAccount: accounts.length > 0 
        ? (contactsList.length / accounts.length).toFixed(1) 
        : 0
    }
  };
  } catch (error) {
    console.error('Error parsing LMN CSV:', error);
    return {
      accounts: [],
      contacts: [],
      stats: {
        error: `Failed to parse CSV: ${error.message}`
      }
    };
  }
}

/**
 * Map CSV headers to known field names
 * Handles variations in column naming
 */
function mapColumns(headers) {
  const map = {};
  
  // Validate headers is an array
  if (!Array.isArray(headers)) {
    console.error('Headers is not an array:', headers);
    return map;
  }
  
  headers.forEach((header, index) => {
    if (!header) return; // Skip empty headers
    const normalized = header.toString().toLowerCase().trim();
    
    // Lead/Account name
    if (normalized === 'lead name' || normalized === 'leadname' || 
        normalized === 'company' || normalized === 'company name' ||
        normalized === 'account name' || normalized === 'account') {
      map.leadName = index;
    }
    
    // Contact first name
    if (normalized === 'first name' || normalized === 'firstname' || normalized === 'first') {
      map.firstName = index;
    }
    
    // Contact last name
    if (normalized === 'last name' || normalized === 'lastname' || normalized === 'last') {
      map.lastName = index;
    }
    
    // Position (LMN specific)
    if (normalized === 'position' || normalized === 'title' || normalized === 'job title') {
      map.position = index;
    }
    
    // Billing Contact
    if (normalized === 'billing contact') {
      map.billingContact = index;
    }
    
    // Email fields
    if (normalized === 'email' || normalized === 'email address' || normalized === 'e-mail') {
      map.email = index;
      if (!map.email1) map.email1 = index; // Use as Email 1 if not set
    }
    
    if (normalized === 'email 1' || normalized === 'email1') {
      map.email1 = index;
    }
    
    if (normalized === 'email 2' || normalized === 'email2') {
      map.email2 = index;
    }
    
    // Phone fields
    if (normalized === 'phone' || normalized === 'phone number') {
      map.phone = index;
      if (!map.phone1) map.phone1 = index; // Use as Phone 1 if not set
    }
    
    if (normalized === 'phone 1' || normalized === 'phone1') {
      map.phone1 = index;
    }
    
    if (normalized === 'phone 2' || normalized === 'phone2') {
      map.phone2 = index;
    }
    
    // Communication preferences
    if (normalized === 'do not email' || normalized === 'donotemail') {
      map.doNotEmail = index;
    }
    
    if (normalized === 'do not mail' || normalized === 'donotmail') {
      map.doNotMail = index;
    }
    
    if (normalized === 'do not call' || normalized === 'donotcall') {
      map.doNotCall = index;
    }
    
    if (normalized === 'send sms' || normalized === 'sendsms' || normalized === 'sms') {
      map.sendSms = index;
    }
    
    // Address components
    if (normalized === 'address' || normalized === 'street address' || 
        normalized === 'address 1' || normalized === 'address1') {
      map.address = index;
      map.address1 = index;
    }
    
    if (normalized === 'address 2' || normalized === 'address2') {
      map.address2 = index;
    }
    
    if (normalized === 'city') {
      map.city = index;
    }
    
    if (normalized === 'state' || normalized === 'province' || normalized === 'region') {
      map.state = index;
    }
    
    if (normalized === 'zip' || normalized === 'zip code' || normalized === 'postal code' || 
        normalized === 'zipcode' || normalized === 'postalcode') {
      map.zip = index;
    }
    
    if (normalized === 'country') {
      map.country = index;
    }
    
    // Other fields
    if (normalized === 'website' || normalized === 'url' || normalized === 'web') {
      map.website = index;
    }
    
    if (normalized === 'industry' || normalized === 'business type') {
      map.industry = index;
    }
    
    if (normalized === 'revenue' || normalized === 'annual revenue') {
      map.revenue = index;
    }
    
    if (normalized === 'notes' || normalized === 'comments' || normalized === 'description') {
      map.notes = index;
    }
    
    if (normalized === 'linkedin' || normalized === 'linkedin url') {
      map.linkedin = index;
    }
    
    if (normalized === 'source' || normalized === 'lead source') {
      map.source = index;
    }
    
    if (normalized === 'status' || normalized === 'lead status') {
      map.status = index;
    }
  });
  
  return map;
}

/**
 * Build a complete address string from CSV columns
 */
function buildAddress(row, columnMap) {
  const parts = [];
  
  if (columnMap.address !== undefined) {
    const addr = row[columnMap.address]?.trim();
    if (addr) parts.push(addr);
  }
  
  if (columnMap.address2 !== undefined) {
    const addr2 = row[columnMap.address2]?.trim();
    if (addr2) parts.push(addr2);
  }
  
  const cityStateZip = [];
  if (columnMap.city !== undefined) {
    const city = row[columnMap.city]?.trim();
    if (city) cityStateZip.push(city);
  }
  
  if (columnMap.state !== undefined) {
    const state = row[columnMap.state]?.trim();
    if (state) cityStateZip.push(state);
  }
  
  if (columnMap.zip !== undefined) {
    const zip = row[columnMap.zip]?.trim();
    if (zip) cityStateZip.push(zip);
  }
  
  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(', '));
  }
  
  if (columnMap.country !== undefined) {
    const country = row[columnMap.country]?.trim();
    if (country && country.toLowerCase() !== 'usa' && country.toLowerCase() !== 'united states') {
      parts.push(country);
    }
  }
  
  return parts.join(', ');
}

/**
 * Determine contact role based on position
 */
function determineContactRole(position) {
  if (!position) return 'user';
  
  const normalized = position.toLowerCase();
  
  // Decision makers
  if (normalized.includes('owner') || normalized.includes('ceo') || 
      normalized.includes('president') || normalized.includes('cfo') ||
      normalized.includes('coo') || normalized.includes('founder')) {
    return 'decision_maker';
  }
  
  // Managers
  if (normalized.includes('manager') || normalized.includes('director') || 
      normalized.includes('head of') || normalized.includes('vp') ||
      normalized.includes('vice president')) {
    return 'influencer';
  }
  
  // Default
  return 'user';
}

/**
 * Parse boolean values from CSV
 * Handles: true/false, yes/no, 1/0, checked/unchecked, x/-
 */
function parseBoolean(value) {
  if (!value) return false;
  
  const normalized = value.toString().toLowerCase().trim();
  
  // True values
  if (normalized === 'true' || normalized === 'yes' || normalized === '1' || 
      normalized === 'checked' || normalized === 'x' || normalized === 'on') {
    return true;
  }
  
  // False values
  return false;
}

/**
 * Validate imported data before saving
 */
export function validateImportData(accounts, contacts) {
  const errors = [];
  const warnings = [];
  
  // Check for duplicate account names
  const accountNames = new Set();
  accounts.forEach((account, index) => {
    if (!account.name || !account.name.trim()) {
      errors.push(`Account ${index + 1}: Missing name`);
    } else if (accountNames.has(account.name)) {
      warnings.push(`Duplicate account name: "${account.name}"`);
    } else {
      accountNames.add(account.name);
    }
  });
  
  // Check contacts
  contacts.forEach((contact, index) => {
    if (!contact.first_name && !contact.last_name) {
      warnings.push(`Contact ${index + 1}: No name provided`);
    }
    
    if (!contact.email && !contact.phone) {
      warnings.push(`Contact ${index + 1} (${contact.first_name} ${contact.last_name}): No email or phone`);
    }
    
    if (contact.email && !isValidEmail(contact.email)) {
      warnings.push(`Contact ${index + 1}: Invalid email format (${contact.email})`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Simple email validation
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Preview CSV data before import
 */
export function previewLmnCsv(csvText, maxRows = 10) {
  try {
    const rows = parseCSV(csvText);
    
    if (!rows || rows.length < 2) {
      return { headers: [], preview: [], totalRows: 0 };
    }
    
    // Ensure we have valid arrays
    if (!Array.isArray(rows[0])) {
      console.error('First row is not an array:', rows[0]);
      return { headers: [], preview: [], totalRows: 0 };
    }
    
    return {
      headers: rows[0],
      preview: rows.slice(1, maxRows + 1),
      totalRows: rows.length - 1 // Exclude header
    };
  } catch (error) {
    console.error('Error previewing CSV:', error);
    return { headers: [], preview: [], totalRows: 0 };
  }
}












