/**
 * Google Apps Script for LECRM Data Sync
 * 
 * Deploy this script as a Web App to enable writing data to Google Sheets
 * 
 * Setup Instructions:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
 * 2. Go to Extensions → Apps Script
 * 3. Paste this code
 * 4. Save the project
 * 5. Click "Deploy" → "New deployment"
 * 6. Select type: "Web app"
 * 7. Execute as: "Me"
 * 8. Who has access: "Anyone" (or "Anyone with Google account" for more security)
 * 9. Click "Deploy"
 * 10. Copy the Web App URL and add it to your .env file as VITE_GOOGLE_SHEETS_WEB_APP_URL
 */

const SHEET_ID = '1CzkVSbflUrYO_90Zk7IEreDOIV4lMFnWe30dFilFa6s'; // Update with your sheet ID

/**
 * Handle POST requests to write data to sheets
 * Note: Google Apps Script Web Apps handle CORS automatically when deployed with "Anyone" access
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { action, entityType, records } = data;

    if (action !== 'upsert' || !entityType || !records || !Array.isArray(records)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid request format'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const result = writeToSheet(entityType, records);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      result: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'LECRM Google Sheets Sync Web App is running',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Write records to the appropriate sheet tab
 */
function writeToSheet(entityType, records) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  
  // Write to individual entity tab
  let sheet = spreadsheet.getSheetByName(getSheetName(entityType));
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(getSheetName(entityType));
    const headers = getHeaders(entityType);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // Also update the compilation tab for accounts and contacts
  if (entityType === 'accounts' || entityType === 'contacts') {
    updateCompilationTab(spreadsheet, entityType, records);
  }
  
  // Get existing data
  const existingData = sheet.getDataRange().getValues();
  const headers = existingData[0];
  const dataRows = existingData.slice(1);
  
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
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows);
  }
  
  // Sort the sheet by the appropriate column
  const lastRow = sheet.getLastRow();
  if (lastRow > 1 && sortColumn > 0) {
    sheet.getRange(2, 1, lastRow - 1, headers.length)
      .sort({column: sortColumn, ascending: true});
  }
  
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
  
  if (entityType === 'accounts') {
    // When accounts are updated, we need to update all rows for that account
    const accountMap = new Map();
    records.forEach(account => {
      const key = account.lmn_crm_id || account.id;
      if (key) accountMap.set(key, account);
    });
    
    // Update all existing rows that match these accounts
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
