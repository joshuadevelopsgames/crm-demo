/**
 * Import Validation and Comparison System
 * 
 * This module validates imported data against existing database records:
 * 1. Identifies Account IDs and Contact IDs from the sheets
 * 2. Compares imported data with existing database data
 * 3. Flags differences and orphaned records
 * 4. Ensures only data from sheets is imported (no mock/orphaned data)
 */

/**
 * Extract all Account IDs and Contact IDs from the four import sheets
 * @param {Object} contactsExportData - Parsed Contacts Export data
 * @param {Object} leadsListData - Parsed Leads List data
 * @param {Object} estimatesData - Parsed Estimates List data
 * @param {Object} jobsitesData - Parsed Jobsite Export data
 * @returns {Object} - Object containing sets of valid IDs
 */
export function extractValidIds(contactsExportData, leadsListData, estimatesData, jobsitesData) {
  const validAccountIds = new Set();
  const validContactIds = new Set();
  const validEstimateIds = new Set();
  const validJobsiteIds = new Set();

  // From Contacts Export: Extract CRM IDs (Account IDs) and Contact IDs
  if (contactsExportData?.accounts) {
    contactsExportData.accounts.forEach(account => {
      if (account.lmn_crm_id) {
        validAccountIds.add(account.lmn_crm_id);
      }
      if (account.id) {
        // Also track the internal ID format
        validAccountIds.add(account.id);
      }
    });
  }

  if (contactsExportData?.contacts) {
    contactsExportData.contacts.forEach(contact => {
      if (contact.lmn_contact_id) {
        validContactIds.add(contact.lmn_contact_id);
      }
      if (contact.id) {
        validContactIds.add(contact.id);
      }
    });
  }

  // From Leads List: Extract Contact IDs
  if (leadsListData?.contactsData) {
    leadsListData.contactsData.forEach(contact => {
      if (contact.lmn_contact_id) {
        validContactIds.add(contact.lmn_contact_id);
      }
      if (contact.id) {
        validContactIds.add(contact.id);
      }
    });
  }

  // From Estimates List: Extract Estimate IDs and link to Account/Contact IDs
  if (estimatesData?.estimates) {
    estimatesData.estimates.forEach(estimate => {
      if (estimate.lmn_estimate_id) {
        validEstimateIds.add(estimate.lmn_estimate_id);
      }
      if (estimate.id) {
        validEstimateIds.add(estimate.id);
      }
      // Track account/contact IDs referenced by estimates
      if (estimate.account_id) {
        validAccountIds.add(estimate.account_id);
      }
      if (estimate.contact_id) {
        validContactIds.add(estimate.contact_id);
      }
      if (estimate.lmn_contact_id) {
        validContactIds.add(estimate.lmn_contact_id);
      }
    });
  }

  // From Jobsite Export: Extract Jobsite IDs and link to Account/Contact IDs
  if (jobsitesData?.jobsites) {
    jobsitesData.jobsites.forEach(jobsite => {
      if (jobsite.lmn_jobsite_id) {
        validJobsiteIds.add(jobsite.lmn_jobsite_id);
      }
      if (jobsite.id) {
        validJobsiteIds.add(jobsite.id);
      }
      // Track account/contact IDs referenced by jobsites
      if (jobsite.account_id) {
        validAccountIds.add(jobsite.account_id);
      }
      if (jobsite.contact_id) {
        validContactIds.add(jobsite.contact_id);
      }
      if (jobsite.lmn_contact_id) {
        validContactIds.add(jobsite.lmn_contact_id);
      }
    });
  }

  return {
    accountIds: validAccountIds,
    contactIds: validContactIds,
    estimateIds: validEstimateIds,
    jobsiteIds: validJobsiteIds
  };
}

/**
 * Compare imported data with existing database records
 * @param {Object} importedData - Merged imported data
 * @param {Array} existingAccounts - Existing accounts from database
 * @param {Array} existingContacts - Existing contacts from database
 * @param {Array} existingEstimates - Existing estimates from database
 * @param {Array} existingJobsites - Existing jobsites from database
 * @param {Object} validIds - Valid IDs from extractValidIds
 * @returns {Object} - Comparison results with flags and differences
 */
export function compareWithExisting(
  importedData,
  existingAccounts,
  existingContacts,
  existingEstimates,
  existingJobsites,
  validIds
) {
  const comparison = {
    accounts: {
      new: [],
      updated: [],
      unchanged: [],
      differences: [],
      orphaned: [] // Accounts in DB but not in import sheets
    },
    contacts: {
      new: [],
      updated: [],
      unchanged: [],
      differences: [],
      orphaned: []
    },
    estimates: {
      new: [],
      updated: [],
      unchanged: [],
      differences: [],
      orphaned: [] // Estimates in DB but not in import sheets
    },
    jobsites: {
      new: [],
      updated: [],
      unchanged: [],
      differences: [],
      orphaned: []
    },
    warnings: [],
    errors: []
  };

  // Create maps for quick lookup
  const existingAccountsMap = new Map();
  existingAccounts.forEach(acc => {
    if (acc.lmn_crm_id) {
      existingAccountsMap.set(acc.lmn_crm_id, acc);
    }
    if (acc.id) {
      existingAccountsMap.set(acc.id, acc);
    }
  });

  const existingContactsMap = new Map();
  existingContacts.forEach(contact => {
    if (contact.lmn_contact_id) {
      existingContactsMap.set(contact.lmn_contact_id, contact);
    }
    if (contact.id) {
      existingContactsMap.set(contact.id, contact);
    }
  });

  const existingEstimatesMap = new Map();
  existingEstimates.forEach(est => {
    // Try multiple lookup keys for estimates
    if (est.lmn_estimate_id) {
      // Normalize to string and store with original case
      const lmnId = String(est.lmn_estimate_id);
      existingEstimatesMap.set(lmnId, est);
      // Also store with uppercase for case-insensitive matching
      existingEstimatesMap.set(lmnId.toUpperCase(), est);
      // Also store with lowercase
      existingEstimatesMap.set(lmnId.toLowerCase(), est);
    }
    // Also try estimate_number as fallback
    if (est.estimate_number) {
      const estNum = String(est.estimate_number);
      existingEstimatesMap.set(estNum, est);
      existingEstimatesMap.set(estNum.toUpperCase(), est);
      existingEstimatesMap.set(estNum.toLowerCase(), est);
    }
    if (est.id) {
      existingEstimatesMap.set(String(est.id), est);
    }
  });
  
  // Debug: Log map size and sample keys
  if (existingEstimates.length > 0) {
    console.log(`[compareWithExisting] Built estimates map with ${existingEstimatesMap.size} entries from ${existingEstimates.length} estimates`);
    const sampleKeys = Array.from(existingEstimatesMap.keys()).slice(0, 5);
    console.log(`[compareWithExisting] Sample estimate map keys:`, sampleKeys);
  }

  const existingJobsitesMap = new Map();
  existingJobsites.forEach(jobsite => {
    if (jobsite.lmn_jobsite_id) {
      // Normalize to string and store with multiple formats for flexible matching
      const jobsiteIdStr = String(jobsite.lmn_jobsite_id);
      existingJobsitesMap.set(jobsiteIdStr, jobsite);
      // Also try as number if it's a numeric string
      const numId = parseInt(jobsiteIdStr, 10);
      if (!isNaN(numId)) {
        existingJobsitesMap.set(numId, jobsite);
      }
    }
    if (jobsite.id) {
      existingJobsitesMap.set(String(jobsite.id), jobsite);
    }
  });
  
  // Debug: Log map size and sample keys
  if (existingJobsites.length > 0) {
    console.log(`[compareWithExisting] Built jobsites map with ${existingJobsitesMap.size} entries from ${existingJobsites.length} jobsites`);
    const sampleKeys = Array.from(existingJobsitesMap.keys()).slice(0, 10);
    console.log(`[compareWithExisting] Sample jobsite map keys:`, sampleKeys);
    // Check if any of the problematic IDs are in the map
    const problematicIds = ['9906807', '6347524', '3948460', '5567721', '9471049'];
    problematicIds.forEach(id => {
      const hasString = existingJobsitesMap.has(id);
      const hasNumber = existingJobsitesMap.has(parseInt(id, 10));
      if (hasString || hasNumber) {
        console.log(`[compareWithExisting] ✅ Found problematic jobsite ${id} in map (as string: ${hasString}, as number: ${hasNumber})`);
      } else {
        console.log(`[compareWithExisting] ❌ Problematic jobsite ${id} NOT in map`);
      }
    });
  }

  // Compare Accounts
  if (importedData.accounts) {
    importedData.accounts.forEach(importedAccount => {
      const lookupId = importedAccount.lmn_crm_id || importedAccount.id;
      const existing = existingAccountsMap.get(lookupId);

      if (!existing) {
        comparison.accounts.new.push(importedAccount);
      } else {
        const differences = findAccountDifferences(importedAccount, existing);
        if (differences.length > 0) {
          comparison.accounts.updated.push({
            account: importedAccount,
            existing: existing,
            differences: differences
          });
        } else {
          comparison.accounts.unchanged.push(importedAccount);
        }
      }
    });
  }

  // Find orphaned accounts (in DB but not in import)
  existingAccounts.forEach(existingAccount => {
    const lookupId = existingAccount.lmn_crm_id || existingAccount.id;
    if (!validIds.accountIds.has(lookupId)) {
      // Check if account has imported data (has lmn_crm_id)
      if (existingAccount.lmn_crm_id) {
        const source = determineDataSource(existingAccount, 'account');
        comparison.accounts.orphaned.push({
          ...existingAccount,
          _source: source.source,
          _sourceNote: source.note
        });
        comparison.warnings.push({
          type: 'orphaned_account',
          message: `Account "${existingAccount.name}" (ID: ${existingAccount.lmn_crm_id}) exists in database but not in import sheets`,
          account: existingAccount,
          source: source.source,
          sourceNote: source.note
        });
      }
    }
  });

  // Compare Contacts
  if (importedData.contacts) {
    importedData.contacts.forEach(importedContact => {
      const lookupId = importedContact.lmn_contact_id || importedContact.id;
      const existing = existingContactsMap.get(lookupId);

      if (!existing) {
        comparison.contacts.new.push(importedContact);
      } else {
        const differences = findContactDifferences(importedContact, existing);
        if (differences.length > 0) {
          comparison.contacts.updated.push({
            contact: importedContact,
            existing: existing,
            differences: differences
          });
        } else {
          comparison.contacts.unchanged.push(importedContact);
        }
      }
    });
  }

  // Find orphaned contacts
  existingContacts.forEach(existingContact => {
    const lookupId = existingContact.lmn_contact_id || existingContact.id;
    if (!validIds.contactIds.has(lookupId)) {
      if (existingContact.lmn_contact_id) {
        const source = determineDataSource(existingContact, 'contact');
        comparison.contacts.orphaned.push({
          ...existingContact,
          _source: source.source,
          _sourceNote: source.note
        });
        comparison.warnings.push({
          type: 'orphaned_contact',
          message: `Contact "${existingContact.first_name} ${existingContact.last_name}" (ID: ${existingContact.lmn_contact_id}) exists in database but not in import sheets`,
          contact: existingContact,
          source: source.source,
          sourceNote: source.note
        });
      }
    }
  });

  // Compare Estimates
  if (importedData.estimates) {
    importedData.estimates.forEach(importedEstimate => {
      // Try multiple lookup strategies - normalize to string
      const lookupId = String(importedEstimate.lmn_estimate_id || importedEstimate.estimate_number || importedEstimate.id || '');
      let existing = existingEstimatesMap.get(lookupId);
      
      // Try uppercase if not found (case-insensitive matching)
      if (!existing && lookupId) {
        existing = existingEstimatesMap.get(lookupId.toUpperCase());
      }
      
      // Try lowercase if still not found
      if (!existing && lookupId) {
        existing = existingEstimatesMap.get(lookupId.toLowerCase());
      }
      
      // Try with "EST" prefix if it's missing
      if (!existing && lookupId && !lookupId.toUpperCase().startsWith('EST')) {
        existing = existingEstimatesMap.get('EST' + lookupId.toUpperCase());
      }
      
      // Try without "EST" prefix if it has it
      if (!existing && lookupId && lookupId.toUpperCase().startsWith('EST')) {
        const withoutPrefix = lookupId.substring(3);
        existing = existingEstimatesMap.get(withoutPrefix);
        if (!existing) {
          existing = existingEstimatesMap.get(withoutPrefix.toUpperCase());
        }
        if (!existing) {
          existing = existingEstimatesMap.get(withoutPrefix.toLowerCase());
        }
      }

      // Debug: Log first few estimates that aren't found, especially the problematic ones
      const problematicIds = ['EST5703935', 'EST5685587', 'EST5492985', 'EST5230771', 'EST5230791'];
      const isProblematic = problematicIds.includes(lookupId.toUpperCase()) || problematicIds.some(id => lookupId.toUpperCase().includes(id));
      
      if (!existing && (comparison.estimates.new.length < 5 || isProblematic)) {
        // Check if it exists in the database but with a different key
        const foundInDb = existingEstimates.find(e => {
          const dbLmnId = String(e.lmn_estimate_id || '').toUpperCase();
          const dbEstNum = String(e.estimate_number || '').toUpperCase();
          const lookupUpper = lookupId.toUpperCase();
          return dbLmnId === lookupUpper || dbEstNum === lookupUpper;
        });
        
        console.log('[compareWithExisting] Estimate not found in database:', {
          lookupId,
          lookupIdType: typeof lookupId,
          lmn_estimate_id: importedEstimate.lmn_estimate_id,
          lmn_estimate_idType: typeof importedEstimate.lmn_estimate_id,
          estimate_number: importedEstimate.estimate_number,
          estimate_numberType: typeof importedEstimate.estimate_number,
          id: importedEstimate.id,
          existingEstimatesCount: existingEstimates.length,
          mapSize: existingEstimatesMap.size,
          mapHasLookupId: existingEstimatesMap.has(lookupId),
          mapHasUppercase: existingEstimatesMap.has(lookupId.toUpperCase()),
          mapHasLowercase: existingEstimatesMap.has(lookupId.toLowerCase()),
          foundInDbButNotInMap: foundInDb ? {
            id: foundInDb.id,
            lmn_estimate_id: foundInDb.lmn_estimate_id,
            estimate_number: foundInDb.estimate_number
          } : null,
          sampleMapKeys: Array.from(existingEstimatesMap.keys()).slice(0, 10),
          sampleExistingIds: existingEstimates.slice(0, 10).map(e => ({
            id: e.id,
            lmn_estimate_id: e.lmn_estimate_id,
            lmn_estimate_idType: typeof e.lmn_estimate_id,
            estimate_number: e.estimate_number,
            estimate_numberType: typeof e.estimate_number,
            hasLmnId: !!e.lmn_estimate_id,
            hasEstimateNumber: !!e.estimate_number
          }))
        });
      }

      if (!existing) {
        comparison.estimates.new.push(importedEstimate);
      } else {
        const differences = findEstimateDifferences(importedEstimate, existing);
        if (differences.length > 0) {
          comparison.estimates.updated.push({
            estimate: importedEstimate,
            existing: existing,
            differences: differences
          });
        } else {
          comparison.estimates.unchanged.push(importedEstimate);
        }
      }
    });
  }

  // Find orphaned estimates (in DB but not in import sheets)
  existingEstimates.forEach(existingEstimate => {
    const lookupId = existingEstimate.lmn_estimate_id || existingEstimate.id;
    if (!validIds.estimateIds.has(lookupId)) {
      if (existingEstimate.lmn_estimate_id) {
        const source = determineDataSource(existingEstimate, 'estimate');
        comparison.estimates.orphaned.push({
          ...existingEstimate,
          _source: source.source,
          _sourceNote: source.note
        });
        comparison.warnings.push({
          type: 'orphaned_estimate',
          message: `Estimate "${existingEstimate.estimate_number || existingEstimate.lmn_estimate_id}" exists in database but not in import sheets`,
          estimate: existingEstimate,
          source: source.source,
          sourceNote: source.note
        });
      }
    }
  });

  // Compare Jobsites
  if (importedData.jobsites) {
    importedData.jobsites.forEach(importedJobsite => {
      const lookupId = importedJobsite.lmn_jobsite_id || importedJobsite.id;
      let existing = existingJobsitesMap.get(lookupId);
      
      // Try as string if not found
      if (!existing && lookupId) {
        existing = existingJobsitesMap.get(String(lookupId));
      }
      
      // Try as number if it's a string that looks like a number
      if (!existing && lookupId && typeof lookupId === 'string') {
        const numId = parseInt(lookupId, 10);
        if (!isNaN(numId)) {
          existing = existingJobsitesMap.get(numId);
        }
      }

      // Debug: Log first few jobsites that aren't found, especially the problematic ones
      const problematicJobsiteIds = ['7695461', '8526852', '3730678', '9703450', '9618131', '9906807', '6347524', '3948460', '5567721', '9471049', '7450257', '8561379', '9814225', '5246186', '6148702', '8629924', '8629925', '8700630'];
      const isProblematicJobsite = problematicJobsiteIds.includes(String(lookupId)) || problematicJobsiteIds.some(id => String(lookupId) === id);
      
      if (!existing && (comparison.jobsites.new.length < 5 || isProblematicJobsite)) {
        // Check if it exists in the database but with a different key
        const foundInDb = existingJobsites.find(j => {
          const dbJobsiteId = String(j.lmn_jobsite_id || '');
          const lookupStr = String(lookupId);
          return dbJobsiteId === lookupStr || dbJobsiteId === String(parseInt(lookupStr, 10)) || String(parseInt(dbJobsiteId, 10)) === lookupStr;
        });
        
        // Try all possible lookup variations
        const lookupVariations = [
          lookupId,
          String(lookupId),
          parseInt(String(lookupId), 10),
          lookupId.toString(),
          String(parseInt(lookupId, 10))
        ].filter(v => v !== null && v !== undefined && !isNaN(v));
        
        const mapChecks = {};
        lookupVariations.forEach(variant => {
          mapChecks[`has_${variant}_(${typeof variant})`] = existingJobsitesMap.has(variant);
        });
        
        console.log('[compareWithExisting] Jobsite not found in database:', {
          lookupId,
          lookupIdType: typeof lookupId,
          lmn_jobsite_id: importedJobsite.lmn_jobsite_id,
          lmn_jobsite_idType: typeof importedJobsite.lmn_jobsite_id,
          id: importedJobsite.id,
          name: importedJobsite.name,
          existingJobsitesCount: existingJobsites.length,
          mapSize: existingJobsitesMap.size,
          mapChecks,
          foundInDbButNotInMap: foundInDb ? {
            id: foundInDb.id,
            lmn_jobsite_id: foundInDb.lmn_jobsite_id,
            lmn_jobsite_idType: typeof foundInDb.lmn_jobsite_id,
            name: foundInDb.name
          } : null,
          sampleMapKeys: Array.from(existingJobsitesMap.keys()).slice(0, 20),
          sampleExistingIds: existingJobsites.slice(0, 10).map(j => ({
            id: j.id,
            lmn_jobsite_id: j.lmn_jobsite_id,
            lmn_jobsite_idType: typeof j.lmn_jobsite_id,
            name: j.name
          }))
        });
      }

      if (!existing) {
        comparison.jobsites.new.push(importedJobsite);
      } else {
        const differences = findJobsiteDifferences(importedJobsite, existing);
        if (differences.length > 0) {
          comparison.jobsites.updated.push({
            jobsite: importedJobsite,
            existing: existing,
            differences: differences
          });
        } else {
          comparison.jobsites.unchanged.push(importedJobsite);
        }
      }
    });
  }

  // Find orphaned jobsites
  existingJobsites.forEach(existingJobsite => {
    const lookupId = existingJobsite.lmn_jobsite_id || existingJobsite.id;
    if (!validIds.jobsiteIds.has(lookupId)) {
      if (existingJobsite.lmn_jobsite_id) {
        const source = determineDataSource(existingJobsite, 'jobsite');
        comparison.jobsites.orphaned.push({
          ...existingJobsite,
          _source: source.source,
          _sourceNote: source.note
        });
        comparison.warnings.push({
          type: 'orphaned_jobsite',
          message: `Jobsite "${existingJobsite.name || existingJobsite.lmn_jobsite_id}" exists in database but not in import sheets`,
          jobsite: existingJobsite,
          source: source.source,
          sourceNote: source.note
        });
      }
    }
  });

  return comparison;
}

/**
 * Find differences between imported and existing account
 */
function findAccountDifferences(imported, existing) {
  const differences = [];
  const fieldsToCompare = [
    'name', 'account_type', 'status', 'annual_revenue', 'industry',
    'website', 'phone', 'address_1', 'address_2', 'city', 'state',
    'postal_code', 'country', 'classification'
  ];

  fieldsToCompare.forEach(field => {
    const importedValue = imported[field];
    const existingValue = existing[field];
    
    // Normalize for comparison
    const normalizedImported = normalizeValue(importedValue);
    const normalizedExisting = normalizeValue(existingValue);

    if (normalizedImported !== normalizedExisting) {
      differences.push({
        field,
        imported: importedValue,
        existing: existingValue
      });
    }
  });

  return differences;
}

/**
 * Find differences between imported and existing contact
 */
function findContactDifferences(imported, existing) {
  const differences = [];
  const fieldsToCompare = [
    'first_name', 'last_name', 'email', 'email_2', 'phone', 'phone_2',
    'title', 'position', 'address_1', 'address_2', 'city', 'state',
    'postal_code', 'country'
  ];

  fieldsToCompare.forEach(field => {
    const importedValue = imported[field];
    const existingValue = existing[field];
    
    const normalizedImported = normalizeValue(importedValue);
    const normalizedExisting = normalizeValue(existingValue);

    if (normalizedImported !== normalizedExisting) {
      differences.push({
        field,
        imported: importedValue,
        existing: existingValue
      });
    }
  });

  return differences;
}

/**
 * Find differences between imported and existing estimate
 */
function findEstimateDifferences(imported, existing) {
  const differences = [];
  const fieldsToCompare = [
    'estimate_type', 'estimate_date', 'contract_start', 'contract_end',
    'total_price', 'total_price_with_tax', 'status', 'division',
    'project_name'
  ];

  fieldsToCompare.forEach(field => {
    const importedValue = imported[field];
    const existingValue = existing[field];
    
    const normalizedImported = normalizeValue(importedValue);
    const normalizedExisting = normalizeValue(existingValue);

    if (normalizedImported !== normalizedExisting) {
      differences.push({
        field,
        imported: importedValue,
        existing: existingValue
      });
    }
  });

  return differences;
}

/**
 * Find differences between imported and existing jobsite
 */
function findJobsiteDifferences(imported, existing) {
  const differences = [];
  const fieldsToCompare = [
    'name', 'address_1', 'address_2', 'city', 'state',
    'postal_code', 'country', 'notes'
  ];

  fieldsToCompare.forEach(field => {
    const importedValue = imported[field];
    const existingValue = existing[field];
    
    const normalizedImported = normalizeValue(importedValue);
    const normalizedExisting = normalizeValue(existingValue);

    if (normalizedImported !== normalizedExisting) {
      differences.push({
        field,
        imported: importedValue,
        existing: existingValue
      });
    }
  });

  return differences;
}

/**
 * Normalize value for comparison
 */
function normalizeValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return String(value).trim().toLowerCase();
}

/**
 * Determine the data source for a record
 * @param {Object} record - The database record
 * @param {string} type - Type of record ('account', 'contact', 'estimate', 'jobsite')
 * @returns {Object} - Object with source and note
 */
export function determineDataSource(record, type) {
  // Check for LMN import IDs (indicates previous import)
  if (type === 'account' && record.lmn_crm_id) {
    return {
      source: 'previous_import',
      note: `Imported from LMN (Account ID: ${record.lmn_crm_id}). This record was created during a previous import but is no longer present in the current import sheets.`
    };
  }
  
  if (type === 'contact' && record.lmn_contact_id) {
    return {
      source: 'previous_import',
      note: `Imported from LMN (Contact ID: ${record.lmn_contact_id}). This record was created during a previous import but is no longer present in the current import sheets.`
    };
  }
  
  if (type === 'estimate' && record.lmn_estimate_id) {
    // Check if it has a source field indicating import
    if (record.source === 'lmn_estimates_list') {
      return {
        source: 'previous_import',
        note: `Imported from LMN Estimates List (Estimate ID: ${record.lmn_estimate_id}). This record was created during a previous import but is no longer present in the current import sheets.`
      };
    }
    return {
      source: 'previous_import',
      note: `Imported from LMN (Estimate ID: ${record.lmn_estimate_id}). This record was created during a previous import but is no longer present in the current import sheets.`
    };
  }
  
  if (type === 'jobsite' && record.lmn_jobsite_id) {
    return {
      source: 'previous_import',
      note: `Imported from LMN (Jobsite ID: ${record.lmn_jobsite_id}). This record was created during a previous import but is no longer present in the current import sheets.`
    };
  }
  
  // Check for UUID format (indicates system-generated, possibly mock data)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (record.id && uuidRegex.test(record.id)) {
    // Check if created_at is recent (within last few days) - might be test data
    if (record.created_at) {
      const createdDate = new Date(record.created_at);
      const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 30) {
        return {
          source: 'possibly_mock',
          note: `This record has a UUID ID and was created recently (${Math.round(daysSinceCreation)} days ago). It may be test/mock data added during development.`
        };
      }
    }
    return {
      source: 'unknown',
      note: `This record has a UUID ID format. It may have been created manually or through a previous system version. Source cannot be definitively determined.`
    };
  }
  
  // Default: unknown source
  return {
    source: 'unknown',
    note: `Unable to determine the source of this record. It may have been created manually or through a previous system version.`
  };
}

/**
 * Validate that estimates and jobsites only reference valid account/contact IDs from sheets
 */
export function validateReferences(importedData, validIds) {
  const errors = [];
  const warnings = [];

  // Validate estimate references
  if (importedData.estimates) {
    importedData.estimates.forEach(estimate => {
      if (estimate.account_id && !validIds.accountIds.has(estimate.account_id)) {
        const accountId = estimate.account_id.split('-').pop(); // Extract numeric part
        if (!validIds.accountIds.has(accountId) && !validIds.accountIds.has(estimate.account_id)) {
          errors.push({
            type: 'invalid_reference',
            entity: 'estimate',
            entityId: estimate.lmn_estimate_id || estimate.id,
            field: 'account_id',
            value: estimate.account_id,
            message: `Estimate ${estimate.lmn_estimate_id || estimate.id} references account ${estimate.account_id} which is not in import sheets`
          });
        }
      }
      if (estimate.contact_id && !validIds.contactIds.has(estimate.contact_id)) {
        const contactId = estimate.contact_id.split('-').pop();
        if (!validIds.contactIds.has(contactId) && !validIds.contactIds.has(estimate.contact_id)) {
          errors.push({
            type: 'invalid_reference',
            entity: 'estimate',
            entityId: estimate.lmn_estimate_id || estimate.id,
            field: 'contact_id',
            value: estimate.contact_id,
            message: `Estimate ${estimate.lmn_estimate_id || estimate.id} references contact ${estimate.contact_id} which is not in import sheets`
          });
        }
      }
    });
  }

  // Validate jobsite references
  if (importedData.jobsites) {
    importedData.jobsites.forEach(jobsite => {
      if (jobsite.account_id && !validIds.accountIds.has(jobsite.account_id)) {
        const accountId = jobsite.account_id.split('-').pop();
        if (!validIds.accountIds.has(accountId) && !validIds.accountIds.has(jobsite.account_id)) {
          warnings.push({
            type: 'orphaned_jobsite',
            entity: 'jobsite',
            entityId: jobsite.lmn_jobsite_id || jobsite.id,
            message: `Jobsite ${jobsite.lmn_jobsite_id || jobsite.id} references account ${jobsite.account_id} which is not in import sheets`
          });
        }
      }
    });
  }

  return { errors, warnings };
}

