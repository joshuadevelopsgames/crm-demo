/**
 * Google Sheets API Service
 * Reads data from your Google Sheet and converts it to CRM entities
 */

// Google Sheets API configuration
const GOOGLE_SHEET_ID = '1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk'; // CRM Database sheet
const SCORECARD_TEMPLATE_SHEET_ID = '1p_e-nHr2iqQe2WBSEzF5tto66ZdhcuUNhUKcuTi8eQw'; // Primary Scorecard Template Sheet
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';
// Note: WEB_APP_URL and SECRET_TOKEN are now handled server-side via API proxy
// This prevents exposing the secret token to the browser

/**
 * Fetch data from a specific sheet/tab
 * If no API key, tries to use public CSV export as fallback
 */
async function fetchSheetData(sheetName, sheetId = null) {
  const targetSheetId = sheetId || GOOGLE_SHEET_ID;
  
  // If API key is available, use Google Sheets API
  if (API_KEY) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${sheetName}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.values || [];
    } catch (error) {
      console.error(`Error fetching ${sheetName} via API:`, error);
      // Fall through to CSV method
    }
  }
  
  // Fallback: Try public CSV export (requires sheet to be public)
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    console.log(`📥 Fetching ${sheetName} from Google Sheet via CSV...`);
    console.log(`   URL: ${csvUrl}`);
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Failed to fetch ${sheetName} CSV:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 200)
      });
      throw new Error(`Failed to fetch ${sheetName} CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    if (!csvText || csvText.trim().length === 0) {
      console.warn(`⚠️ Empty response for ${sheetName} - sheet might not exist or be empty`);
      return [];
    }
    
    const parsed = parseCSV(csvText);
    console.log(`✅ Loaded ${parsed.length} rows from ${sheetName} tab`);
    
    if (parsed.length > 0) {
      console.log(`   First row (headers): ${parsed[0].slice(0, 5).join(', ')}...`);
    }
    
    return parsed;
  } catch (error) {
    console.error(`❌ Error fetching ${sheetName} via CSV:`, error);
    console.error(`   Sheet ID: ${targetSheetId}`);
    console.error(`   Sheet Name: ${sheetName}`);
    console.error(`   Make sure the sheet is public and the tab name matches exactly`);
    return [];
  }
}

/**
 * Parse CSV text into array of arrays
 */
function parseCSV(csvText) {
  const rows = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const row = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    row.push(current); // Add last field
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse scorecard data from the Scorecard tab
 * Returns array of scorecard responses
 * Handles multiple dated entries in the sheet
 * 
 * Sheet format:
 * - Row 1: Headers (Scorecard | Data | Score | Pass/Fail)
 * - Row 2+: Date entries (Date: | date | score | PASS/FAIL) OR (date | score | PASS)
 * - Then sections, questions, and sub-totals
 */
async function parseScorecards() {
  const rows = await fetchSheetData('Scorecard');
  if (rows.length < 2) return [];
  
  const scorecards = [];
  let currentScorecard = null;
  let currentSection = null;
  
  // Skip header row (row 1)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const [colA, colB, colC, colD] = row || [];
    
    if (!colA || !colA.toString().trim()) continue; // Skip empty rows
    
    const colAStr = colA.toString().trim();
    const colBStr = (colB || '').toString().trim();
    const colCStr = (colC || '').toString().trim();
    const colDStr = (colD || '').toString().trim();
    
    // Check if this is a date row
    // Format 1: "Date:" in colA, date in colB, score in colC, pass/fail in colD
    // Format 2: Date in colA, score in colB, pass/fail in colC
    const isDateRow1 = colAStr === 'Date:' && colBStr && (colCStr || colDStr);
    const isDateRow2 = !colAStr.includes(':') && !colBStr && colCStr && (
      colCStr === 'PASS' || colCStr === 'FAIL' || !isNaN(parseInt(colCStr))
    );
    const isDateRow3 = colAStr && !colBStr && !colCStr && !colDStr && (
      colAStr.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)/) ||
      !isNaN(new Date(colAStr).getTime())
    );
    
    if (isDateRow1 || isDateRow2 || isDateRow3) {
      // Save previous scorecard if exists
      if (currentScorecard && currentScorecard.responses.length > 0) {
        scorecards.push(currentScorecard);
      }
      
      // Parse date and score based on format
      let dateStr, score, passFail;
      
      if (isDateRow1) {
        // Format: "Date:" | "January 1, 2025" | "90" | "PASS"
        dateStr = colBStr;
        score = colCStr ? parseInt(colCStr) : null;
        passFail = colDStr === 'PASS' || colDStr === 'FAIL' ? colDStr : null;
      } else if (isDateRow2) {
        // Format: "January 1, 2025" | "90" | "PASS"
        dateStr = colAStr;
        score = colBStr ? parseInt(colBStr) : null;
        passFail = colCStr === 'PASS' || colCStr === 'FAIL' ? colCStr : null;
      } else {
        // Format: "January 1, 2025" (date only, score/pass in next row)
        dateStr = colAStr;
        score = null;
        passFail = null;
        
        // Check next row for score/pass
        if (i + 1 < rows.length) {
          const nextRow = rows[i + 1];
          const [nextA, nextB, nextC] = nextRow || [];
          if (nextB && !isNaN(parseInt(nextB))) {
            score = parseInt(nextB);
            passFail = nextC === 'PASS' || nextC === 'FAIL' ? nextC : null;
            i++; // Skip next row as it's part of date entry
          }
        }
      }
      
      currentScorecard = {
        id: `scorecard-${scorecards.length + 1}`,
        scorecard_date: parseDate(dateStr),
        normalized_score: score,
        is_pass: passFail === 'PASS',
        total_score: score,
        responses: [],
        section_scores: {},
        template_name: 'ICP Weighted Scorecard',
        completed_date: parseDate(dateStr),
        completed_by: 'sheet-import',
        account_id: null // Will need to be set if account is known
      };
      currentSection = null;
      continue;
    }
    
    // Skip if no active scorecard
    if (!currentScorecard) continue;
    
    // Section headers (has text in A, typically empty B/C/D)
    if (colAStr && !colBStr && !colCStr && colAStr !== 'Sub-total' && 
        colAStr !== 'Total Score' && colAStr !== 'Normalized Score (out of 100)' &&
        !colAStr.match(/^\d+$/) && // Not just a number
        !isNaN(new Date(colAStr).getTime()) === false) { // Not a date
      currentSection = colAStr;
      if (!currentScorecard.section_scores[currentSection]) {
        currentScorecard.section_scores[currentSection] = 0;
      }
      continue;
    }
    
    // Questions (has question text in A, answer in B, score in C)
    if (colAStr && colBStr && colCStr && 
        colAStr !== 'Sub-total' && colAStr !== 'Total Score' && 
        colAStr !== 'Normalized Score (out of 100)' &&
        !isNaN(parseInt(colCStr))) {
      const score = parseInt(colCStr) || 0;
      const answer = parseAnswer(colBStr);
      
      currentScorecard.responses.push({
        question_text: colAStr,
        answer: answer,
        answer_text: colBStr, // Keep original answer text
        weight: 1,
        weighted_score: score,
        section: currentSection || 'Other'
      });
      
      // Track section scores
      const section = currentSection || 'Other';
      if (!currentScorecard.section_scores[section]) {
        currentScorecard.section_scores[section] = 0;
      }
      currentScorecard.section_scores[section] += score;
      continue;
    }
    
    // Sub-total row (Sub-total | total | ...)
    if (colAStr === 'Sub-total' && colBStr) {
      const subTotal = parseInt(colBStr) || 0;
      if (currentSection && currentScorecard.section_scores[currentSection] !== subTotal) {
        // Use sheet value as source of truth
        currentScorecard.section_scores[currentSection] = subTotal;
      }
      continue;
    }
    
    // Total Score row
    if (colAStr === 'Total Score' && colBStr) {
      currentScorecard.total_score = parseInt(colBStr) || 0;
      continue;
    }
    
    // Normalized Score row
    if (colAStr === 'Normalized Score (out of 100)' && colBStr) {
      currentScorecard.normalized_score = parseInt(colBStr) || 0;
      continue;
    }
  }
  
  // Add last scorecard
  if (currentScorecard && currentScorecard.responses.length > 0) {
    scorecards.push(currentScorecard);
  }
  
  return scorecards;
}

/**
 * Parse accounts from Company Contacts tab and Imported Accounts tab
 * Extracts unique accounts from contacts data and merges with imported accounts
 */
async function parseAccounts() {
  const contacts = await parseContacts();
  const accountMap = new Map();
  
  // Extract unique accounts from contacts
  contacts.forEach(contact => {
    if (contact.account_id && contact.account_name) {
      if (!accountMap.has(contact.account_id)) {
        accountMap.set(contact.account_id, {
          id: contact.account_id,
          name: contact.account_name,
          account_type: 'customer', // Default
          status: 'active', // Default
          revenue_segment: 'C', // Default
          organization_score: null,
          last_interaction_date: null,
          renewal_date: null
        });
      }
    }
  });
  
  // Also parse imported accounts tab if it exists
  try {
    const importedAccounts = await parseImportedAccounts();
    console.log(`📊 Merging ${importedAccounts.length} imported accounts with ${accountMap.size} accounts from contacts...`);
    
    importedAccounts.forEach(account => {
      // Use lmn_crm_id or id as key for upsert
      const key = account.lmn_crm_id || account.id;
      if (key) {
        // If account already exists, merge data (imported takes precedence)
        if (accountMap.has(key)) {
          accountMap.set(key, { ...accountMap.get(key), ...account });
        } else {
          accountMap.set(key, account);
        }
      } else {
        console.warn('⚠️ Imported account missing ID (lmn_crm_id or id):', account.name || 'Unknown');
      }
    });
    
    console.log(`✅ Total accounts after merge: ${accountMap.size}`);
  } catch (error) {
    // Imported Accounts tab might not exist yet, that's okay
    console.log('ℹ️ No Imported Accounts tab found (this is normal if no imports have been done yet)');
    console.log('   Error:', error.message);
  }
  
  const finalAccounts = Array.from(accountMap.values());
  console.log(`📊 parseAccounts() returning ${finalAccounts.length} total accounts`);
  return finalAccounts;
}

/**
 * Parse accounts from "All Data" tab as fallback
 */
async function parseAccountsFromAllData() {
  console.log('📊 Parsing accounts from "All Data" tab (fallback)...');
  try {
    const rows = await fetchSheetData('All Data');
    console.log(`   Fetched ${rows?.length || 0} rows from "All Data" tab`);
    
    if (!rows || rows.length < 2) {
      console.warn('⚠️ All Data tab has less than 2 rows');
      return [];
    }
  
  const headers = rows[0];
  const accountMap = new Map();
  
  // Extract unique accounts from All Data tab
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const accountId = row[headers.indexOf('LMN CRM ID')] || row[headers.indexOf('Account ID')];
    if (accountId && !accountMap.has(accountId)) {
      const account = {
        id: row[headers.indexOf('Account ID')] || accountId,
        lmn_crm_id: accountId,
        name: row[headers.indexOf('Account Name')] || '',
        account_type: row[headers.indexOf('Account Type')] || '',
        status: row[headers.indexOf('Status')] || 'active',
        classification: row[headers.indexOf('Classification')] || '',
        revenue_segment: row[headers.indexOf('Revenue Segment')] || '',
        organization_score: row[headers.indexOf('Organization Score')] || null,
        tags: row[headers.indexOf('Account Tags')] || '',
        address_1: row[headers.indexOf('Account Address 1')] || '',
        address_2: row[headers.indexOf('Account Address 2')] || '',
        city: row[headers.indexOf('Account City')] || '',
        state: row[headers.indexOf('Account State')] || '',
        postal_code: row[headers.indexOf('Account Postal Code')] || '',
        country: row[headers.indexOf('Account Country')] || '',
        source: row[headers.indexOf('Account Source')] || '',
        created_date: row[headers.indexOf('Account Created Date')] || '',
        last_interaction_date: row[headers.indexOf('Last Interaction Date')] || '',
        renewal_date: row[headers.indexOf('Renewal Date')] || '',
        archived: row[headers.indexOf('Account Archived')] || false
      };
      
      // Parse tags if it's a string
      if (typeof account.tags === 'string' && account.tags) {
        account.tags = account.tags.split(',').map(t => t.trim()).filter(Boolean);
      }
      
      accountMap.set(accountId, account);
    }
  }
  
    const accounts = Array.from(accountMap.values());
    console.log(`✅ Parsed ${accounts.length} unique accounts from "All Data" tab`);
    return accounts;
  } catch (error) {
    console.error('❌ Error parsing accounts from "All Data" tab:', error);
    return [];
  }
}

/**
 * Parse imported accounts from "Imported Accounts" tab
 * Falls back to "All Data" tab if individual tab is empty
 */
async function parseImportedAccounts() {
  console.log('📊 Parsing Imported Accounts...');
  const rows = await fetchSheetData('Imported Accounts');
  console.log(`   Fetched ${rows?.length || 0} rows from Imported Accounts tab`);
  
  // Check if we have less than 2 rows (header + at least 1 data row)
  if (!rows || rows.length === 0 || rows.length < 2) {
    console.warn('⚠️ Imported Accounts tab is empty or has less than 2 rows');
    console.log('   🔄 Trying fallback: reading from "All Data" tab...');
    try {
      // Fallback to All Data tab
      const fallbackAccounts = await parseAccountsFromAllData();
      if (fallbackAccounts.length > 0) {
        console.log(`   ✅ Fallback successful: Found ${fallbackAccounts.length} accounts in "All Data" tab`);
        return fallbackAccounts;
      } else {
        console.warn('   ⚠️ Fallback also returned no accounts');
        return [];
      }
    } catch (error) {
      console.error('   ❌ Error reading from "All Data" tab fallback:', error);
      return [];
    }
  }
  
  const headers = rows[0];
  console.log(`   Headers found: ${headers.slice(0, 5).join(', ')}...`);
  const accounts = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const account = {};
    headers.forEach((header, index) => {
      const value = row[index];
      if (value !== undefined && value !== '') {
        // Map header names to field names
        const fieldMap = {
          'ID': 'id',
          'LMN CRM ID': 'lmn_crm_id',
          'Name': 'name',
          'Account Type': 'account_type',
          'Status': 'status',
          'Classification': 'classification',
          'Revenue Segment': 'revenue_segment',
          'Organization Score': 'organization_score',
          'Tags': 'tags',
          'Address 1': 'address_1',
          'Address 2': 'address_2',
          'City': 'city',
          'State': 'state',
          'Postal Code': 'postal_code',
          'Country': 'country',
          'Source': 'source',
          'Created Date': 'created_date',
          'Last Interaction Date': 'last_interaction_date',
          'Renewal Date': 'renewal_date',
          'Archived': 'archived'
        };
        
        const fieldName = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_');
        
        // Parse special types
        if (fieldName === 'organization_score') {
          account[fieldName] = value ? parseFloat(value) : null;
        } else if (fieldName === 'archived') {
          account[fieldName] = value === 'TRUE' || value === true || value === 'true';
        } else if (fieldName === 'tags' && typeof value === 'string') {
          account[fieldName] = value.split(',').map(t => t.trim()).filter(Boolean);
        } else {
          account[fieldName] = value;
        }
      }
    });
    
    if (account.id || account.lmn_crm_id) {
      accounts.push(account);
    }
  }
  
  console.log(`✅ Parsed ${accounts.length} accounts from Imported Accounts tab`);
  return accounts;
}

/**
 * Parse contacts from Company Contacts tab and Imported Contacts tab
 * Merges both sources
 */
async function parseContacts() {
  const contactsFromTemplate = await parseContactsFromTemplate();
  
  // Also parse imported contacts tab if it exists
  try {
    const importedContacts = await parseImportedContacts();
    // Merge: imported contacts take precedence (they have more complete data)
    const contactMap = new Map();
    
    // Helper function to create a consistent merge key
    // Priority: lmn_contact_id > email+name combination > id
    const getMergeKey = (contact) => {
      // Prefer lmn_contact_id if available (most reliable for imported contacts)
      if (contact.lmn_contact_id) {
        return `lmn_${contact.lmn_contact_id}`;
      }
      // Use email+name combination for matching across sources
      const email = (contact.email || '').toLowerCase().trim();
      const firstName = (contact.first_name || '').toLowerCase().trim();
      const lastName = (contact.last_name || '').toLowerCase().trim();
      if (email && (firstName || lastName)) {
        return `email_${email}_${firstName}_${lastName}`;
      }
      // Fallback to id (but this won't match across sources)
      return contact.id || `fallback_${Math.random()}`;
    };
    
    // Add template contacts first
    contactsFromTemplate.forEach(contact => {
      const key = getMergeKey(contact);
      if (key) contactMap.set(key, contact);
    });
    
    // Merge imported contacts: match by email+name, then merge data
    importedContacts.forEach(importedContact => {
      const importedKey = getMergeKey(importedContact);
      
      // Try to find matching template contact by email+name
      const email = (importedContact.email || '').toLowerCase().trim();
      const firstName = (importedContact.first_name || '').toLowerCase().trim();
      const lastName = (importedContact.last_name || '').toLowerCase().trim();
      const emailNameKey = email && (firstName || lastName) 
        ? `email_${email}_${firstName}_${lastName}` 
        : null;
      
      // Check if we have a template contact with the same email+name
      let existingContact = null;
      if (emailNameKey) {
        // Look for existing contact by email+name key
        for (const [key, contact] of contactMap.entries()) {
          if (key === emailNameKey || key.startsWith(`email_${email}_`)) {
            existingContact = contact;
            break;
          }
        }
      }
      
      if (existingContact) {
        // Merge: imported contact data takes precedence, but preserve template contact's id if it's not an auto-generated one
        const mergedContact = {
          ...existingContact,
          ...importedContact,
          // Preserve template contact's id only if it's not auto-generated (contact-1, contact-2, etc.)
          id: existingContact.id && !existingContact.id.startsWith('contact-') 
            ? existingContact.id 
            : importedContact.id || importedContact.lmn_contact_id || existingContact.id
        };
        // Update the map with merged contact using the imported key (lmn_contact_id if available)
        contactMap.delete(emailNameKey);
        contactMap.set(importedKey, mergedContact);
      } else {
        // New contact, add it
        contactMap.set(importedKey, importedContact);
      }
    });
    
    return Array.from(contactMap.values());
  } catch (error) {
    // Imported Contacts tab might not exist yet, that's okay
    console.log('No Imported Contacts tab found, using template contacts only');
    return contactsFromTemplate;
  }
}

/**
 * Parse contacts from Company Contacts tab (template format)
 * 
 * Sheet structure:
 * - Row 1: Empty | "Contact 1" | "Contact 2" | "Contact 3" | etc.
 * - Row 2+: "Position" | value | value | value
 *           "Phone" | value | value | value
 *           "Email" | value | value | value
 *           etc.
 * - This is a template with columns for each contact
 */
async function parseContactsFromTemplate() {
  const rows = await fetchSheetData('Company Contacts');
  if (rows.length < 2) return [];
  
  const contacts = [];
  const headers = rows[0] || [];
  
  // Extract contact column indices (Contact 1, Contact 2, etc.)
  const contactColumns = [];
  for (let colIdx = 1; colIdx < headers.length; colIdx++) {
    const header = (headers[colIdx] || '').toString().trim();
    if (header.toLowerCase().startsWith('contact')) {
      contactColumns.push(colIdx);
    }
  }
  
  if (contactColumns.length === 0) return [];
  
  // Build contact data by row type
  const contactData = {};
  for (const colIdx of contactColumns) {
    contactData[colIdx] = {};
  }
  
  // Parse rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowType = (row[0] || '').toString().trim().toLowerCase();
    
    if (!rowType) continue;
    
    // Map row types to contact fields
    let fieldName = null;
    if (rowType === 'position') fieldName = 'title';
    else if (rowType === 'phone') fieldName = 'phone';
    else if (rowType === 'email') fieldName = 'email';
    else if (rowType === 'personal details') fieldName = 'preferences';
    else if (rowType.includes('interests') || rowType.includes('follows')) fieldName = 'interests';
    else if (rowType.includes('mutual connections')) fieldName = 'mutual_connections';
    
    if (fieldName) {
      for (const colIdx of contactColumns) {
        const value = (row[colIdx] || '').toString().trim();
        if (value) {
          contactData[colIdx][fieldName] = value;
        }
      }
    }
  }
  
  // Build contact objects
  let contactIndex = 1;
  for (const colIdx of contactColumns) {
    const data = contactData[colIdx];
    if (Object.keys(data).length > 0) {
      // Try to extract name from email or title
      const email = data.email || '';
      const nameParts = email.split('@')[0]?.split('.') || [];
      const firstName = nameParts[0] || `Contact ${contactIndex}`;
      const lastName = nameParts[1] || '';
      
      contacts.push({
        id: `contact-${contactIndex}`,
        first_name: firstName.charAt(0).toUpperCase() + firstName.slice(1),
        last_name: lastName.charAt(0).toUpperCase() + lastName.slice(1),
        email: data.email || '',
        phone: data.phone || '',
        title: data.title || '',
        account_id: '', // Will need account context
        account_name: '', // Will need account context
        role: 'user',
        linkedin_url: '',
        preferences: data.preferences || '',
        interests: data.interests || '',
        mutual_connections: data.mutual_connections || ''
      });
      contactIndex++;
    }
  }
  
  return contacts;
}

/**
 * Parse imported contacts from "Imported Contacts" tab
 */
/**
 * Parse contacts from "All Data" tab as fallback
 */
async function parseContactsFromAllData() {
  console.log('📊 Parsing contacts from "All Data" tab (fallback)...');
  try {
    const rows = await fetchSheetData('All Data');
    console.log(`   Fetched ${rows?.length || 0} rows from "All Data" tab`);
    
    if (!rows || rows.length < 2) {
      console.warn('⚠️ All Data tab has less than 2 rows');
      return [];
    }
  
  const headers = rows[0];
  const contactMap = new Map();
  
  // Extract unique contacts from All Data tab
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const contactId = row[headers.indexOf('LMN Contact ID')] || row[headers.indexOf('Contact ID')];
    if (contactId && !contactMap.has(contactId)) {
      const contact = {
        id: row[headers.indexOf('Contact ID')] || contactId,
        lmn_contact_id: contactId,
        account_id: row[headers.indexOf('Account ID (Contact)')] || row[headers.indexOf('LMN CRM ID')] || '',
        account_name: row[headers.indexOf('Account Name (Contact)')] || row[headers.indexOf('Account Name')] || '',
        first_name: row[headers.indexOf('First Name')] || '',
        last_name: row[headers.indexOf('Last Name')] || '',
        email: row[headers.indexOf('Email')] || row[headers.indexOf('Email 1')] || '',
        email_1: row[headers.indexOf('Email 1')] || '',
        email_2: row[headers.indexOf('Email 2')] || '',
        phone: row[headers.indexOf('Phone')] || row[headers.indexOf('Phone 1')] || '',
        phone_1: row[headers.indexOf('Phone 1')] || '',
        phone_2: row[headers.indexOf('Phone 2')] || '',
        position: row[headers.indexOf('Position')] || '',
        title: row[headers.indexOf('Title')] || '',
        role: row[headers.indexOf('Role')] || '',
        primary_contact: row[headers.indexOf('Primary Contact')] || false,
        do_not_email: row[headers.indexOf('Do Not Email')] || false,
        do_not_mail: row[headers.indexOf('Do Not Mail')] || false,
        do_not_call: row[headers.indexOf('Do Not Call')] || false,
        referral_source: row[headers.indexOf('Referral Source')] || '',
        notes: row[headers.indexOf('Contact Notes')] || '',
        source: row[headers.indexOf('Contact Source')] || '',
        created_date: row[headers.indexOf('Contact Created Date')] || '',
        archived: row[headers.indexOf('Contact Archived')] || false
      };
      
      contactMap.set(contactId, contact);
    }
  }
  
    const contacts = Array.from(contactMap.values());
    console.log(`✅ Parsed ${contacts.length} unique contacts from "All Data" tab`);
    return contacts;
  } catch (error) {
    console.error('❌ Error parsing contacts from "All Data" tab:', error);
    return [];
  }
}

async function parseImportedContacts() {
  console.log('📊 Parsing Imported Contacts...');
  const rows = await fetchSheetData('Imported Contacts');
  console.log(`   Fetched ${rows?.length || 0} rows from Imported Contacts tab`);
  
  // Check if we have less than 2 rows (header + at least 1 data row)
  if (!rows || rows.length === 0 || rows.length < 2) {
    console.warn('⚠️ Imported Contacts tab is empty or has less than 2 rows');
    console.log('   🔄 Trying fallback: reading from "All Data" tab...');
    try {
      // Fallback to All Data tab
      const fallbackContacts = await parseContactsFromAllData();
      if (fallbackContacts.length > 0) {
        console.log(`   ✅ Fallback successful: Found ${fallbackContacts.length} contacts in "All Data" tab`);
        return fallbackContacts;
      } else {
        console.warn('   ⚠️ Fallback also returned no contacts');
        return [];
      }
    } catch (error) {
      console.error('   ❌ Error reading from "All Data" tab fallback:', error);
      return [];
    }
  }
  
  const headers = rows[0];
  console.log(`   Headers found: ${headers.slice(0, 5).join(', ')}...`);
  const contacts = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const contact = {};
    headers.forEach((header, index) => {
      const value = row[index];
      if (value !== undefined && value !== '') {
        // Map header names to field names
        const fieldMap = {
          'ID': 'id',
          'LMN Contact ID': 'lmn_contact_id',
          'Account ID': 'account_id',
          'Account Name': 'account_name',
          'First Name': 'first_name',
          'Last Name': 'last_name',
          'Email': 'email',
          'Email 1': 'email_1',
          'Email 2': 'email_2',
          'Phone': 'phone',
          'Phone 1': 'phone_1',
          'Phone 2': 'phone_2',
          'Position': 'position',
          'Title': 'title',
          'Role': 'role',
          'Primary Contact': 'primary_contact',
          'Do Not Email': 'do_not_email',
          'Do Not Mail': 'do_not_mail',
          'Do Not Call': 'do_not_call',
          'Referral Source': 'referral_source',
          'Notes': 'notes',
          'Source': 'source',
          'Created Date': 'created_date',
          'Archived': 'archived'
        };
        
        const fieldName = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_');
        
        // Parse special types
        if (fieldName === 'primary_contact' || fieldName === 'do_not_email' || 
            fieldName === 'do_not_mail' || fieldName === 'do_not_call' || fieldName === 'archived') {
          contact[fieldName] = value === 'TRUE' || value === true || value === 'true' || value === '1';
        } else {
          contact[fieldName] = value;
        }
      }
    });
    
    if (contact.id || contact.lmn_contact_id || contact.email) {
      contacts.push(contact);
    } else {
      console.warn('⚠️ Contact missing required identifier (id, lmn_contact_id, or email):', contact);
    }
  }
  
  console.log(`✅ Parsed ${contacts.length} contacts from Imported Contacts tab`);
  return contacts;
}

/**
 * Parse imported estimates from "Imported Estimates" tab
 */
async function parseImportedEstimates() {
  const rows = await fetchSheetData('Imported Estimates');
  if (!rows || rows.length < 2) return [];
  
  const headers = rows[0];
  const estimates = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const estimate = {};
    headers.forEach((header, index) => {
      const value = row[index];
      if (value !== undefined && value !== '') {
        const fieldName = header.toLowerCase().replace(/\s+/g, '_');
        
        // Parse numbers
        if (fieldName.includes('price') || fieldName.includes('cost') || 
            fieldName.includes('profit') || fieldName.includes('overhead') ||
            fieldName.includes('breakeven') || fieldName === 'labor_hours' ||
            fieldName === 'confidence_level') {
          estimate[fieldName] = value ? parseFloat(value) : null;
        } else if (fieldName === 'archived') {
          estimate[fieldName] = value === 'TRUE' || value === true || value === 'true';
          // Per spec R10: exclude_stats field is ignored - never used in any system logic
        } else {
          estimate[fieldName] = value;
        }
      }
    });
    
    if (estimate.id || estimate.lmn_estimate_id) {
      estimates.push(estimate);
    }
  }
  
  return estimates;
}

/**
 * Parse imported jobsites from "Imported Jobsites" tab
 */
async function parseImportedJobsites() {
  const rows = await fetchSheetData('Imported Jobsites');
  if (!rows || rows.length < 2) return [];
  
  const headers = rows[0];
  const jobsites = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const jobsite = {};
    headers.forEach((header, index) => {
      const value = row[index];
      if (value !== undefined && value !== '') {
        const fieldName = header.toLowerCase().replace(/\s+/g, '_');
        jobsite[fieldName] = value;
      }
    });
    
    if (jobsite.id || jobsite.lmn_jobsite_id) {
      jobsites.push(jobsite);
    }
  }
  
  return jobsites;
}

/**
 * Parse sales insights from Sales Insights tab
 * 
 * Sheet structure:
 * - Row 1: "Sales Insights" | "Last Updated:" | date
 * - Row 2: "Needs" (Yes/No) | "Pain Points" (Yes/No) | "Buying Motivations" (Yes/No) | "Obstacles / Barriers to Sales" (Yes/No) | "Notes"
 * - Row 3+: Rows with specific items in each category
 * Example: "Consistency & Reliability" | "No" | "Lack of Communication" | "No" | ...
 */
async function parseSalesInsights() {
  const rows = await fetchSheetData('Sales Insights');
  if (rows.length < 3) return [];
  
  const insights = [];
  
  // Find header row (row with "Needs", "Pain Points", etc.)
  let headerRowIdx = 1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0] && (row[0].toString().toLowerCase().includes('needs') || 
        row[0].toString().toLowerCase().includes('pain points'))) {
      headerRowIdx = i;
      break;
    }
  }
  
  const headerRow = rows[headerRowIdx] || [];
  
  // Map column positions to insight types
  const columnMap = {
    needs: null,
    painPoints: null,
    buyingMotivations: null,
    obstacles: null,
    notes: null
  };
  
  for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
    const header = (headerRow[colIdx] || '').toString().toLowerCase();
    if (header.includes('needs') && !header.includes('notes')) columnMap.needs = colIdx;
    else if (header.includes('pain points')) columnMap.painPoints = colIdx;
    else if (header.includes('buying motivations')) columnMap.buyingMotivations = colIdx;
    else if (header.includes('obstacles') || header.includes('barriers')) columnMap.obstacles = colIdx;
    else if (header.includes('notes') || header.includes('elaborate')) columnMap.notes = colIdx;
  }
  
  // Parse data rows
  let insightIndex = 1;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || !row[0].toString().trim()) continue;
    
    const rowLabel = row[0].toString().trim();
    
    // Parse each category
    const categories = [
      { col: columnMap.needs, type: 'need', yesCol: columnMap.needs ? columnMap.needs + 1 : null },
      { col: columnMap.painPoints, type: 'pain_point', yesCol: columnMap.painPoints ? columnMap.painPoints + 1 : null },
      { col: columnMap.buyingMotivations, type: 'opportunity', yesCol: columnMap.buyingMotivations ? columnMap.buyingMotivations + 1 : null },
      { col: columnMap.obstacles, type: 'risk', yesCol: columnMap.obstacles ? columnMap.obstacles + 1 : null }
    ];
    
    for (const category of categories) {
      if (category.col !== null && row[category.col]) {
        const yesValue = category.yesCol ? (row[category.yesCol] || '').toString().trim() : '';
        const isYes = yesValue === 'Yes' || yesValue === 'yes';
        
        // Only create insight if Yes
        if (isYes) {
          const notesCol = columnMap.notes;
          const notes = notesCol && row[notesCol] ? row[notesCol].toString().trim() : '';
          
          insights.push({
            id: `insight-${insightIndex++}`,
            account_id: '', // Will need account context
            insight_type: category.type,
            title: `${rowLabel} - ${category.type.replace('_', ' ')}`,
            content: notes || rowLabel,
            tags: [category.type, rowLabel.toLowerCase().replace(/\s+/g, '_')],
            recorded_by: 'sheet-import',
            recorded_date: new Date().toISOString(),
            related_interaction_id: ''
          });
        }
      }
    }
  }
  
  return insights;
}

/**
 * Parse research notes from Research Notes tab
 * 
 * Sheet structure:
 * - Header: "Research Notes Date", "Person", "Note"
 * - Data rows: date | person | note content
 */
async function parseResearchNotes() {
  const rows = await fetchSheetData('Research Notes');
  if (rows.length < 2) return [];
  
  const notes = [];
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || !row[0].toString().trim()) continue;
    
    const dateStr = (row[0] || '').toString().trim();
    const person = (row[1] || '').toString().trim();
    const noteContent = (row[2] || '').toString().trim();
    
    if (!noteContent) continue;
    
    // Try to extract title from note (first sentence or first 50 chars)
    const title = noteContent.split('.')[0] || noteContent.substring(0, 50);
    
    notes.push({
      id: `note-${i}`,
      account_id: '', // Will need account context
      note_type: 'company_info',
      title: title.length > 50 ? title.substring(0, 50) + '...' : title,
      content: noteContent,
      source_url: '',
      recorded_by: person || 'sheet-import',
      recorded_date: parseDate(dateStr) || new Date().toISOString()
    });
  }
  
  return notes;
}

/**
 * Helper: Parse date string to ISO format
 */
function parseDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Helper: Parse answer value
 */
function parseAnswer(answerStr) {
  if (!answerStr) return 0;
  const str = answerStr.toString().trim();
  if (str === 'Yes' || str === 'yes') return 1;
  if (str === 'No' || str === 'no') return 0;
  const num = parseInt(str);
  return isNaN(num) ? str : num; // Return string if not a number (e.g., "Calgary/Surrounding")
}

/**
 * Parse contact cadence from Contact Cadence tab
 * Maps to Sequence and SequenceEnrollment entities
 * 
 * Sheet structure:
 * - Row 1: "Contact Schedule" header
 * - Row 2: "Cadence", "Activity", "Person Responsible", "Scheduled?"
 * - Rows 3+: Quarterly contacts (Q1 contact 1, Q1 contact 2, etc.)
 * - Then "Connection Ideas:" section with activities
 */
async function parseContactCadence() {
  const rows = await fetchSheetData('Contact Cadence');
  if (rows.length < 2) return { sequences: [], enrollments: [] };
  
  const sequences = [];
  const enrollments = [];
  
  // Look for quarterly contact pattern
  const quarterlySteps = [];
  const connectionIdeas = [];
  let inConnectionIdeas = false;
  
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const [cadence, activity, person, scheduled] = row || [];
    
    if (!cadence || !cadence.toString().trim()) continue;
    
    const cadenceStr = cadence.toString().trim();
    const activityStr = (activity || '').toString().trim();
    
    // Check if we're in "Connection Ideas:" section
    if (cadenceStr === 'Connection Ideas:' || cadenceStr.toLowerCase().includes('connection ideas')) {
      inConnectionIdeas = true;
      continue;
    }
    
    // Quarterly contacts (Q1 contact 1, Q1 contact 2, etc.)
    if (cadenceStr.match(/^Q[1-4]\s+contact\s+\d+$/i)) {
      quarterlySteps.push({
        name: cadenceStr,
        activity: activityStr || '',
        person_responsible: (person || '').toString().trim(),
        scheduled: scheduled === 'Yes' || scheduled === 'yes'
      });
    }
    
    // Connection ideas (activities like Emails, Site Visit, etc.)
    if (inConnectionIdeas && activityStr) {
      connectionIdeas.push({
        activity: activityStr,
        person_responsible: (person || '').toString().trim(),
        scheduled: scheduled === 'Yes' || scheduled === 'yes'
      });
    }
  }
  
  // Create a sequence from quarterly contacts
  if (quarterlySteps.length > 0) {
    sequences.push({
      id: 'quarterly-contact-sequence',
      name: 'Quarterly Contact Cadence',
      description: 'Quarterly contact schedule from Google Sheet',
      client_type: 'general',
      is_active: true,
      steps: quarterlySteps.map((step, index) => ({
        step_number: index + 1,
        step_type: 'contact',
        action_type: step.activity || 'contact',
        delay_days: 0, // Will need to calculate based on quarters
        instructions: step.name,
        person_responsible: step.person_responsible
      }))
    });
  }
  
  // Create a sequence from connection ideas
  if (connectionIdeas.length > 0) {
    sequences.push({
      id: 'connection-ideas-sequence',
      name: 'Connection Ideas',
      description: 'Connection activities and ideas from Google Sheet',
      client_type: 'general',
      is_active: true,
      steps: connectionIdeas.map((idea, index) => ({
        step_number: index + 1,
        step_type: 'activity',
        action_type: idea.activity.toLowerCase().replace(/\s+/g, '_'),
        delay_days: 0,
        instructions: idea.activity,
        person_responsible: idea.person_responsible
      }))
    });
  }
  
  return { sequences, enrollments };
}

/**
 * Parse lookup legend from Lookup Legend tab
 * Maps to reference/lookup values for scorecard questions
 * 
 * Sheet structure:
 * - Header: "Criterion", "Attribute", "Score"
 * - Each row: Question (Criterion) | Answer option (Attribute) | Points (Score)
 * Example: "Client Operations Region" | "Calgary/Surrounding" | "2"
 */
async function parseLookupLegend() {
  const rows = await fetchSheetData('Lookup Legend');
  if (rows.length < 2) return [];
  
  const lookups = [];
  const lookupMap = new Map(); // Group by criterion
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const [criterion, attribute, score] = row || [];
    
    if (!criterion || !criterion.toString().trim()) continue;
    
    const criterionStr = criterion.toString().trim();
    const attributeStr = (attribute || '').toString().trim();
    const scoreStr = (score || '').toString().trim();
    
    if (!attributeStr) continue;
    
    // Group by criterion (question)
    if (!lookupMap.has(criterionStr)) {
      lookupMap.set(criterionStr, {
        id: `lookup-${criterionStr.toLowerCase().replace(/\s+/g, '-')}`,
        category: 'scorecard',
        criterion: criterionStr,
        options: []
      });
    }
    
    const lookup = lookupMap.get(criterionStr);
    lookup.options.push({
      attribute: attributeStr,
      score: parseInt(scoreStr) || 0
    });
  }
  
  // Convert map to array
  lookupMap.forEach((lookup) => {
    lookups.push(lookup);
  });
  
  return lookups;
}

/**
 * Main function to load all data from Google Sheet
 */
export async function loadDataFromGoogleSheet() {
  console.log('🔄 Starting to load data from Google Sheet...');
  try {
    const [scorecards, contacts, insights, notes, accounts, cadence, lookups, estimates, jobsites] = await Promise.all([
      parseScorecards(),
      parseContacts(),
      parseSalesInsights(),
      parseResearchNotes(),
      parseAccounts(),
      parseContactCadence(),
      parseLookupLegend(),
      parseImportedEstimates().catch(() => []),
      parseImportedJobsites().catch(() => [])
    ]);
    
    const result = {
      scorecards,
      contacts,
      insights,
      notes,
      accounts,
      sequences: cadence.sequences,
      sequenceEnrollments: cadence.enrollments,
      lookupValues: lookups,
      estimates: estimates || [],
      jobsites: jobsites || []
    };
    
    console.log('✅ Successfully loaded Google Sheet data:', {
      scorecards: scorecards.length,
      contacts: contacts.length,
      insights: insights.length,
      notes: notes.length,
      accounts: accounts.length,
      sequences: cadence.sequences.length,
      lookups: lookups.length,
      estimates: estimates?.length || 0,
      jobsites: jobsites?.length || 0
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error loading data from Google Sheet:', error);
    return {
      scorecards: [],
      contacts: [],
      insights: [],
      notes: [],
      accounts: [],
      sequences: [],
      sequenceEnrollments: [],
      lookupValues: [],
      estimates: [],
      jobsites: []
    };
  }
}

/**
 * Cache for sheet data
 */
let sheetDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached or fresh data from Google Sheet
 */
export async function getSheetData(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && sheetDataCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return sheetDataCache;
  }
  
  sheetDataCache = await loadDataFromGoogleSheet();
  cacheTimestamp = now;
  
  return sheetDataCache;
}

/**
 * Write data to Google Sheets via backend API proxy
 * The secret token is kept secure on the server side (never exposed to browser)
 */
export async function writeToGoogleSheet(entityType, records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: 'No records to write' };
  }

  try {
    console.log(`📤 Sending ${records.length} ${entityType} records to Google Sheets via secure API...`);
    
    // Call our backend API endpoint (not Google Apps Script directly)
    // The backend will add the secret token server-side
    const response = await fetch('/api/google-sheets/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entityType: entityType,
        records: records
        // Note: Secret token is added by the backend API, never sent from browser
      })
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`❌ API error response:`, errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`📥 Response result:`, result);
    
    if (result.success) {
      console.log(`✅ Successfully wrote ${result.result.total} ${entityType} to Google Sheet (${result.result.created} created, ${result.result.updated} updated)`);
      
      // Verify the write by reading back (optional, can be disabled for performance)
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Verifying write by reading back ${entityType}...`);
        try {
          // Wait a moment for Google Sheets to process
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try to read back the data
          const sheetName = entityType === 'accounts' ? 'Imported Accounts' : 
                           entityType === 'contacts' ? 'Imported Contacts' :
                           entityType === 'estimates' ? 'Imported Estimates' :
                           entityType === 'jobsites' ? 'Imported Jobsites' : '';
          
          if (sheetName) {
            const verifyRows = await fetchSheetData(sheetName);
            const dataRowCount = verifyRows && verifyRows.length > 1 ? verifyRows.length - 1 : 0;
            console.log(`   ✅ Verification: ${dataRowCount} rows found in ${sheetName} tab`);
            
            if (dataRowCount === 0 && entityType === 'accounts' || entityType === 'contacts') {
              console.warn(`   ⚠️ Individual tab is empty, but data should be in "All Data" tab`);
            }
          }
        } catch (verifyError) {
          console.warn('   ⚠️ Could not verify write:', verifyError.message);
        }
      }
      
      // Clear cache to force refresh on next read
      sheetDataCache = null;
      cacheTimestamp = null;
      
      // Also clear the cache in base44Client if it exists
      if (typeof window !== 'undefined' && window.__base44SheetDataCache) {
        window.__base44SheetDataCache = null;
      }
      
      return result;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error(`❌ Error writing ${entityType} to Google Sheet:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Write accounts to Google Sheet
 */
export async function writeAccountsToSheet(accounts) {
  return writeToGoogleSheet('accounts', accounts);
}

/**
 * Write contacts to Google Sheet
 */
export async function writeContactsToSheet(contacts) {
  return writeToGoogleSheet('contacts', contacts);
}

/**
 * Write estimates to Google Sheet
 */
export async function writeEstimatesToSheet(estimates) {
  return writeToGoogleSheet('estimates', estimates);
}

/**
 * Write jobsites to Google Sheet
 */
export async function writeJobsitesToSheet(jobsites) {
  return writeToGoogleSheet('jobsites', jobsites);
}

/**
 * Export all accounts and contacts to Google Sheets
 * Fetches all data from Supabase and writes to Google Sheets
 * This function handles batching to avoid timeouts for large datasets
 */
export async function exportAllDataToGoogleSheet() {
  try {
    console.log('🔄 Starting full data export to Google Sheets...');
    
    // Fetch all accounts from Supabase
    const accountsResponse = await fetch('/api/data/accounts');
    if (!accountsResponse.ok) {
      throw new Error('Failed to fetch accounts');
    }
    const accountsData = await accountsResponse.json();
    const accounts = accountsData.data || [];
    
    console.log(`📊 Found ${accounts.length} accounts`);
    
    // Fetch all contacts from Supabase
    const contactsResponse = await fetch('/api/data/contacts');
    if (!contactsResponse.ok) {
      throw new Error('Failed to fetch contacts');
    }
    const contactsData = await contactsResponse.json();
    const contacts = contactsData.data || [];
    
    console.log(`📊 Found ${contacts.length} contacts`);
    
    // Export in batches to avoid timeout
    const batchSize = 100;
    let accountsExported = 0;
    let contactsExported = 0;
    
    // Export accounts in batches
    if (accounts.length > 0) {
      const totalBatches = Math.ceil(accounts.length / batchSize);
      for (let i = 0; i < accounts.length; i += batchSize) {
        const batch = accounts.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        console.log(`📤 Exporting accounts batch ${batchNumber} of ${totalBatches}...`);
        const result = await writeAccountsToSheet(batch);
        if (result.success) {
          accountsExported += result.result?.total || batch.length;
        } else {
          throw new Error(result.error || 'Failed to export accounts batch');
        }
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < accounts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Export contacts in batches
    if (contacts.length > 0) {
      const totalBatches = Math.ceil(contacts.length / batchSize);
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        console.log(`📤 Exporting contacts batch ${batchNumber} of ${totalBatches}...`);
        const result = await writeContactsToSheet(batch);
        if (result.success) {
          contactsExported += result.result?.total || batch.length;
        } else {
          throw new Error(result.error || 'Failed to export contacts batch');
        }
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('✅ Export complete!', {
      accountsExported,
      contactsExported
    });
    
    return {
      success: true,
      summary: {
        accountsExported,
        contactsExported,
        totalRecords: accountsExported + contactsExported
      }
    };
  } catch (error) {
    console.error('❌ Error exporting data to Google Sheets:', error);
    return {
      success: false,
      error: error.message || 'Failed to export data'
    };
  }
}

/**
 * Parse scorecard template structure from the primary scorecard Google Sheet
 * Extracts questions, sections, weights, and answer types to create a template
 * 
 * Sheet format:
 * - Column A: Scorecard (Question/Section labels)
 * - Column B: Data (Answers - used to determine answer types)
 * - Column C: Score (Points - used to determine weights)
 * - Column D: Pass/Fail
 * 
 * Sections are identified by rows with text in A but empty B/C
 * Questions are identified by rows with text in A, B, and numeric C
 */
export async function parseScorecardTemplateFromSheet() {
  try {
    // Try different possible tab names
    const tabNames = [
      'Copy of ICP Weighted Scorecard - BS',
      'ICP Weighted Scorecard - BS',
      'Scorecard',
      'Sheet1'
    ];
    
    let rows = null;
    for (const tabName of tabNames) {
      rows = await fetchSheetData(tabName, SCORECARD_TEMPLATE_SHEET_ID);
      if (rows && rows.length >= 2) {
        console.log(`✅ Found scorecard template in tab: ${tabName}`);
        break;
      }
    }
    
    if (!rows || rows.length < 2) {
      console.warn('⚠️ Could not find scorecard template in any tab');
      return null;
    }
    
    return parseTemplateStructure(rows);
  } catch (error) {
    console.error('❌ Error parsing scorecard template from sheet:', error);
    return null;
  }
}

/**
 * Parse template structure from sheet rows
 */
function parseTemplateStructure(rows) {
  const questions = [];
  let currentSection = null;
  const sections = new Set();
  
  // Skip header row (row 1)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const [colA, colB, colC, colD] = row || [];
    
    if (!colA || !colA.toString().trim()) continue; // Skip empty rows
    
    const colAStr = colA.toString().trim();
    const colBStr = (colB || '').toString().trim();
    const colCStr = (colC || '').toString().trim();
    
    // Skip date rows
    if (colAStr === 'Date:' || 
        colAStr.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)/) ||
        !isNaN(new Date(colAStr).getTime())) {
      continue;
    }
    
    // Skip total/subtotal rows
    if (colAStr === 'Sub-total' || 
        colAStr === 'Total Score' || 
        colAStr === 'Normalized Score (out of 100)' ||
        colAStr === 'Scorecard' ||
        colAStr === 'Data' ||
        colAStr === 'Score' ||
        colAStr === 'Pass/Fail') {
      continue;
    }
    
    // Section headers (has text in A, typically empty B/C)
    if (colAStr && !colBStr && !colCStr && 
        !colAStr.match(/^\d+$/) && // Not just a number
        isNaN(new Date(colAStr).getTime())) { // Not a date
      currentSection = colAStr;
      sections.add(currentSection);
      continue;
    }
    
    // Questions (has question text in A, answer in B, score in C)
    if (colAStr && colBStr && colCStr && 
        !isNaN(parseInt(colCStr))) {
      const score = parseInt(colCStr) || 0;
      
      // Determine answer type based on answer value
      let answerType = 'yes_no';
      let weight = score;
      
      // If answer is Yes/No, it's yes_no type
      if (colBStr.toLowerCase() === 'yes' || colBStr.toLowerCase() === 'no') {
        answerType = 'yes_no';
        // Weight is the score (since yes=1, no=0, so score = weight * 1)
        weight = score;
      } else if (!isNaN(parseInt(colBStr))) {
        // If answer is a number, it might be a scale
        const answerNum = parseInt(colBStr);
        if (answerNum >= 1 && answerNum <= 5) {
          answerType = 'scale_1_5';
          // Weight = score / max_answer_value
          weight = Math.round(score / 5) || 1;
        } else {
          answerType = 'numeric';
          weight = score;
        }
      } else {
        // Text answer - might be categorical
        // Check if score matches common patterns
        if (score <= 5) {
          answerType = 'yes_no'; // Default to yes_no for small scores
          weight = score;
        } else {
          answerType = 'categorical';
          weight = score;
        }
      }
      
      questions.push({
        question_text: colAStr,
        weight: weight || 1,
        answer_type: answerType,
        section: currentSection || 'Other',
        category: currentSection || 'Other'
      });
    }
  }
  
  // Calculate total possible score
  const totalPossibleScore = questions.reduce((sum, q) => {
    const maxAnswer = q.answer_type === 'yes_no' ? 1 : 
                     q.answer_type === 'scale_1_5' ? 5 : 
                     q.answer_type === 'numeric' ? 10 : 1;
    return sum + (q.weight * maxAnswer);
  }, 0);
  
  return {
    name: 'ICP Weighted Scorecard',
    description: 'Primary scorecard template for Ideal Customer Profile scoring',
    is_active: true,
    is_default: true, // Mark as default template
    pass_threshold: 70,
    total_possible_score: totalPossibleScore,
    questions: questions,
    sections: Array.from(sections)
  };
}

