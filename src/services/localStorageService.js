/**
 * LocalStorage Service
 * Persists imported data to browser localStorage so it survives page reloads
 */

const STORAGE_KEYS = {
  accounts: 'lecrm_accounts',
  contacts: 'lecrm_contacts',
  estimates: 'lecrm_estimates',
  jobsites: 'lecrm_jobsites',
  lastUpdated: 'lecrm_last_updated'
};

/**
 * Save accounts to localStorage
 */
export function saveAccounts(accounts) {
  try {
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
    localStorage.setItem(STORAGE_KEYS.lastUpdated, Date.now().toString());
    console.log(`💾 Saved ${accounts.length} accounts to localStorage`);
    return true;
  } catch (error) {
    console.error('❌ Error saving accounts to localStorage:', error);
    // If quota exceeded, try to clear old data
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ localStorage quota exceeded, clearing old data...');
      clearAllData();
      try {
        localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
        console.log(`✅ Saved ${accounts.length} accounts after clearing`);
        return true;
      } catch (retryError) {
        console.error('❌ Still failed after clearing:', retryError);
        return false;
      }
    }
    return false;
  }
}

/**
 * Load accounts from localStorage
 */
export function loadAccounts() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.accounts);
    if (data) {
      const accounts = JSON.parse(data);
      console.log(`📂 Loaded ${accounts.length} accounts from localStorage`);
      return accounts;
    }
  } catch (error) {
    console.error('❌ Error loading accounts from localStorage:', error);
  }
  return [];
}

/**
 * Save contacts to localStorage
 */
export function saveContacts(contacts) {
  try {
    localStorage.setItem(STORAGE_KEYS.contacts, JSON.stringify(contacts));
    localStorage.setItem(STORAGE_KEYS.lastUpdated, Date.now().toString());
    console.log(`💾 Saved ${contacts.length} contacts to localStorage`);
    return true;
  } catch (error) {
    console.error('❌ Error saving contacts to localStorage:', error);
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ localStorage quota exceeded, clearing old data...');
      clearAllData();
      try {
        localStorage.setItem(STORAGE_KEYS.contacts, JSON.stringify(contacts));
        console.log(`✅ Saved ${contacts.length} contacts after clearing`);
        return true;
      } catch (retryError) {
        console.error('❌ Still failed after clearing:', retryError);
        return false;
      }
    }
    return false;
  }
}

/**
 * Load contacts from localStorage
 */
export function loadContacts() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.contacts);
    if (data) {
      const contacts = JSON.parse(data);
      console.log(`📂 Loaded ${contacts.length} contacts from localStorage`);
      return contacts;
    }
  } catch (error) {
    console.error('❌ Error loading contacts from localStorage:', error);
  }
  return [];
}

/**
 * Save estimates to localStorage
 */
export function saveEstimates(estimates) {
  try {
    localStorage.setItem(STORAGE_KEYS.estimates, JSON.stringify(estimates));
    localStorage.setItem(STORAGE_KEYS.lastUpdated, Date.now().toString());
    console.log(`💾 Saved ${estimates.length} estimates to localStorage`);
    return true;
  } catch (error) {
    console.error('❌ Error saving estimates to localStorage:', error);
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ localStorage quota exceeded');
      return false;
    }
    return false;
  }
}

/**
 * Load estimates from localStorage
 */
export function loadEstimates() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.estimates);
    if (data) {
      const estimates = JSON.parse(data);
      console.log(`📂 Loaded ${estimates.length} estimates from localStorage`);
      return estimates;
    }
  } catch (error) {
    console.error('❌ Error loading estimates from localStorage:', error);
  }
  return [];
}

/**
 * Save jobsites to localStorage
 */
export function saveJobsites(jobsites) {
  try {
    localStorage.setItem(STORAGE_KEYS.jobsites, JSON.stringify(jobsites));
    localStorage.setItem(STORAGE_KEYS.lastUpdated, Date.now().toString());
    console.log(`💾 Saved ${jobsites.length} jobsites to localStorage`);
    return true;
  } catch (error) {
    console.error('❌ Error saving jobsites to localStorage:', error);
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ localStorage quota exceeded');
      return false;
    }
    return false;
  }
}

/**
 * Load jobsites from localStorage
 */
export function loadJobsites() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.jobsites);
    if (data) {
      const jobsites = JSON.parse(data);
      console.log(`📂 Loaded ${jobsites.length} jobsites from localStorage`);
      return jobsites;
    }
  } catch (error) {
    console.error('❌ Error loading jobsites from localStorage:', error);
  }
  return [];
}

/**
 * Upsert an account (create or update)
 */
export function upsertAccount(account, lookupField = 'lmn_crm_id') {
  const accounts = loadAccounts();
  const existingIndex = accounts.findIndex(a => 
    a[lookupField] && account[lookupField] && a[lookupField] === account[lookupField]
  );
  
  if (existingIndex >= 0) {
    // Update existing
    accounts[existingIndex] = { ...accounts[existingIndex], ...account };
    saveAccounts(accounts);
    return { ...accounts[existingIndex], _action: 'updated' };
  } else {
    // Create new
    const newAccount = { ...account, id: account.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
    accounts.push(newAccount);
    saveAccounts(accounts);
    return { ...newAccount, _action: 'created' };
  }
}

/**
 * Upsert a contact (create or update)
 */
export function upsertContact(contact, lookupField = 'lmn_contact_id') {
  const contacts = loadContacts();
  const existingIndex = contacts.findIndex(c => 
    c[lookupField] && contact[lookupField] && c[lookupField] === contact[lookupField]
  );
  
  if (existingIndex >= 0) {
    // Update existing
    contacts[existingIndex] = { ...contacts[existingIndex], ...contact };
    saveContacts(contacts);
    return { ...contacts[existingIndex], _action: 'updated' };
  } else {
    // Create new
    const newContact = { ...contact, id: contact.id || `cont_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
    contacts.push(newContact);
    saveContacts(contacts);
    return { ...newContact, _action: 'created' };
  }
}

/**
 * Upsert an estimate (create or update)
 */
export function upsertEstimate(estimate, lookupField = 'lmn_estimate_id') {
  const estimates = loadEstimates();
  const existingIndex = estimates.findIndex(e => 
    e[lookupField] && estimate[lookupField] && e[lookupField] === estimate[lookupField]
  );
  
  if (existingIndex >= 0) {
    // Update existing
    estimates[existingIndex] = { ...estimates[existingIndex], ...estimate };
    saveEstimates(estimates);
    return { ...estimates[existingIndex], _action: 'updated' };
  } else {
    // Create new
    const newEstimate = { ...estimate, id: estimate.id || `est_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
    estimates.push(newEstimate);
    saveEstimates(estimates);
    return { ...newEstimate, _action: 'created' };
  }
}

/**
 * Upsert a jobsite (create or update)
 */
export function upsertJobsite(jobsite, lookupField = 'lmn_jobsite_id') {
  const jobsites = loadJobsites();
  const existingIndex = jobsites.findIndex(j => 
    j[lookupField] && jobsite[lookupField] && j[lookupField] === jobsite[lookupField]
  );
  
  if (existingIndex >= 0) {
    // Update existing
    jobsites[existingIndex] = { ...jobsites[existingIndex], ...jobsite };
    saveJobsites(jobsites);
    return { ...jobsites[existingIndex], _action: 'updated' };
  } else {
    // Create new
    const newJobsite = { ...jobsite, id: jobsite.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
    jobsites.push(newJobsite);
    saveJobsites(jobsites);
    return { ...newJobsite, _action: 'created' };
  }
}

/**
 * Clear all LECRM data from localStorage
 */
export function clearAllData() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🗑️ Cleared all LECRM data from localStorage');
    return true;
  } catch (error) {
    console.error('❌ Error clearing localStorage:', error);
    return false;
  }
}

/**
 * Get storage stats
 */
export function getStorageStats() {
  const accounts = loadAccounts();
  const contacts = loadContacts();
  const estimates = loadEstimates();
  const jobsites = loadJobsites();
  const lastUpdated = localStorage.getItem(STORAGE_KEYS.lastUpdated);
  
  return {
    accounts: accounts.length,
    contacts: contacts.length,
    estimates: estimates.length,
    jobsites: jobsites.length,
    lastUpdated: lastUpdated ? new Date(parseInt(lastUpdated)).toISOString() : null
  };
}












