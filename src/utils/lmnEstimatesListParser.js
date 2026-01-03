/**
 * LMN Estimates List Parser
 * Parses the "Estimates List.xlsx" file
 */

/**
 * Parse Estimates List CSV/XLSX data
 * Returns: { estimates: [], stats: {} }
 */
export function parseEstimatesList(csvTextOrRows) {
  try {
    // If it's already an array of arrays (from XLSX), use it directly
    // Otherwise, parse CSV text
    const rows = Array.isArray(csvTextOrRows) && Array.isArray(csvTextOrRows[0])
      ? csvTextOrRows
      : parseCSV(csvTextOrRows);
    
    if (!rows || rows.length < 2) {
      return { estimates: [], stats: { error: 'Empty or invalid file' } };
    }

    const headers = rows[0];
    if (!Array.isArray(headers) || headers.length === 0) {
      return { estimates: [], stats: { error: 'Invalid file format - no headers found' } };
    }

    // Map column indices
    // Use trim() to handle any whitespace issues in column headers
    // Also use case-insensitive matching and partial matching for robustness
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
      estimateType: findColumn('Estimate Type'),
      estimateId: findColumn('Estimate ID', 'Estimate #', 'Estimate Number'),
      estimateDate: findColumn('Estimate Date'),
      estimateCloseDate: findColumn('Estimate Close Date', 'Close Date'),
      contractStart: findColumn('Contract Start', 'Contract Start Date'),
      contractEnd: findColumn('Contract End', 'Contract End Date', 'Renewal Date'),
      projectName: headers.findIndex(h => h === 'Project Name'),
      version: headers.findIndex(h => h === 'Version'),
      contactName: headers.findIndex(h => h === 'Contact Name'),
      crmTags: headers.findIndex(h => h === 'CRM Tags'),
      contactId: headers.findIndex(h => h === 'Contact ID'),
      address: headers.findIndex(h => h === 'Address'),
      billingAddress: headers.findIndex(h => h === 'Billing Address'),
      phone1: headers.findIndex(h => h === 'Phone 1'),
      phone2: headers.findIndex(h => h === 'Phone 2'),
      email: headers.findIndex(h => h === 'Email'),
      salesperson: headers.findIndex(h => h === 'Salesperson'),
      estimator: headers.findIndex(h => h === 'Estimator'),
      status: headers.findIndex(h => h === 'Status'),
      salesPipelineStatus: headers.findIndex(h => h === 'Sales Pipeline Status'),
      proposalFirstShared: headers.findIndex(h => h === 'Proposal First Shared'),
      proposalLastShared: headers.findIndex(h => h === 'Proposal Last Shared'),
      proposalLastUpdated: headers.findIndex(h => h === 'Proposal Last Updated'),
      division: headers.findIndex(h => h === 'Division'),
      referral: headers.findIndex(h => h === 'Referral'),
      refNote: headers.findIndex(h => h === 'Ref. Note'),
      confidenceLevel: headers.findIndex(h => h === 'Confidence Level'),
      archived: headers.findIndex(h => h === 'Archived'),
      excludeStats: headers.findIndex(h => h === 'Exclude Stats'),
      materialCost: headers.findIndex(h => h === 'Material Cost'),
      materialPrice: headers.findIndex(h => h === 'Material Price'),
      laborCost: headers.findIndex(h => h === 'Labor Cost'),
      laborPrice: headers.findIndex(h => h === 'Labor Price'),
      laborHours: headers.findIndex(h => h === 'Labor Hours'),
      equipmentCost: headers.findIndex(h => h === 'Equipment Cost'),
      equipmentPrice: headers.findIndex(h => h === 'Equipment Price'),
      otherCosts: headers.findIndex(h => h === 'Other Costs'),
      otherPrice: headers.findIndex(h => h === 'Other Price'),
      subCosts: headers.findIndex(h => h === 'Sub Costs'),
      subPrice: headers.findIndex(h => h === 'Sub Price'),
      totalPrice: headers.findIndex(h => h === 'Total Price'),
      totalPriceWithTax: headers.findIndex(h => h === 'Total Price With Tax'),
      totalCost: headers.findIndex(h => h === 'Total Cost'),
      totalOverhead: headers.findIndex(h => h === 'Total Overhead'),
      breakeven: headers.findIndex(h => h === 'Breakeven'),
      totalProfit: headers.findIndex(h => h === 'Total Profit'),
      predictedSales: headers.findIndex(h => h === 'Predicted Sales')
    };

    const estimates = [];
    const errors = [];
    const seenEstimateIds = new Set(); // Track duplicate IDs
    let wonEstimatesWithoutContractEnd = 0; // Track won estimates missing contract_end
    
    // Warn if Contract End column is not found
    if (colMap.contractEnd === -1) {
      errors.push('WARNING: "Contract End" column not found in file. Contract end dates will not be imported.');
      console.warn('⚠️ PARSER: "Contract End" column not found in Excel file headers');
      console.warn('Available headers:', headers.filter(h => h).slice(0, 20));
    } else {
      console.log(`✅ PARSER: "Contract End" column found at index ${colMap.contractEnd}`);
    }
    
    // Warn if Estimate Date column is not found
    if (colMap.estimateDate === -1) {
      errors.push('WARNING: "Estimate Date" column not found in file. Estimate dates will not be imported.');
      console.warn('⚠️ PARSER: "Estimate Date" column not found in Excel file headers');
      console.warn('Available headers:', headers.filter(h => h).slice(0, 20));
      console.warn('Looking for column names containing "date":', headers.filter(h => h && h.toString().toLowerCase().includes('date')).map((h, i) => `${i}: "${h}"`));
    } else {
      console.log(`✅ PARSER: "Estimate Date" column found at index ${colMap.estimateDate}`);
    }
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      try {
        const estimateId = row[colMap.estimateId]?.toString().trim();
        // NOTE: "Contact ID" in Estimates List is actually the CRM ID (Account ID), not a contact ID
        // But we normalize it to lowercase for consistency
        const contactIdRaw = row[colMap.contactId]?.toString().trim();
        const contactId = contactIdRaw ? contactIdRaw.toLowerCase() : null;
        
        if (!estimateId) {
          errors.push(`Row ${i + 1}: Missing Estimate ID, skipped`);
          continue;
        }

        // Check for duplicate estimate IDs
        if (seenEstimateIds.has(estimateId)) {
          errors.push(`Row ${i + 1}: Duplicate Estimate ID "${estimateId}", skipped`);
          continue;
        }
        seenEstimateIds.add(estimateId);

        // Parse dates (Excel serial dates or ISO strings)
        // Return date-only strings (YYYY-MM-DD) to avoid timezone conversion issues
        const parseDate = (value) => {
          if (!value) return null;
          // If it's an Excel serial date (number)
          if (typeof value === 'number') {
            // Excel epoch is 1900-01-01, but Excel has a bug where 1900 is treated as leap year
            // Excel epoch: December 30, 1899 (day 0 in Excel)
            // Convert Excel serial number to date components
            // Use local date calculation to preserve the date as-is without timezone conversion
            const excelEpoch = new Date(1899, 11, 30); // Local date: Dec 30, 1899
            const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
            // Extract date components directly (no timezone conversion)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`; // Date-only string (YYYY-MM-DD)
          }
          // Try parsing as date string
          if (typeof value === 'string') {
            const trimmed = value.trim();
            
            // If it's already in YYYY-MM-DD format, return as-is
            const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              return isoMatch[0]; // Return date-only string
            }
            
            // Handle MM/DD/YYYY format (common in Excel exports)
            const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyyMatch) {
              const [, month, day, year] = mmddyyyyMatch;
              const monthPadded = String(month).padStart(2, '0');
              const dayPadded = String(day).padStart(2, '0');
              return `${year}-${monthPadded}-${dayPadded}`; // Date-only string
            }
            
            // If the string includes timezone info, extract date part only
            if (trimmed.includes('T') || trimmed.includes('Z') || trimmed.includes('+') || (trimmed.includes('-') && trimmed.match(/^\d{4}-\d{2}-\d{2}/))) {
              const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (dateMatch) {
                return dateMatch[0]; // Return date-only part
              }
            } else {
              // Try parsing as a simple date string and extract date components
              const parsed = new Date(trimmed);
              if (!isNaN(parsed.getTime())) {
                const year = parsed.getFullYear();
                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                const day = String(parsed.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`; // Date-only string
              }
            }
          }
          return null;
        };

        // Parse numbers
        const parseNumber = (value) => {
          if (value === null || value === undefined || value === '') return null;
          const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : parseFloat(value);
          return isNaN(num) ? null : num;
        };

        // Determine status
        // Only reading from "Status" column - not using "Sales Pipeline Status"
        const status = row[colMap.status]?.toString().trim() || '';
        let estimateStatus = 'lost'; // Default to lost (no pending option)
        
        const stat = status.toLowerCase().trim();
        
        // Explicit Won statuses
        // Reading from LMN CSV column: "Status" only
        // These are the actual status values that appear in LMN Excel exports
        if (
          stat === 'email contract award' ||
          stat === 'verbal contract award' ||
          stat === 'work complete' ||
          stat === 'work in progress' ||
          stat === 'billing complete' ||
          stat === 'contract signed' ||
          stat === 'contract in progress' ||
          stat === 'contract + billing complete' ||
          stat.includes('email contract award') ||
          stat.includes('verbal contract award') ||
          stat.includes('work complete') ||
          stat.includes('billing complete') ||
          stat.includes('contract signed') ||
          stat.includes('contract in progress') ||
          stat.includes('contract + billing complete')
        ) {
          estimateStatus = 'won';
        }
        // Explicit Lost statuses
        else if (
          stat === 'estimate in progress - lost' ||
          stat === 'review + approve - lost' ||
          stat === 'client proposal phase - lost' ||
          stat === 'estimate lost' ||
          stat === 'estimate on hold' ||
          stat === 'estimate lost - no reply' ||
          stat === 'estimate lost - price too high' ||
          stat.includes('estimate in progress - lost') ||
          stat.includes('review + approve - lost') ||
          stat.includes('client proposal phase - lost') ||
          stat.includes('estimate lost - no reply') ||
          stat.includes('estimate lost - price too high') ||
          stat.includes('estimate on hold')
        ) {
          estimateStatus = 'lost';
        }
        // All other cases default to lost (no pattern matching)
        
        // Debug: Log unrecognized status values to help identify what's in the Excel file
        // Only log once per unique status to avoid spam
        if (status && estimateStatus === 'lost' && 
            !stat.includes('lost') && 
            !stat.includes('on hold') &&
            !stat.includes('in progress') &&
            !stat.includes('pending') &&
            !stat.includes('estimate')) {
          // Only log if we haven't seen this status before (to avoid console spam)
          if (!errors.some(e => e.includes(`Unrecognized status: "${status}"`))) {
            errors.push(`Unrecognized status: "${status}" (row ${i + 1}) - defaulting to 'lost'. If this should be 'won', the status value needs to be added to the parser.`);
          }
        }

        // Parse dates
        const estimateDateRaw = colMap.estimateDate >= 0 ? row[colMap.estimateDate] : null;
        const estimateDate = parseDate(estimateDateRaw);
        const estimateCloseDate = parseDate(row[colMap.estimateCloseDate]);
        
        // Parse contract dates
        const contractStartRaw = colMap.contractStart >= 0 ? row[colMap.contractStart] : null;
        const contractEndRaw = colMap.contractEnd >= 0 ? row[colMap.contractEnd] : null;
        const contractStart = parseDate(contractStartRaw);
        const contractEnd = parseDate(contractEndRaw);
        
        // Debug: Log first few estimates to see date parsing (AFTER all dates are parsed)
        if (estimates.length < 5) {
          console.log(`🔍 PARSER: Estimate ${estimateId} date parsing:`, {
            estimateId,
            estimateDateRaw,
            estimateDateRawType: typeof estimateDateRaw,
            estimateDateRawValue: estimateDateRaw,
            estimateDateParsed: estimateDate,
            estimateDateType: typeof estimateDate,
            colMapEstimateDate: colMap.estimateDate,
            hasEstimateDateColumn: colMap.estimateDate >= 0,
            contractStartRaw,
            contractStartRawType: typeof contractStartRaw,
            contractStartParsed: contractStart,
            contractEndRaw,
            contractEndRawType: typeof contractEndRaw,
            contractEndParsed: contractEnd,
            colMapContractStart: colMap.contractStart,
            colMapContractEnd: colMap.contractEnd,
            hasContractStartColumn: colMap.contractStart >= 0,
            hasContractEndColumn: colMap.contractEnd >= 0
          });
        }
        
        // Debug logging for first few won estimates with contract_end
        // Log to console for debugging (not just errors array)
        if (estimateId && contractEndRaw !== null && contractEndRaw !== undefined && contractEndRaw !== '') {
          const status = row[colMap.status]?.toString().trim() || '';
          const isWon = status.toLowerCase().includes('contract') || 
                       status.toLowerCase().includes('work complete') ||
                       status.toLowerCase().includes('billing complete') ||
                       status.toLowerCase().includes('email contract award') ||
                       status.toLowerCase().includes('verbal contract award');
          if (isWon) {
            // Only log first 3 to avoid spam
            const debugCount = errors.filter(e => e.startsWith('DEBUG:')).length;
            if (debugCount < 3) {
              const debugMsg = `DEBUG: Estimate ${estimateId} (${status}) - contractEndRaw: ${contractEndRaw} (type: ${typeof contractEndRaw}), parsed: ${contractEnd}`;
              errors.push(debugMsg);
              console.log('📅 PARSER:', debugMsg);
            }
          }
        }
        
        // Track won estimates missing contract_end (for summary, not individual warnings)
        if (estimateId && (!contractEndRaw || contractEndRaw === null || contractEndRaw === '')) {
          const status = row[colMap.status]?.toString().trim() || '';
          const isWon = status.toLowerCase().includes('contract') || 
                       status.toLowerCase().includes('work complete') ||
                       status.toLowerCase().includes('billing complete') ||
                       status.toLowerCase().includes('email contract award') ||
                       status.toLowerCase().includes('verbal contract award');
          if (isWon) {
            wonEstimatesWithoutContractEnd++;
          }
        }
        
        // Keep estimate_date and estimate_close_date separate
        // Reports logic will use close_date if available, otherwise estimate_date
        // This allows estimates to be counted in the year they closed (if closed) 
        // or the year they were made (if not closed yet, even if for future year)
        
        const estimate = {
          id: `lmn-estimate-${estimateId}`,
          lmn_estimate_id: estimateId,
          estimate_type: row[colMap.estimateType]?.toString().trim() || '',
          estimate_number: estimateId,
          estimate_date: estimateDate,
          estimate_close_date: estimateCloseDate,
          contract_start: contractStart,
          contract_end: contractEnd,
          project_name: row[colMap.projectName]?.toString().trim() || '',
          version: row[colMap.version]?.toString().trim() || '',
          contact_name: row[colMap.contactName]?.toString().trim() || '',
          contact_id: contactId ? `lmn-contact-${contactId}` : null,
          lmn_contact_id: contactId || null,
          crm_tags: row[colMap.crmTags]?.toString().trim() || '',
          address: row[colMap.address]?.toString().trim() || '',
          billing_address: row[colMap.billingAddress]?.toString().trim() || '',
          phone_1: row[colMap.phone1]?.toString().trim() || '',
          phone_2: row[colMap.phone2]?.toString().trim() || '',
          email: row[colMap.email]?.toString().trim() || '',
          salesperson: row[colMap.salesperson]?.toString().trim() || '',
          estimator: row[colMap.estimator]?.toString().trim() || '',
          status: estimateStatus,
          pipeline_status: row[colMap.salesPipelineStatus]?.toString().trim() || null, // Save Sales Pipeline Status for reporting
          // Note: Sales Pipeline Status is separate from status - used for pipeline reporting, not win/loss determination
          proposal_first_shared: parseDate(row[colMap.proposalFirstShared]),
          proposal_last_shared: parseDate(row[colMap.proposalLastShared]),
          proposal_last_updated: parseDate(row[colMap.proposalLastUpdated]),
          division: row[colMap.division]?.toString().trim() || '',
          referral: row[colMap.referral]?.toString().trim() || '',
          referral_note: row[colMap.refNote]?.toString().trim() || '',
          confidence_level: parseNumber(row[colMap.confidenceLevel]),
          archived: row[colMap.archived]?.toString().toLowerCase().trim() === 'true',
          exclude_stats: row[colMap.excludeStats]?.toString().toLowerCase().trim() === 'true',
          material_cost: parseNumber(row[colMap.materialCost]),
          material_price: parseNumber(row[colMap.materialPrice]),
          labor_cost: parseNumber(row[colMap.laborCost]),
          labor_price: parseNumber(row[colMap.laborPrice]),
          labor_hours: parseNumber(row[colMap.laborHours]),
          equipment_cost: parseNumber(row[colMap.equipmentCost]),
          equipment_price: parseNumber(row[colMap.equipmentPrice]),
          other_costs: parseNumber(row[colMap.otherCosts]),
          other_price: parseNumber(row[colMap.otherPrice]),
          sub_costs: parseNumber(row[colMap.subCosts]),
          sub_price: parseNumber(row[colMap.subPrice]),
          total_price: parseNumber(row[colMap.totalPrice]),
          total_price_with_tax: parseNumber(row[colMap.totalPriceWithTax]),
          total_cost: parseNumber(row[colMap.totalCost]),
          total_overhead: parseNumber(row[colMap.totalOverhead]),
          breakeven: parseNumber(row[colMap.breakeven]),
          total_profit: parseNumber(row[colMap.totalProfit]),
          predicted_sales: parseNumber(row[colMap.predictedSales]),
          source: 'lmn_estimates_list',
          created_date: new Date().toISOString()
        };

        estimates.push(estimate);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    // Calculate stats
    const uniqueEstimateIds = new Set(estimates.map(e => e.lmn_estimate_id));
    const estimatesWithContactId = estimates.filter(e => e.lmn_contact_id).length;
    const estimatesWithoutContactId = estimates.length - estimatesWithContactId;
    const wonEstimates = estimates.filter(e => e.status === 'won').length;
    
    // Log summary about won estimates missing contract_end
    // Note: This is informational - not all won estimates have contract_end dates in LMN
    if (wonEstimatesWithoutContractEnd > 0) {
      const percentage = ((wonEstimatesWithoutContractEnd / wonEstimates) * 100).toFixed(1);
      if (wonEstimatesWithoutContractEnd <= 10) {
        console.log(`ℹ️ PARSER: ${wonEstimatesWithoutContractEnd} won estimate${wonEstimatesWithoutContractEnd !== 1 ? 's' : ''} missing contract_end date (out of ${wonEstimates} total won estimates)`);
      } else {
        // Only warn if a significant portion is missing (helps identify data quality issues)
        // But make it clear this is expected behavior, not an error
        console.log(`ℹ️ PARSER: ${wonEstimatesWithoutContractEnd} won estimates (${percentage}%) missing contract_end date in Excel file (out of ${wonEstimates} total won estimates). This is expected - not all won estimates have contract end dates in LMN. Only estimates with contract_end dates will be used for at-risk account calculations.`);
      }
    }

    return {
      estimates,
      stats: {
        total: estimates.length,
        uniqueEstimateIds: uniqueEstimateIds.size,
        duplicatesSkipped: errors.filter(e => e.includes('Duplicate Estimate ID')).length,
        estimatesWithContactId,
        estimatesWithoutContactId,
        errors: errors.length > 0 ? errors.slice(0, 10) : null, // Limit errors shown
        errorsCount: errors.length
      }
    };
  } catch (err) {
    return {
      estimates: [],
      stats: { error: `Error parsing Estimates List: ${err.message}` }
    };
  }
}

/**
 * Detect delimiter (tab vs comma) by analyzing first line
 */
function detectDelimiter(firstLine) {
  if (!firstLine || typeof firstLine !== 'string') return ',';
  
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  
  // If tabs significantly outnumber commas, use tabs
  // Otherwise default to comma (safer for existing files)
  if (tabCount > commaCount * 1.5) {
    return '\t';
  }
  return ',';
}

/**
 * Parse CSV text into array of arrays
 */
function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  const lines = csvText.split('\n');
  if (lines.length < 1) return [];

  // Detect delimiter from first non-empty line
  const firstLine = lines.find(line => line.trim());
  const delimiter = firstLine ? detectDelimiter(firstLine) : ',';

  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Use appropriate parser based on delimiter
    const values = delimiter === '\t' 
      ? parseTSVLine(line)
      : parseCSVLine(line);
    if (values.length === 0) continue;
    rows.push(values);
  }
  return rows;
}

/**
 * Parse a TSV (tab-separated) line
 */
function parseTSVLine(line) {
  return line.split('\t').map(val => val.trim());
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}












