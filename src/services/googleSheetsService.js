/**
 * Google Sheets API Service
 * Reads data from your Google Sheet and converts it to CRM entities
 */

// Google Sheets API configuration
const GOOGLE_SHEET_ID = '193wKTGmz1zvWud05U1rCY9SysGQAeYc2KboO6_JjrJs';
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';
const WEB_APP_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL || '';

/**
 * Fetch data from a specific sheet/tab
 * If no API key, tries to use public CSV export as fallback
 */
async function fetchSheetData(sheetName) {
  // If API key is available, use Google Sheets API
  if (API_KEY) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`;
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
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    console.log(`Fetching ${sheetName} from Google Sheet...`);
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${sheetName} CSV: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const parsed = parseCSV(csvText);
    console.log(`✅ Loaded ${parsed.length} rows from ${sheetName} tab`);
    return parsed;
  } catch (error) {
    console.error(`❌ Error fetching ${sheetName} via CSV:`, error);
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
          revenue_segment: 'smb', // Default
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
      }
    });
  } catch (error) {
    // Imported Accounts tab might not exist yet, that's okay
    console.log('No Imported Accounts tab found (this is normal if no imports have been done yet)');
  }
  
  return Array.from(accountMap.values());
}

/**
 * Parse imported accounts from "Imported Accounts" tab
 */
async function parseImportedAccounts() {
  const rows = await fetchSheetData('Imported Accounts');
  if (!rows || rows.length < 2) return [];
  
  const headers = rows[0];
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
          'Annual Revenue': 'annual_revenue',
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
        if (fieldName === 'annual_revenue' || fieldName === 'organization_score') {
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
  for (let colIdx of contactColumns) {
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
      for (let colIdx of contactColumns) {
        const value = (row[colIdx] || '').toString().trim();
        if (value) {
          contactData[colIdx][fieldName] = value;
        }
      }
    }
  }
  
  // Build contact objects
  let contactIndex = 1;
  for (let colIdx of contactColumns) {
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
async function parseImportedContacts() {
  const rows = await fetchSheetData('Imported Contacts');
  if (!rows || rows.length < 2) return [];
  
  const headers = rows[0];
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
    }
  }
  
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
        } else if (fieldName === 'archived' || fieldName === 'exclude_stats') {
          estimate[fieldName] = value === 'TRUE' || value === true || value === 'true';
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
    
    for (let category of categories) {
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
  let quarterlySteps = [];
  let connectionIdeas = [];
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
 * Write data to Google Sheets via Apps Script Web App
 * This allows us to write data without OAuth on the frontend
 */
export async function writeToGoogleSheet(entityType, records) {
  const webAppUrl = import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL || '';
  if (!webAppUrl) {
    console.warn('Google Sheets Web App URL not configured. Data will not be saved to sheet.');
    console.warn('Please set VITE_GOOGLE_SHEETS_WEB_APP_URL in your environment variables.');
    return { success: false, error: 'Web App URL not configured' };
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: 'No records to write' };
  }

  try {
    console.log(`📤 Sending ${records.length} ${entityType} records to Google Sheets...`);
    const payload = {
      action: 'upsert',
      entityType: entityType,
      records: records
    };
    console.log(`📤 Payload preview:`, {
      action: payload.action,
      entityType: payload.entityType,
      recordCount: payload.records.length,
      firstRecordKeys: payload.records[0] ? Object.keys(payload.records[0]).slice(0, 5) : []
    });
    
    // Use text/plain to avoid CORS preflight (Google Apps Script handles this better)
    // Add timeout for large batches (Google Apps Script has 6 minute execution limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
    
    try {
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow', // Important: follow redirects
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP error response:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
      }

      const result = await response.json();
      console.log(`📥 Response result:`, result);
    
    if (result.success) {
      console.log(`✅ Successfully wrote ${result.result.total} ${entityType} to Google Sheet (${result.result.created} created, ${result.result.updated} updated)`);
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
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error(`❌ Timeout writing ${entityType} to Google Sheet (took longer than 5 minutes)`);
        return { success: false, error: 'Request timeout - Google Apps Script may be processing a large batch. Try importing in smaller chunks.' };
      }
      console.error(`❌ Error writing ${entityType} to Google Sheet:`, error);
      return { success: false, error: error.message };
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

