/**
 * Google Apps Script for LECRM Data Sync
 * 
 * Deploy this script as a Web App to enable writing data to Google Sheets
 * 
 * Setup Instructions:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
 * 2. Go to Extensions → Apps Script
 * 3. Paste this code
 * 4. Set the SECRET_TOKEN in Script Properties (see setup below)
 * 5. Save the project
 * 6. Click "Deploy" → "New deployment"
 * 7. Select type: "Web app"
 * 8. Execute as: "Me"
 * 9. Who has access: "Anyone" (required for CORS, but protected by secret token)
 * 10. Click "Deploy"
 * 11. Copy the Web App URL and add it to your .env file as VITE_GOOGLE_SHEETS_WEB_APP_URL
 * 12. Add the same SECRET_TOKEN to your .env file as VITE_GOOGLE_SHEETS_SECRET_TOKEN
 * 
 * SECURITY SETUP:
 * To set the secret token:
 * 1. In Apps Script editor, go to Project Settings (gear icon)
 * 2. Scroll to "Script Properties"
 * 3. Click "Add script property"
 * 4. Property: SECRET_TOKEN
 * 5. Value: Generate a strong random token (use a password generator, 32+ characters)
 * 6. Click "Save script properties"
 * 
 * IMPORTANT: Use the same token value in your frontend .env file!
 */

const SHEET_ID = '1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk'; // LECRM Database sheet

/**
 * Get the secret token from Script Properties
 * This is more secure than hardcoding it in the script
 */
function getSecretToken() {
  const properties = PropertiesService.getScriptProperties();
  return properties.getProperty('SECRET_TOKEN');
}

/**
 * Validate the request has the correct secret token
 */
function validateRequest(data) {
  const secretToken = getSecretToken();
  
  // If no token is configured, allow requests (for initial setup/testing)
  // Remove this after setting up the token!
  if (!secretToken) {
    Logger.log('WARNING: SECRET_TOKEN not configured in Script Properties. Allowing request.');
    return true;
  }
  
  // Check if token is provided in the request
  const providedToken = data.token || data.authToken;
  
  if (!providedToken) {
    Logger.log('Request rejected: No token provided');
    return false;
  }
  
  if (providedToken !== secretToken) {
    Logger.log('Request rejected: Invalid token');
    return false;
  }
  
  return true;
}

/**
 * Create a JSON response with CORS headers
 */
function createResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Handle OPTIONS requests (CORS preflight)
 */
function doOptions(e) {
  return createResponse({ success: true });
}

/**
 * Handle POST requests to write data to sheets
 * Now requires secret token authentication
 */
function doPost(e) {
  try {
    // Parse request data
    const data = JSON.parse(e.postData.contents);
    
    // Validate authentication token
    if (!validateRequest(data)) {
      return createResponse({
        success: false,
        error: 'Unauthorized: Invalid or missing authentication token'
      }, 401);
    }
    
    // Extract request parameters
    const { action, entityType, records } = data;

    // Validate request format
    if (action !== 'upsert' || !entityType || !records || !Array.isArray(records)) {
      return createResponse({
        success: false,
        error: 'Invalid request format'
      }, 400);
    }

    // Process the request
    const result = writeToSheet(entityType, records);

    return createResponse({
      success: true,
      result: result
    });

  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString()
    }, 500);
  }
}

/**
 * Handle GET requests (for testing)
 * Returns status without requiring authentication (safe for health checks)
 * Also supports rebuild action: ?action=rebuild-compilation
 */
function doGet(e) {
  const secretToken = getSecretToken();
  const isConfigured = !!secretToken;
  
  // Check for rebuild action
  const action = e.parameter.action;
  if (action === 'rebuild-compilation') {
    try {
      rebuildCompilationTab();
      return createResponse({
        success: true,
        message: 'Compilation tab rebuilt successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return createResponse({
        success: false,
        error: error.toString(),
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
  
  if (action === 'extract-from-all-data') {
    try {
      extractDataFromAllDataTab();
      return createResponse({
        success: true,
        message: 'Data extracted from All Data tab to individual tabs successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return createResponse({
        success: false,
        error: error.toString(),
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
  
  return createResponse({
    success: true,
    message: 'LECRM Google Sheets Sync Web App is running',
    timestamp: new Date().toISOString(),
    security: {
      authenticationConfigured: isConfigured,
      note: isConfigured 
        ? 'Authentication is enabled. POST requests require a valid token.' 
        : 'WARNING: Authentication not configured. Set SECRET_TOKEN in Script Properties!'
    },
    actions: {
      rebuildCompilation: 'Add ?action=rebuild-compilation to rebuild the All Data tab',
      extractFromAllData: 'Add ?action=extract-from-all-data to extract data from All Data tab to individual tabs'
    }
  });
}

/**
 * Write records to the appropriate sheet tab
 */
function writeToSheet(entityType, records) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheetName = getSheetName(entityType);
  
  Logger.log(`📝 Writing ${records.length} ${entityType} records to ${sheetName} tab...`);
  
  // Write to individual entity tab
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    Logger.log(`   Creating new sheet: ${sheetName}`);
    sheet = spreadsheet.insertSheet(sheetName);
    const headers = getHeaders(entityType);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log(`   Created sheet with ${headers.length} headers`);
  } else {
    Logger.log(`   Sheet ${sheetName} already exists`);
  }
  
  // Also update the compilation tab for accounts and contacts
  if (entityType === 'accounts' || entityType === 'contacts') {
    Logger.log(`   Updating compilation tab...`);
    updateCompilationTab(spreadsheet, entityType, records);
  }
  
  // Get existing data
  let existingData = sheet.getDataRange().getValues();
  Logger.log(`   Existing data: ${existingData.length} rows (including header)`);
  
  let headers, dataRows;
  
  if (existingData.length === 0) {
    Logger.log(`   ⚠️ Sheet is empty, creating headers...`);
    headers = getHeaders(entityType);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Re-fetch after creating headers
    existingData = sheet.getDataRange().getValues();
    headers = existingData[0];
    dataRows = [];
  } else {
    headers = existingData[0];
    dataRows = existingData.slice(1);
  }
  
  Logger.log(`   Headers: ${headers.length}, Existing data rows: ${dataRows.length}`);
  
  // Create lookup maps for upsert
  const lookupFields = getLookupFields(entityType);
  const existingMap = new Map();
  
  dataRows.forEach((row, index) => {
    lookupFields.forEach(field => {
      const fieldIndex = headers.indexOf(field);
      if (fieldIndex !== -1 && row[fieldIndex]) {
        const key = `${field}:${row[fieldIndex]}`;
        if (!existingMap.has(key)) {
          existingMap.set(key, index + 2); // +2 because row 1 is header, and arrays are 0-indexed
        }
      }
    });
  });
  
  // Determine sort column for individual entity tabs
  let sortColumn = 1; // Default to first column
  if (entityType === 'accounts') {
    sortColumn = headers.indexOf('Name') + 1;
  } else if (entityType === 'contacts') {
    sortColumn = headers.indexOf('Contact Name') + 1; // Sort by contact name
    if (sortColumn === 0) sortColumn = headers.indexOf('First Name') + 1; // Fallback
  } else if (entityType === 'estimates') {
    sortColumn = headers.indexOf('Estimate Number') + 1;
  } else if (entityType === 'jobsites') {
    sortColumn = headers.indexOf('Name') + 1;
  }
  
  let created = 0;
  let updated = 0;
  const newRows = [];
  
  records.forEach(record => {
    // Find existing row
    let existingRowNum = null;
    lookupFields.forEach(field => {
      if (record[field]) {
        const key = `${field}:${record[field]}`;
        if (existingMap.has(key)) {
          existingRowNum = existingMap.get(key);
        }
      }
    });
    
    // Convert record to row array
    const row = headers.map(header => {
      // Handle special computed fields
      if (header === 'Contact Name' && entityType === 'contacts') {
        const firstName = record.first_name || '';
        const lastName = record.last_name || '';
        return `${firstName} ${lastName}`.trim() || '';
      }
      
      // Map common field names
      const fieldMap = getFieldMap(entityType);
      const mappedField = fieldMap[header];
      if (mappedField === null) return ''; // Skip computed fields that are null
      return record[mappedField] || record[header] || '';
    });
    
    if (existingRowNum) {
      // Update existing row
      sheet.getRange(existingRowNum, 1, 1, row.length).setValues([row]);
      updated++;
    } else {
      // Add new row
      newRows.push(row);
      created++;
    }
  });
  
  // Append new rows
  if (newRows.length > 0) {
    Logger.log(`   Appending ${newRows.length} new rows to sheet...`);
    const lastRow = sheet.getLastRow();
    Logger.log(`   Last row before append: ${lastRow}`);
    try {
    sheet.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows);
      Logger.log(`   ✅ Successfully appended ${newRows.length} rows`);
    } catch (error) {
      Logger.log(`   ❌ Error appending rows: ${error.toString()}`);
      throw error;
    }
  } else {
    Logger.log(`   No new rows to append (all were updates)`);
  }
  
  // Sort the sheet by the appropriate column
  const lastRow = sheet.getLastRow();
  Logger.log(`   Final row count: ${lastRow}`);
  if (lastRow > 1 && sortColumn > 0) {
    try {
    sheet.getRange(2, 1, lastRow - 1, headers.length)
      .sort({column: sortColumn, ascending: true});
      Logger.log(`   ✅ Sorted sheet by column ${sortColumn}`);
    } catch (error) {
      Logger.log(`   ⚠️ Error sorting sheet: ${error.toString()}`);
      // Don't throw - sorting is not critical
    }
  }
  
  Logger.log(`   ✅ Completed: ${created} created, ${updated} updated, ${records.length} total`);
  
  return {
    created,
    updated,
    total: records.length
  };
}

/**
 * Update the compilation tab with accounts and contacts
 * This tab combines all account and contact data - one row per contact with account info
 */
function updateCompilationTab(spreadsheet, entityType, records) {
  let compilationSheet = spreadsheet.getSheetByName('All Data');
  
  // Create compilation sheet if it doesn't exist
  if (!compilationSheet) {
    compilationSheet = spreadsheet.insertSheet('All Data', 0); // Insert as first tab
    const headers = getCompilationHeaders();
    compilationSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    compilationSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    compilationSheet.setFrozenRows(1);
    // Auto-resize columns
    compilationSheet.autoResizeColumns(1, headers.length);
  }
  
  // Get existing data
  const existingData = compilationSheet.getDataRange().getValues();
  const headers = existingData[0];
  const dataRows = existingData.slice(1);
  const isCompilationEmpty = dataRows.length === 0;
  
  if (entityType === 'accounts') {
    // When accounts are updated, we need to update all rows for that account
    const accountMap = new Map();
    records.forEach(account => {
      const key = account.lmn_crm_id || account.id;
      if (key) accountMap.set(key, account);
    });
    
    // If compilation tab is empty and we have contacts, create rows for all contacts with these accounts
    // This handles the case where accounts are imported first
    const contactsSheet = spreadsheet.getSheetByName('Imported Contacts');
    if (contactsSheet && isCompilationEmpty) {
      // Compilation tab is empty, create rows for all contacts
      const contactData = contactsSheet.getDataRange().getValues();
      if (contactData.length > 1) { // Has headers and at least one row
        const contactHeaders = contactData[0];
        const newRows = [];
        
        for (let i = 1; i < contactData.length; i++) {
          const contactRow = contactData[i];
          const contact = {};
          contactHeaders.forEach((header, idx) => {
            const fieldMap = getFieldMap('contacts');
            const fieldName = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_');
            contact[fieldName] = contactRow[idx];
          });
          
          // Get account for this contact - try multiple fields
          const accountId = contact.account_id || contact.lmn_crm_id || (contactHeaders.indexOf('Account ID') >= 0 ? contactRow[contactHeaders.indexOf('Account ID')] : null);
          const account = accountId ? accountMap.get(accountId) : null;
          
          // Build compilation row
          const row = headers.map(header => {
            if (account) {
              const accountValue = getCompilationFieldValue(header, account, 'accounts');
              if (accountValue !== '') return accountValue;
            }
            return getCompilationFieldValue(header, contact, 'contacts');
          });
          
          newRows.push(row);
        }
        
        // Append all new rows
        if (newRows.length > 0) {
          const lastRow = compilationSheet.getLastRow();
          compilationSheet.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows);
        }
      }
    }
    
    // Always update existing rows that match these accounts (if compilation tab has data)
    if (!isCompilationEmpty) {
      // Update existing rows that match these accounts
    dataRows.forEach((row, index) => {
      const accountIdIndex = headers.indexOf('LMN CRM ID');
      const accountId = row[accountIdIndex];
      if (accountId && accountMap.has(accountId)) {
        const account = accountMap.get(accountId);
        const updatedRow = headers.map(header => {
          const existingValue = row[headers.indexOf(header)];
          const accountValue = getCompilationFieldValue(header, account, 'accounts');
          // Keep contact fields, update account fields
          if (header.startsWith('Account ') || header === 'Account ID' || header === 'LMN CRM ID' || 
              header === 'Account Name' || header === 'Account Type' || header === 'Status' ||
              header === 'Classification' || header === 'Revenue Segment' || header === 'Annual Revenue' ||
              header === 'Organization Score' || header === 'Account Tags' || header === 'Account Address 1' ||
              header === 'Account Address 2' || header === 'Account City' || header === 'Account State' ||
              header === 'Account Postal Code' || header === 'Account Country' || header === 'Account Source' ||
              header === 'Account Created Date' || header === 'Last Interaction Date' || 
              header === 'Renewal Date' || header === 'Account Archived') {
            return accountValue;
          }
          return existingValue;
        });
        compilationSheet.getRange(index + 2, 1, 1, headers.length).setValues([updatedRow]);
      }
    });
    }
    
  } else if (entityType === 'contacts') {
    // For contacts, create/update rows (one row per contact with account info)
    const existingMap = new Map();
    dataRows.forEach((row, index) => {
      const lmnContactIdIndex = headers.indexOf('LMN Contact ID');
      const contactIdIndex = headers.indexOf('Contact ID');
      const key = row[lmnContactIdIndex] || row[contactIdIndex];
      if (key) existingMap.set(key, index + 2);
    });
    
    // Get account data for these contacts
    const accountsSheet = spreadsheet.getSheetByName('Imported Accounts');
    const accountMap = new Map();
    if (accountsSheet) {
      const accountData = accountsSheet.getDataRange().getValues();
      const accountHeaders = accountData[0];
      for (let i = 1; i < accountData.length; i++) {
        const accountRow = accountData[i];
        const accountIdIndex = accountHeaders.indexOf('LMN CRM ID');
        const accountId = accountRow[accountIdIndex];
        if (accountId) {
          const account = {};
          accountHeaders.forEach((header, idx) => {
            const fieldMap = getFieldMap('accounts');
            const fieldName = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_');
            account[fieldName] = accountRow[idx];
          });
          accountMap.set(accountId, account);
        }
      }
    }
    
    let created = 0;
    let updated = 0;
    const newRows = [];
    
    records.forEach(contact => {
      const key = contact.lmn_contact_id || contact.id;
      const existingRowNum = key ? existingMap.get(key) : null;
      
      // Get account data for this contact
      const accountId = contact.account_id || contact.lmn_crm_id;
      const account = accountId ? accountMap.get(accountId) : null;
      
      // Build compilation row: account fields + contact fields
      const row = headers.map(header => {
        // Try account field first
        if (account) {
          const accountValue = getCompilationFieldValue(header, account, 'accounts');
          if (accountValue !== '') return accountValue;
        }
        // Then contact field
        return getCompilationFieldValue(header, contact, 'contacts');
      });
      
      if (existingRowNum) {
        // Update existing row
        compilationSheet.getRange(existingRowNum, 1, 1, row.length).setValues([row]);
        updated++;
      } else {
        // Add new row
        newRows.push(row);
        created++;
      }
    });
    
    // Append new rows
    if (newRows.length > 0) {
      const lastRow = compilationSheet.getLastRow();
      compilationSheet.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows);
    }
  }
  
  // Sort by Account Name, then Contact Name
  const lastRow = compilationSheet.getLastRow();
  if (lastRow > 1) {
    const accountNameCol = headers.indexOf('Account Name') + 1;
    const contactNameCol = headers.indexOf('Contact Name') + 1;
    if (accountNameCol > 0 && contactNameCol > 0) {
      compilationSheet.getRange(2, 1, lastRow - 1, headers.length)
        .sort([{column: accountNameCol, ascending: true}, {column: contactNameCol, ascending: true}]);
    }
  }
  
  return { created: 0, updated: 0 };
}

/**
 * Debug function: List all sheets and their row counts
 */
function debugSheets() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheets = spreadsheet.getSheets();
  Logger.log('=== SHEET DEBUG INFO ===');
  Logger.log(`Total sheets: ${sheets.length}`);
  Logger.log('');
  sheets.forEach(sheet => {
    const name = sheet.getName();
    const rowCount = sheet.getLastRow();
    const colCount = sheet.getLastColumn();
    Logger.log(`Sheet: "${name}"`);
    Logger.log(`  Rows: ${rowCount} (including header)`);
    Logger.log(`  Columns: ${colCount}`);
    if (rowCount > 1) {
      const headers = sheet.getRange(1, 1, 1, colCount).getValues()[0];
      Logger.log(`  Headers: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`);
    }
    Logger.log('');
  });
  Logger.log('=== END DEBUG INFO ===');
}

/**
 * Extract data from "All Data" tab back to individual tabs
 * Useful when "All Data" has data but individual tabs are empty
 */
function extractDataFromAllDataTab() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const allDataSheet = spreadsheet.getSheetByName('All Data');
  
  if (!allDataSheet) {
    Logger.log('❌ "All Data" tab not found');
    return;
  }
  
  Logger.log('📊 Extracting data from "All Data" tab...');
  
  const allData = allDataSheet.getDataRange().getValues();
  if (allData.length < 2) {
    Logger.log('❌ "All Data" tab has no data rows');
    return;
  }
  
  const headers = allData[0];
  const dataRows = allData.slice(1);
  
  Logger.log(`   Found ${dataRows.length} rows in "All Data" tab`);
  
  // Extract accounts
  const accountMap = new Map();
  const accountHeaders = getHeaders('accounts');
  const accountFieldMap = getFieldMap('accounts');
  
  // Extract contacts
  const contactMap = new Map();
  const contactHeaders = getHeaders('contacts');
  const contactFieldMap = getFieldMap('contacts');
  
  dataRows.forEach((row, index) => {
    // Extract account data
    const accountId = row[headers.indexOf('LMN CRM ID')] || row[headers.indexOf('Account ID')];
    if (accountId && !accountMap.has(accountId)) {
      const account = {};
      accountHeaders.forEach(header => {
        const fieldName = accountFieldMap[header];
        if (fieldName) {
          const headerIndex = headers.indexOf(header.startsWith('Account ') ? header : `Account ${header}`);
          if (headerIndex >= 0) {
            account[fieldName] = row[headerIndex];
          }
        }
      });
      // Also get direct account fields
      account.lmn_crm_id = accountId;
      account.id = row[headers.indexOf('Account ID')] || accountId;
      account.name = row[headers.indexOf('Account Name')] || '';
      accountMap.set(accountId, account);
    }
    
    // Extract contact data
    const contactId = row[headers.indexOf('LMN Contact ID')] || row[headers.indexOf('Contact ID')];
    if (contactId && !contactMap.has(contactId)) {
      const contact = {};
      contactHeaders.forEach(header => {
        const fieldName = contactFieldMap[header];
        if (fieldName && fieldName !== 'Contact Name') { // Contact Name is computed
          const headerIndex = headers.indexOf(header);
          if (headerIndex >= 0) {
            contact[fieldName] = row[headerIndex];
          }
        }
      });
      // Also get direct contact fields
      contact.lmn_contact_id = contactId;
      contact.id = row[headers.indexOf('Contact ID')] || contactId;
      contact.account_id = accountId;
      contact.account_name = row[headers.indexOf('Account Name')] || '';
      contact.first_name = row[headers.indexOf('First Name')] || '';
      contact.last_name = row[headers.indexOf('Last Name')] || '';
      contactMap.set(contactId, contact);
    }
  });
  
  Logger.log(`   Extracted ${accountMap.size} unique accounts and ${contactMap.size} unique contacts`);
  
  // Write accounts to Imported Accounts tab
  if (accountMap.size > 0) {
    Logger.log('   Writing accounts to Imported Accounts tab...');
    const accountsArray = Array.from(accountMap.values());
    const result = writeToSheet('accounts', accountsArray);
    Logger.log(`   ✅ Wrote ${result.total} accounts (${result.created} created, ${result.updated} updated)`);
  }
  
  // Write contacts to Imported Contacts tab
  if (contactMap.size > 0) {
    Logger.log('   Writing contacts to Imported Contacts tab...');
    const contactsArray = Array.from(contactMap.values());
    const result = writeToSheet('contacts', contactsArray);
    Logger.log(`   ✅ Wrote ${result.total} contacts (${result.created} created, ${result.updated} updated)`);
  }
  
  Logger.log('✅ Extraction complete!');
}

/**
 * Rebuild the compilation tab from scratch using all existing data
 * Useful for fixing the compilation tab if it's empty or out of sync
 */
function rebuildCompilationTab() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  
  // Debug: List all sheets first
  debugSheets();
  
  let compilationSheet = spreadsheet.getSheetByName('All Data');
  
  // Delete and recreate if exists
  if (compilationSheet) {
    spreadsheet.deleteSheet(compilationSheet);
  }
  
  // Create new compilation sheet
  compilationSheet = spreadsheet.insertSheet('All Data', 0);
  const headers = getCompilationHeaders();
  compilationSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  compilationSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  compilationSheet.setFrozenRows(1);
  compilationSheet.autoResizeColumns(1, headers.length);
  
  // Get all contacts
  const contactsSheet = spreadsheet.getSheetByName('Imported Contacts');
  if (!contactsSheet) {
    Logger.log('No Imported Contacts sheet found');
    return;
  }
  
  const contactData = contactsSheet.getDataRange().getValues();
  Logger.log(`Found Imported Contacts sheet with ${contactData.length} rows (including header)`);
  if (contactData.length < 2) {
    Logger.log('No contacts to add to compilation tab - sheet only has headers');
    Logger.log('Please check that contacts were actually written to the sheet');
    return;
  }
  
  const contactHeaders = contactData[0];
  
  // Get all accounts
  const accountsSheet = spreadsheet.getSheetByName('Imported Accounts');
  const accountMap = new Map();
  if (accountsSheet) {
    const accountData = accountsSheet.getDataRange().getValues();
    const accountHeaders = accountData[0];
    for (let i = 1; i < accountData.length; i++) {
      const accountRow = accountData[i];
      const accountIdIndex = accountHeaders.indexOf('LMN CRM ID');
      const accountId = accountRow[accountIdIndex];
      if (accountId) {
        const account = {};
        accountHeaders.forEach((header, idx) => {
          const fieldMap = getFieldMap('accounts');
          const fieldName = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_');
          account[fieldName] = accountRow[idx];
        });
        accountMap.set(accountId, account);
      }
    }
  }
  
  // Build rows for all contacts
  const newRows = [];
  for (let i = 1; i < contactData.length; i++) {
    const contactRow = contactData[i];
    const contact = {};
    contactHeaders.forEach((header, idx) => {
      const fieldMap = getFieldMap('contacts');
      const fieldName = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_');
      contact[fieldName] = contactRow[idx];
    });
    
    // Get account for this contact - try multiple account ID fields
    const accountIdIndex = contactHeaders.indexOf('Account ID');
    const lmnCrmIdIndex = contactHeaders.indexOf('LMN CRM ID');
    const accountId = (accountIdIndex >= 0 ? contactRow[accountIdIndex] : null) || 
                      (lmnCrmIdIndex >= 0 ? contactRow[lmnCrmIdIndex] : null) ||
                      contact.account_id || 
                      contact.lmn_crm_id;
    
    const account = accountId ? accountMap.get(accountId) : null;
    
    // Build compilation row
    const row = headers.map(header => {
      if (account) {
        const accountValue = getCompilationFieldValue(header, account, 'accounts');
        if (accountValue !== '') return accountValue;
      }
      return getCompilationFieldValue(header, contact, 'contacts');
    });
    
    newRows.push(row);
  }
  
  // Append all rows
  if (newRows.length > 0) {
    compilationSheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
    
    // Sort by Account Name, then Contact Name
    const lastRow = compilationSheet.getLastRow();
    const accountNameCol = headers.indexOf('Account Name') + 1;
    const contactNameCol = headers.indexOf('Contact Name') + 1;
    if (accountNameCol > 0 && contactNameCol > 0 && lastRow > 1) {
      compilationSheet.getRange(2, 1, lastRow - 1, headers.length)
        .sort([{column: accountNameCol, ascending: true}, {column: contactNameCol, ascending: true}]);
    }
    
    Logger.log(`Rebuilt compilation tab with ${newRows.length} rows`);
  }
}

/**
 * Get compilation tab headers - combines all account and contact fields
 * Organized with account fields first, then contact fields
 */
function getCompilationHeaders() {
  return [
    // Account fields (grouped together)
    'Account ID', 'LMN CRM ID', 'Account Name', 'Account Type', 'Status', 'Classification',
    'Revenue Segment', 'Annual Revenue', 'Organization Score', 'Account Tags',
    'Account Address 1', 'Account Address 2', 'Account City', 'Account State', 
    'Account Postal Code', 'Account Country', 'Account Source', 'Account Created Date',
    'Last Interaction Date', 'Renewal Date', 'Account Archived',
    // Contact fields (grouped together)
    'Contact ID', 'LMN Contact ID', 'Account ID (Contact)', 'Account Name (Contact)', 
    'Contact Name', 'First Name', 'Last Name', 'Email', 'Email 1', 'Email 2', 
    'Phone', 'Phone 1', 'Phone 2', 'Position', 'Title', 'Role', 'Primary Contact',
    'Do Not Email', 'Do Not Mail', 'Do Not Call', 'Referral Source',
    'Contact Notes', 'Contact Source', 'Contact Created Date', 'Contact Archived'
  ];
}

/**
 * Get field value for compilation row based on header and record
 */
function getCompilationFieldValue(header, record, entityType) {
  // Account fields
  if (header === 'Account ID') return entityType === 'accounts' ? (record.id || '') : '';
  if (header === 'LMN CRM ID') return entityType === 'accounts' ? (record.lmn_crm_id || '') : '';
  if (header === 'Account Name') return entityType === 'accounts' ? (record.name || '') : '';
  if (header === 'Account Type') return entityType === 'accounts' ? (record.account_type || '') : '';
  if (header === 'Status') return entityType === 'accounts' ? (record.status || '') : '';
  if (header === 'Classification') return entityType === 'accounts' ? (record.classification || '') : '';
  if (header === 'Revenue Segment') return entityType === 'accounts' ? (record.revenue_segment || '') : '';
  if (header === 'Annual Revenue') return entityType === 'accounts' ? (record.annual_revenue || '') : '';
  if (header === 'Organization Score') return entityType === 'accounts' ? (record.organization_score || '') : '';
  if (header === 'Account Tags') return entityType === 'accounts' ? (Array.isArray(record.tags) ? record.tags.join(', ') : (record.tags || '')) : '';
  if (header === 'Account Address 1') return entityType === 'accounts' ? (record.address_1 || '') : '';
  if (header === 'Account Address 2') return entityType === 'accounts' ? (record.address_2 || '') : '';
  if (header === 'Account City') return entityType === 'accounts' ? (record.city || '') : '';
  if (header === 'Account State') return entityType === 'accounts' ? (record.state || '') : '';
  if (header === 'Account Postal Code') return entityType === 'accounts' ? (record.postal_code || '') : '';
  if (header === 'Account Country') return entityType === 'accounts' ? (record.country || '') : '';
  if (header === 'Account Source') return entityType === 'accounts' ? (record.source || '') : '';
  if (header === 'Account Created Date') return entityType === 'accounts' ? (record.created_date || '') : '';
  if (header === 'Last Interaction Date') return entityType === 'accounts' ? (record.last_interaction_date || '') : '';
  if (header === 'Renewal Date') return entityType === 'accounts' ? (record.renewal_date || '') : '';
  if (header === 'Account Archived') return entityType === 'accounts' ? (record.archived || false) : '';
  
  // Contact fields
  if (header === 'Contact ID') return entityType === 'contacts' ? (record.id || '') : '';
  if (header === 'LMN Contact ID') return entityType === 'contacts' ? (record.lmn_contact_id || '') : '';
  if (header === 'Account ID (Contact)') return entityType === 'contacts' ? (record.account_id || '') : '';
  if (header === 'Account Name (Contact)') return entityType === 'contacts' ? (record.account_name || '') : '';
  if (header === 'Contact Name') {
    if (entityType === 'contacts') {
      const firstName = record.first_name || '';
      const lastName = record.last_name || '';
      return `${firstName} ${lastName}`.trim() || '';
    }
    return '';
  }
  if (header === 'First Name') return entityType === 'contacts' ? (record.first_name || '') : '';
  if (header === 'Last Name') return entityType === 'contacts' ? (record.last_name || '') : '';
  if (header === 'Email') return entityType === 'contacts' ? (record.email || '') : '';
  if (header === 'Email 1') return entityType === 'contacts' ? (record.email_1 || '') : '';
  if (header === 'Email 2') return entityType === 'contacts' ? (record.email_2 || '') : '';
  if (header === 'Phone') return entityType === 'contacts' ? (record.phone || '') : '';
  if (header === 'Phone 1') return entityType === 'contacts' ? (record.phone_1 || '') : '';
  if (header === 'Phone 2') return entityType === 'contacts' ? (record.phone_2 || '') : '';
  if (header === 'Position') return entityType === 'contacts' ? (record.position || '') : '';
  if (header === 'Title') return entityType === 'contacts' ? (record.title || '') : '';
  if (header === 'Role') return entityType === 'contacts' ? (record.role || '') : '';
  if (header === 'Primary Contact') return entityType === 'contacts' ? (record.primary_contact || false) : '';
  if (header === 'Do Not Email') return entityType === 'contacts' ? (record.do_not_email || false) : '';
  if (header === 'Do Not Mail') return entityType === 'contacts' ? (record.do_not_mail || false) : '';
  if (header === 'Do Not Call') return entityType === 'contacts' ? (record.do_not_call || false) : '';
  if (header === 'Referral Source') return entityType === 'contacts' ? (record.referral_source || '') : '';
  if (header === 'Contact Notes') return entityType === 'contacts' ? (record.notes || '') : '';
  if (header === 'Contact Source') return entityType === 'contacts' ? (record.source || '') : '';
  if (header === 'Contact Created Date') return entityType === 'contacts' ? (record.created_date || '') : '';
  if (header === 'Contact Archived') return entityType === 'contacts' ? (record.archived || false) : '';
  
  return '';
}

/**
 * Get sheet name for entity type
 */
function getSheetName(entityType) {
  const sheetNames = {
    'accounts': 'Imported Accounts',
    'contacts': 'Imported Contacts',
    'estimates': 'Imported Estimates',
    'jobsites': 'Imported Jobsites'
  };
  return sheetNames[entityType] || entityType;
}

/**
 * Get headers for entity type
 */
function getHeaders(entityType) {
  const headers = {
    'accounts': [
      'ID', 'LMN CRM ID', 'Name', 'Account Type', 'Status', 'Classification', 
      'Revenue Segment', 'Annual Revenue', 'Organization Score', 'Tags', 
      'Address 1', 'Address 2', 'City', 'State', 'Postal Code', 'Country',
      'Source', 'Created Date', 'Last Interaction Date', 'Renewal Date', 'Archived'
    ],
    'contacts': [
      'ID', 'LMN Contact ID', 'Account ID', 'Account Name', 'First Name', 'Last Name', 'Contact Name',
      'Email', 'Email 1', 'Email 2', 'Phone', 'Phone 1', 'Phone 2',
      'Position', 'Title', 'Role', 'Primary Contact', 'Do Not Email', 'Do Not Mail',
      'Do Not Call', 'Referral Source', 'Notes', 'Source', 'Created Date', 'Archived'
    ],
    'estimates': [
      'ID', 'LMN Estimate ID', 'Estimate Number', 'Estimate Type', 'Estimate Date',
      'Estimate Close Date', 'Contract Start', 'Contract End', 'Project Name', 'Version',
      'Account ID', 'Contact ID', 'LMN Contact ID', 'Contact Name', 'Address', 'Billing Address',
      'Phone 1', 'Phone 2', 'Email', 'Salesperson', 'Estimator', 'Status',
      'Pipeline Status', 'Proposal First Shared', 'Proposal Last Shared',
      'Proposal Last Updated', 'Division', 'Referral', 'Referral Note',
      'Confidence Level', 'Archived', 'Exclude Stats', 'Material Cost', 'Material Price',
      'Labor Cost', 'Labor Price', 'Labor Hours', 'Equipment Cost', 'Equipment Price',
      'Other Costs', 'Other Price', 'Sub Costs', 'Sub Price', 'Total Price',
      'Total Price With Tax', 'Total Cost', 'Total Overhead', 'Breakeven',
      'Total Profit', 'Predicted Sales', 'Source', 'Created Date'
    ],
    'jobsites': [
      'ID', 'LMN Jobsite ID', 'Account ID', 'LMN Contact ID', 'Contact ID', 'Contact Name',
      'Name', 'Address 1', 'Address 2', 'City', 'State', 'Postal Code',
      'Country', 'Notes', 'Source', 'Created Date'
    ]
  };
  return headers[entityType] || [];
}

/**
 * Get lookup fields for entity type (for upsert matching)
 */
function getLookupFields(entityType) {
  const lookupFields = {
    'accounts': ['LMN CRM ID', 'ID'],
    'contacts': ['LMN Contact ID', 'ID'],
    'estimates': ['LMN Estimate ID', 'ID'],
    'jobsites': ['LMN Jobsite ID', 'ID']
  };
  return lookupFields[entityType] || ['ID'];
}

/**
 * Map header names to record field names
 */
function getFieldMap(entityType) {
  const fieldMaps = {
    'accounts': {
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
    },
    'contacts': {
      'ID': 'id',
      'LMN Contact ID': 'lmn_contact_id',
      'Account ID': 'account_id',
      'Account Name': 'account_name',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Contact Name': null, // Computed field
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
    },
    'estimates': {
      'ID': 'id',
      'LMN Estimate ID': 'lmn_estimate_id',
      'Estimate Number': 'estimate_number',
      'Estimate Type': 'estimate_type',
      'Estimate Date': 'estimate_date',
      'Estimate Close Date': 'estimate_close_date',
      'Contract Start': 'contract_start',
      'Contract End': 'contract_end',
      'Project Name': 'project_name',
      'Version': 'version',
      'Account ID': 'account_id',
      'Contact ID': 'contact_id',
      'LMN Contact ID': 'lmn_contact_id',
      'Contact Name': 'contact_name',
      'Status': 'status',
      'Total Price': 'total_price',
      'Total Price With Tax': 'total_price_with_tax',
      'Source': 'source',
      'Created Date': 'created_date'
    },
    'jobsites': {
      'ID': 'id',
      'LMN Jobsite ID': 'lmn_jobsite_id',
      'Account ID': 'account_id',
      'LMN Contact ID': 'lmn_contact_id',
      'Contact ID': 'contact_id',
      'Contact Name': 'contact_name',
      'Name': 'name',
      'Address 1': 'address_1',
      'Address 2': 'address_2',
      'City': 'city',
      'State': 'state',
      'Postal Code': 'postal_code',
      'Country': 'country',
      'Notes': 'notes',
      'Source': 'source',
      'Created Date': 'created_date'
    }
  };
  return fieldMaps[entityType] || {};
}
