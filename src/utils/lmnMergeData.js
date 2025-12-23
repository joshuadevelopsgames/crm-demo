/**
 * Merge data from both LMN CSV exports
 * Combines Contacts Export (IDs, Tags, Archived) with Leads List (Position, Do Not fields)
 * Also integrates Estimates List and Jobsite Export to calculate revenue and scores
 */

/**
 * Merge contact data from all CSVs
 */
export function mergeContactData(contactsExportData, leadsListData, estimatesData, jobsitesData) {
  const { accounts, contacts: baseContacts } = contactsExportData;
  const { contactsData: supplementalData } = leadsListData;
  const estimates = estimatesData?.estimates || [];
  const jobsites = jobsitesData?.jobsites || [];
  
  // Helper functions for matching (defined before use)
  const normalizeName = (name) => {
    if (!name) return '';
    return name.toLowerCase()
      .trim()
      .replace(/[.,\-_]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/gi, '') // Remove common suffixes
      .trim();
  };

  const normalizePhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/\D/g, ''); // Remove all non-digits
  };

  const fuzzyMatchNames = (name1, name2) => {
    if (!name1 || !name2) return false;
    const n1 = normalizeName(name1);
    const n2 = normalizeName(name2);
    
    // Exact match after normalization
    if (n1 === n2) return true;
    
    // Check if one contains the other (for partial matches)
    if (n1.length > 5 && n2.length > 5) {
      if (n1.includes(n2) || n2.includes(n1)) return true;
    }
    
    // Calculate similarity (simple Levenshtein-like check)
    const similarity = calculateSimilarity(n1, n2);
    return similarity > 0.85; // 85% similarity threshold
  };

  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    // Simple character overlap check
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  };

  // Create lookup map for supplemental data (from Leads List)
  const supplementalMap = new Map();
  const supplementalEmailMap = new Map();
  const supplementalPhoneMap = new Map();
  const supplementalNameMap = new Map(); // normalized name -> supplemental data
  
  supplementalData.forEach(supp => {
    const key = supp.match_key;
    if (key) {
      supplementalMap.set(key, supp);
    }
    
    // Email lookup
    if (supp.email_1) {
      supplementalEmailMap.set(supp.email_1.toLowerCase(), supp);
    }
    
    // Phone lookup
    if (supp.phone_1) {
      const normalizedPhone = normalizePhone(supp.phone_1);
      if (normalizedPhone) {
        supplementalPhoneMap.set(normalizedPhone, supp);
      }
    }
    
    // Name lookup (for fuzzy matching)
    if (supp.first_name && supp.last_name) {
      const normalizedName = normalizeName(`${supp.first_name} ${supp.last_name}`);
      if (!supplementalNameMap.has(normalizedName)) {
        supplementalNameMap.set(normalizedName, supp);
      }
    }
  });

  // Merge data into contacts with improved matching
  const mergedContacts = baseContacts.map(contact => {
    let supplemental = null;
    
    // Method 1: Try exact match key (first name + last name + email)
    const matchKey = createMatchKey(
      contact.first_name, 
      contact.last_name, 
      contact.email_1, 
      contact.email_2
    );
    supplemental = supplementalMap.get(matchKey);
    
    // Method 2: Try email-only match
    if (!supplemental && contact.email_1) {
      supplemental = supplementalEmailMap.get(contact.email_1.toLowerCase());
    }
    if (!supplemental && contact.email) {
      supplemental = supplementalEmailMap.get(contact.email.toLowerCase());
    }
    
    // Method 3: Try phone number match
    if (!supplemental && contact.phone_1) {
      const normalizedPhone = normalizePhone(contact.phone_1);
      if (normalizedPhone) {
        supplemental = supplementalPhoneMap.get(normalizedPhone);
      }
    }
    
    // Method 4: Try fuzzy name matching (for typos)
    if (!supplemental && contact.first_name && contact.last_name) {
      const contactName = normalizeName(`${contact.first_name} ${contact.last_name}`);
      
      // Try exact match first
      supplemental = supplementalNameMap.get(contactName);
      
      // Try fuzzy match if exact match fails
      if (!supplemental) {
        for (const [normalizedName, supp] of supplementalNameMap.entries()) {
          if (fuzzyMatchNames(contactName, normalizedName)) {
            supplemental = supp;
            break;
          }
        }
      }
    }

    // Merge supplemental data if found
    if (supplemental) {
      const position = supplemental.position || contact.position || '';
      
      return {
        ...contact,
        position: position,
        title: position, // Use position as title
        role: contact.role || determineRoleFromPosition(position),
        do_not_email: supplemental.do_not_email !== null ? supplemental.do_not_email : false,
        do_not_mail: supplemental.do_not_mail !== null ? supplemental.do_not_mail : false,
        do_not_call: supplemental.do_not_call !== null ? supplemental.do_not_call : false,
        referral_source: supplemental.referral_source || '',
        // Merge notes
        notes: mergeNotes(contact.notes, supplemental.notes_supplement),
        data_source: 'merged',
        matched: true
      };
    }

    // No match found - use base data only
    return {
      ...contact,
      position: '',
      title: contact.title || '',
      role: contact.role || 'user',
      do_not_email: false,
      do_not_mail: false,
      do_not_call: false,
      data_source: 'contacts_export_only',
      matched: false
    };
  });

  // Calculate stats
  const matchedCount = mergedContacts.filter(c => c.matched).length;
  const unmatchedCount = mergedContacts.filter(c => !c.matched).length;

  // Create contact ID to account ID mapping
  const contactToAccountMap = new Map();
  mergedContacts.forEach(contact => {
    if (contact.lmn_contact_id && contact.account_id) {
      contactToAccountMap.set(contact.lmn_contact_id, contact.account_id);
    }
  });

  // Create account name to account ID mapping (for fallback matching)
  const accountNameToIdMap = new Map();
  accounts.forEach((account, crmId) => {
    if (account.name) {
      accountNameToIdMap.set(account.name.toLowerCase().trim(), account.id);
    }
  });

  // Create account ID to account object mapping for easy updates
  const accountsArray = Array.from(accounts.values());
  const accountMap = new Map();
  accountsArray.forEach(account => {
    accountMap.set(account.id, account);
  });

  // Track estimate linking stats
  const estimateLinkingStats = {
    linkedByContactId: 0,
    linkedByEmail: 0,
    linkedByPhone: 0,
    linkedByNameMatch: 0,
    linkedByCrmTags: 0,
    linkedByAddress: 0,
    orphaned: 0,
    total: estimates.length
  };

  // Track jobsite linking stats
  const jobsiteLinkingStats = {
    linkedByContactId: 0,
    linkedByNameMatch: 0,
    linkedByAddress: 0,
    linkedByJobsiteName: 0,
    orphaned: 0,
    total: jobsites.length
  };

  // Helper to normalize addresses for matching (if not already defined)
  const normalizeAddress = (address) => {
    if (!address) return '';
    return address.toLowerCase()
      .trim()
      .replace(/[.,#]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|lane|ln)\b/gi, '')
      .trim();
  };

  // Create lookup maps for faster matching
  const accountNameMap = new Map(); // normalized name -> account
  const accountPhoneMap = new Map(); // normalized phone -> account
  const accountAddressMap = new Map(); // normalized address -> account
  const contactEmailMap = new Map(); // email -> contact
  const contactPhoneMap = new Map(); // normalized phone -> contact

  accountsArray.forEach(account => {
    if (account.name) {
      const normalized = normalizeName(account.name);
      if (!accountNameMap.has(normalized)) {
        accountNameMap.set(normalized, account);
      }
    }
    // Store account address for matching
    if (account.address_1) {
      const normalized = normalizeAddress(account.address_1);
      if (normalized && !accountAddressMap.has(normalized)) {
        accountAddressMap.set(normalized, account);
      }
    }
  });

  mergedContacts.forEach(contact => {
    // Map emails to contacts
    if (contact.email_1) {
      contactEmailMap.set(contact.email_1.toLowerCase(), contact);
    }
    if (contact.email) {
      contactEmailMap.set(contact.email.toLowerCase(), contact);
    }
    // Map phones to contacts
    if (contact.phone_1) {
      const normalized = normalizePhone(contact.phone_1);
      if (normalized) {
        contactPhoneMap.set(normalized, contact);
      }
    }
  });

  // Create a lookup map for contact ID -> account ID for faster matching
  const contactIdToAccountMap = new Map();
  mergedContacts.forEach(contact => {
    if (contact.lmn_contact_id && contact.account_id) {
      // Store both exact match and trimmed match (in case of whitespace issues)
      const contactId = String(contact.lmn_contact_id).trim();
      if (contactId) {
        contactIdToAccountMap.set(contactId, contact.account_id);
        // Also store lowercase version for case-insensitive matching
        contactIdToAccountMap.set(contactId.toLowerCase(), contact.account_id);
      }
    }
  });

  // First pass: Link estimates to accounts with improved matching
  const estimatesWithAccountId = estimates.map(estimate => {
    let linkedAccountId = null;
    let linkMethod = null;

    // Method 1: Match by contact ID (most reliable - ID-based)
    if (estimate.lmn_contact_id) {
      const estimateContactId = String(estimate.lmn_contact_id).trim();
      if (estimateContactId) {
        // Try exact match first
        linkedAccountId = contactIdToAccountMap.get(estimateContactId);
        // Try case-insensitive match
        if (!linkedAccountId) {
          linkedAccountId = contactIdToAccountMap.get(estimateContactId.toLowerCase());
        }
        // Fallback: search in merged contacts (in case of formatting differences)
        if (!linkedAccountId) {
          const contact = mergedContacts.find(c => {
            if (!c.lmn_contact_id) return false;
            const contactId = String(c.lmn_contact_id).trim();
            return contactId === estimateContactId || 
                   contactId.toLowerCase() === estimateContactId.toLowerCase();
          });
          if (contact && contact.account_id) {
            linkedAccountId = contact.account_id;
          }
        }
        if (linkedAccountId) {
          linkMethod = 'contact_id';
          estimateLinkingStats.linkedByContactId++;
        }
      }
    }

    // Method 2: Match by email -> contact -> account
    if (!linkedAccountId && estimate.email) {
      const contact = contactEmailMap.get(estimate.email.toLowerCase());
      if (contact && contact.account_id) {
        linkedAccountId = contact.account_id;
        linkMethod = 'email_to_contact';
        estimateLinkingStats.linkedByEmail++;
      }
    }

    // Method 3: Match by phone -> contact -> account
    if (!linkedAccountId && estimate.phone_1) {
      const normalizedPhone = normalizePhone(estimate.phone_1);
      if (normalizedPhone) {
        const contact = contactPhoneMap.get(normalizedPhone);
        if (contact && contact.account_id) {
          linkedAccountId = contact.account_id;
          linkMethod = 'phone_to_contact';
          estimateLinkingStats.linkedByPhone++;
        }
      }
    }

    // Method 4: Match by contact name matching account name (fuzzy)
    if (!linkedAccountId && estimate.contact_name) {
      const estimateContactName = normalizeName(estimate.contact_name);
      
      // Try exact match first
      let matchedAccount = accountNameMap.get(estimateContactName);
      
      // Try fuzzy match if exact match fails
      if (!matchedAccount) {
        for (const [normalizedName, account] of accountNameMap.entries()) {
          if (fuzzyMatchNames(estimateContactName, normalizedName)) {
            matchedAccount = account;
            break;
          }
        }
      }
      
      if (matchedAccount) {
        linkedAccountId = matchedAccount.id;
        linkMethod = 'name_match_fuzzy';
        estimateLinkingStats.linkedByNameMatch++;
      }
    }

    // Method 5: Match via CRM tags (improved - handles comma-separated tags, multiple formats)
    if (!linkedAccountId && estimate.crm_tags) {
      const crmTagsLower = estimate.crm_tags.toLowerCase().trim();
      // Split by comma and try each tag
      const tagList = crmTagsLower.split(',').map(t => t.trim()).filter(t => t);
      
      for (const account of accountsArray) {
        if (account.lmn_crm_id) {
          const crmIdLower = String(account.lmn_crm_id).toLowerCase().trim();
          
          // Check if any tag matches the CRM ID
          const tagMatches = tagList.some(tag => {
            return tag === crmIdLower || 
                   tag.includes(crmIdLower) || 
                   crmIdLower.includes(tag) ||
                   tag.replace(/\s+/g, '') === crmIdLower.replace(/\s+/g, ''); // Remove spaces and compare
          });
          
          if (tagMatches) {
            linkedAccountId = account.id;
            linkMethod = 'crm_tags';
            estimateLinkingStats.linkedByCrmTags++;
            break;
          }
        }
      }
    }

    // Method 6: Match by address (if estimate has address)
    if (!linkedAccountId && estimate.address) {
      const normalizedEstAddress = normalizeAddress(estimate.address);
      if (normalizedEstAddress) {
        for (const [normalizedAddr, account] of accountAddressMap.entries()) {
          if (fuzzyMatchNames(normalizedEstAddress, normalizedAddr)) {
            linkedAccountId = account.id;
            linkMethod = 'address_match';
            estimateLinkingStats.linkedByAddress++;
            break;
          }
        }
      }
    }

    // Track orphaned estimates
    if (!linkedAccountId) {
      estimateLinkingStats.orphaned++;
    }

    return {
      ...estimate,
      account_id: linkedAccountId,
      _link_method: linkMethod, // Internal tracking field
      _is_orphaned: !linkedAccountId
    };
  });

  // Link jobsites to accounts with improved matching
  const jobsitesWithAccountId = jobsites.map(jobsite => {
    let linkedAccountId = null;
    let linkMethod = null;

    // Method 1: Match by contact ID (most reliable - ID-based)
    if (jobsite.lmn_contact_id) {
      const jobsiteContactId = String(jobsite.lmn_contact_id).trim();
      if (jobsiteContactId) {
        // Try exact match first
        linkedAccountId = contactIdToAccountMap.get(jobsiteContactId);
        // Try case-insensitive match
        if (!linkedAccountId) {
          linkedAccountId = contactIdToAccountMap.get(jobsiteContactId.toLowerCase());
        }
        // Fallback: search in merged contacts (in case of formatting differences)
        if (!linkedAccountId) {
          const contact = mergedContacts.find(c => {
            if (!c.lmn_contact_id) return false;
            const contactId = String(c.lmn_contact_id).trim();
            return contactId === jobsiteContactId || 
                   contactId.toLowerCase() === jobsiteContactId.toLowerCase();
          });
          if (contact && contact.account_id) {
            linkedAccountId = contact.account_id;
          }
        }
        if (linkedAccountId) {
          linkMethod = 'contact_id';
          jobsiteLinkingStats.linkedByContactId++;
        }
      }
    }

    // Method 2: Match by contact name matching account name (fuzzy)
    if (!linkedAccountId && jobsite.contact_name) {
      const jobsiteContactName = normalizeName(jobsite.contact_name);
      
      // Try exact match first
      let matchedAccount = accountNameMap.get(jobsiteContactName);
      
      // Try fuzzy match if exact match fails
      if (!matchedAccount) {
        for (const [normalizedName, account] of accountNameMap.entries()) {
          if (fuzzyMatchNames(jobsiteContactName, normalizedName)) {
            matchedAccount = account;
            break;
          }
        }
      }
      
      if (matchedAccount) {
        linkedAccountId = matchedAccount.id;
        linkMethod = 'name_match_fuzzy';
        jobsiteLinkingStats.linkedByNameMatch++;
      }
    }

    // Method 3: Match by address (jobsites have addresses)
    if (!linkedAccountId && jobsite.address_1) {
      const normalizedJobsiteAddress = normalizeAddress(jobsite.address_1);
      if (normalizedJobsiteAddress) {
        // Try exact match first
        let matchedAccount = accountAddressMap.get(normalizedJobsiteAddress);
        
        // Try fuzzy match if exact match fails
        if (!matchedAccount) {
          for (const [normalizedAddr, account] of accountAddressMap.entries()) {
            if (fuzzyMatchNames(normalizedJobsiteAddress, normalizedAddr)) {
              matchedAccount = account;
              break;
            }
          }
        }
        
        if (matchedAccount) {
          linkedAccountId = matchedAccount.id;
          linkMethod = 'address_match';
          jobsiteLinkingStats.linkedByAddress++;
        }
      }
    }

    // Method 4: Match by jobsite name containing account name
    if (!linkedAccountId && jobsite.name) {
      const jobsiteName = normalizeName(jobsite.name);
      for (const [normalizedName, account] of accountNameMap.entries()) {
        if (jobsiteName.includes(normalizedName) || normalizedName.includes(jobsiteName)) {
          linkedAccountId = account.id;
          linkMethod = 'jobsite_name_match';
          jobsiteLinkingStats.linkedByJobsiteName++;
          break;
        }
      }
    }

    // Track orphaned jobsites
    if (!linkedAccountId) {
      jobsiteLinkingStats.orphaned++;
    }

    return {
      ...jobsite,
      account_id: linkedAccountId,
      _link_method: linkMethod, // Internal tracking field
      _is_orphaned: !linkedAccountId
    };
  });

  // Calculate revenue and scores for each account
  // NOTE: organization_score is now primarily set by scorecards, not automatic calculation
  // Only set automatic score if account doesn't already have a scorecard-based score
  accountsArray.forEach(account => {
    // Find all estimates for this account (now using account_id field)
    const accountEstimates = estimatesWithAccountId.filter(est => 
      est.account_id === account.id
    );

    // Calculate revenue from won estimates for current year using contract-year allocation
    // Import the calculation function (using inline version to avoid circular dependencies)
    const currentYear = new Date().getFullYear();
    const calculateDurationMonths = (startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      const dayDiff = end.getDate() - start.getDate();
      let totalMonths = yearDiff * 12 + monthDiff;
      if (dayDiff > 0) {
        totalMonths += 1;
      }
      return totalMonths;
    };
    const getContractYears = (durationMonths) => {
      if (durationMonths <= 12) return 1;
      if (durationMonths <= 24) return 2;
      if (durationMonths <= 36) return 3;
      if (durationMonths % 12 === 0) {
        return durationMonths / 12;
      }
      return Math.ceil(durationMonths / 12);
    };
    const getEstimateYearData = (estimate, currentYear) => {
      const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
      const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
      const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
      const totalPrice = parseFloat(estimate.total_price_with_tax) || 0;
      if (totalPrice === 0) return null;
      if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
        const startYear = contractStart.getFullYear();
        const durationMonths = calculateDurationMonths(contractStart, contractEnd);
        if (durationMonths <= 0) return null;
        const yearsCount = getContractYears(durationMonths);
        const yearsApplied = [];
        for (let i = 0; i < yearsCount; i++) {
          yearsApplied.push(startYear + i);
        }
        const appliesToCurrentYear = yearsApplied.includes(currentYear);
        const annualAmount = totalPrice / yearsCount;
        return {
          appliesToCurrentYear,
          value: appliesToCurrentYear ? annualAmount : 0
        };
      }
      if (contractStart && !isNaN(contractStart.getTime())) {
        const startYear = contractStart.getFullYear();
        return {
          appliesToCurrentYear: currentYear === startYear,
          value: totalPrice
        };
      }
      if (estimateDate && !isNaN(estimateDate.getTime())) {
        const estimateYear = estimateDate.getFullYear();
        return {
          appliesToCurrentYear: currentYear === estimateYear,
          value: totalPrice
        };
      }
      return null;
    };
    const wonEstimates = accountEstimates.filter(est => est.status === 'won');
    const totalRevenue = wonEstimates.reduce((sum, est) => {
      const yearData = getEstimateYearData(est, currentYear);
      if (!yearData || !yearData.appliesToCurrentYear) return sum;
      return sum + (isNaN(yearData.value) ? 0 : yearData.value);
    }, 0);

    // Count jobsites for this account (now using account_id field from jobsites)
    const accountJobsites = jobsitesWithAccountId.filter(jobsite => 
      jobsite.account_id === account.id
    );

    // Update account with calculated revenue
    account.annual_revenue = totalRevenue > 0 ? totalRevenue : null;
    
    // Only calculate automatic score if account doesn't already have a scorecard-based score
    // Scorecard scores take priority - they are set when scorecards are completed
    // We don't set organization_score here to preserve existing scorecard scores
    // account.organization_score should be set by scorecard completions, not automatic calculation
  });

  // Filter orphaned jobsites for easy access
  const orphanedJobsites = jobsitesWithAccountId.filter(jobsite => jobsite._is_orphaned);

  return {
    accounts: accountsArray,
    contacts: mergedContacts,
    estimates: estimatesWithAccountId, // Use estimates with account_id
    jobsites: jobsitesWithAccountId, // Use jobsites with account_id
    orphanedJobsites: orphanedJobsites, // Jobsites that couldn't be linked
    stats: {
      totalAccounts: accounts.size,
      totalContacts: mergedContacts.length,
      matchedContacts: matchedCount,
      unmatchedContacts: unmatchedCount,
      matchRate: mergedContacts.length > 0 
        ? Math.round((matchedCount / mergedContacts.length) * 100) 
        : 0,
      // Estimate linking stats
      estimateLinking: {
        total: estimateLinkingStats.total,
        linked: estimateLinkingStats.linkedByContactId + estimateLinkingStats.linkedByEmail + 
                estimateLinkingStats.linkedByPhone + estimateLinkingStats.linkedByNameMatch + 
                estimateLinkingStats.linkedByCrmTags + estimateLinkingStats.linkedByAddress,
        orphaned: estimateLinkingStats.orphaned,
        linkedByContactId: estimateLinkingStats.linkedByContactId,
        linkedByEmail: estimateLinkingStats.linkedByEmail,
        linkedByPhone: estimateLinkingStats.linkedByPhone,
        linkedByNameMatch: estimateLinkingStats.linkedByNameMatch,
        linkedByCrmTags: estimateLinkingStats.linkedByCrmTags,
        linkedByAddress: estimateLinkingStats.linkedByAddress,
        linkRate: estimateLinkingStats.total > 0
          ? Math.round(((estimateLinkingStats.linkedByContactId + estimateLinkingStats.linkedByEmail + 
                         estimateLinkingStats.linkedByPhone + estimateLinkingStats.linkedByNameMatch + 
                         estimateLinkingStats.linkedByCrmTags + estimateLinkingStats.linkedByAddress) / estimateLinkingStats.total) * 100)
          : 0
      },
      // Jobsite linking stats
      jobsiteLinking: {
        total: jobsiteLinkingStats.total,
        linked: jobsiteLinkingStats.linkedByContactId + jobsiteLinkingStats.linkedByNameMatch + 
                jobsiteLinkingStats.linkedByAddress + jobsiteLinkingStats.linkedByJobsiteName,
        orphaned: jobsiteLinkingStats.orphaned,
        linkedByContactId: jobsiteLinkingStats.linkedByContactId,
        linkedByNameMatch: jobsiteLinkingStats.linkedByNameMatch,
        linkedByAddress: jobsiteLinkingStats.linkedByAddress,
        linkedByJobsiteName: jobsiteLinkingStats.linkedByJobsiteName,
        linkRate: jobsiteLinkingStats.total > 0
          ? Math.round(((jobsiteLinkingStats.linkedByContactId + jobsiteLinkingStats.linkedByNameMatch + 
                         jobsiteLinkingStats.linkedByAddress + jobsiteLinkingStats.linkedByJobsiteName) / jobsiteLinkingStats.total) * 100)
          : 0
      }
    }
  };
}

/**
 * Calculate account score based on revenue, estimates, and jobsites
 * Returns a score from 0-100
 */
function calculateAccountScore({ revenue, totalEstimates, wonEstimates, lostEstimates, jobsitesCount }) {
  let score = 0;

  // Revenue component (0-50 points)
  // Scale: $0 = 0, $100k = 25, $500k+ = 50
  if (revenue > 0) {
    if (revenue >= 500000) {
      score += 50;
    } else if (revenue >= 100000) {
      score += 25 + ((revenue - 100000) / 400000) * 25; // 25-50 range
    } else {
      score += (revenue / 100000) * 25; // 0-25 range
    }
  }

  // Win rate component (0-30 points)
  // Higher win rate = more points
  const decidedEstimates = wonEstimates + lostEstimates;
  if (decidedEstimates > 0) {
    const winRate = wonEstimates / decidedEstimates;
    score += winRate * 30; // 0-30 points based on win rate
  }

  // Activity component (0-20 points)
  // More estimates and jobsites = more activity = higher score
  const activityScore = Math.min(
    (totalEstimates * 2) + (jobsitesCount * 3),
    20
  );
  score += activityScore;

  // Round to nearest integer and cap at 100
  return Math.min(Math.round(score), 100);
}

/**
 * Create match key for contact matching
 */
function createMatchKey(firstName, lastName, email1, email2) {
  const parts = [];
  
  if (firstName) parts.push(firstName.toLowerCase().trim());
  if (lastName) parts.push(lastName.toLowerCase().trim());
  if (email1) parts.push(email1.toLowerCase().trim());
  
  return parts.join('|');
}

/**
 * Merge notes from both sources
 */
function mergeNotes(notes1, notes2) {
  const parts = [];
  
  if (notes1) parts.push(notes1);
  if (notes2 && notes2 !== notes1) parts.push(notes2);
  
  return parts.join('\n\n');
}

/**
 * Determine role from position/title
 */
function determineRoleFromPosition(position) {
  if (!position) return 'user';
  
  const normalized = position.toLowerCase();
  
  // Decision makers
  if (normalized.includes('owner') || normalized.includes('ceo') || 
      normalized.includes('president') || normalized.includes('cfo') ||
      normalized.includes('coo') || normalized.includes('founder')) {
    return 'decision_maker';
  }
  
  // Influencers
  if (normalized.includes('manager') || normalized.includes('director') || 
      normalized.includes('head of') || normalized.includes('vp') ||
      normalized.includes('vice president')) {
    return 'influencer';
  }
  
  // Default
  return 'user';
}



