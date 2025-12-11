/**
 * LMN Estimates List Parser
 * Parses the "Estimates List.xlsx" file
 */

/**
 * Parse Estimates List CSV/XLSX data
 * Returns: { estimates: [], stats: {} }
 */
export function parseEstimatesList(csvText) {
  try {
    const rows = parseCSV(csvText);
    
    if (!rows || rows.length < 2) {
      return { estimates: [], stats: { error: 'Empty or invalid file' } };
    }

    const headers = rows[0];
    if (!Array.isArray(headers) || headers.length === 0) {
      return { estimates: [], stats: { error: 'Invalid file format - no headers found' } };
    }

    // Map column indices
    const colMap = {
      estimateType: headers.findIndex(h => h === 'Estimate Type'),
      estimateId: headers.findIndex(h => h === 'Estimate ID'),
      estimateDate: headers.findIndex(h => h === 'Estimate Date'),
      estimateCloseDate: headers.findIndex(h => h === 'Estimate Close Date'),
      contractStart: headers.findIndex(h => h === 'Contract Start'),
      contractEnd: headers.findIndex(h => h === 'Contract End'),
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
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      try {
        const estimateId = row[colMap.estimateId]?.toString().trim();
        const contactId = row[colMap.contactId]?.toString().trim();
        
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
        const parseDate = (value) => {
          if (!value) return null;
          // If it's an Excel serial date (number)
          if (typeof value === 'number') {
            // Excel epoch is 1900-01-01, but Excel has a bug where 1900 is treated as leap year
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
            return date.toISOString().split('T')[0];
          }
          // Try parsing as date string
          if (typeof value === 'string') {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
              return parsed.toISOString().split('T')[0];
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
        const status = row[colMap.status]?.toString().trim() || '';
        const pipelineStatus = row[colMap.salesPipelineStatus]?.toString().trim() || '';
        let estimateStatus = 'pending';
        
        if (pipelineStatus.toLowerCase().includes('sold') || 
            pipelineStatus.toLowerCase().includes('contract') ||
            status.toLowerCase().includes('won')) {
          estimateStatus = 'won';
        } else if (pipelineStatus.toLowerCase().includes('lost') ||
                   status.toLowerCase().includes('lost')) {
          estimateStatus = 'lost';
        }

        const estimate = {
          id: `lmn-estimate-${estimateId}`,
          lmn_estimate_id: estimateId,
          estimate_type: row[colMap.estimateType]?.toString().trim() || '',
          estimate_number: estimateId,
          estimate_date: parseDate(row[colMap.estimateDate]),
          estimate_close_date: parseDate(row[colMap.estimateCloseDate]),
          contract_start: parseDate(row[colMap.contractStart]),
          contract_end: parseDate(row[colMap.contractEnd]),
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
          pipeline_status: pipelineStatus,
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
 * Parse CSV text into array of arrays
 */
function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  const lines = csvText.split('\n');
  if (lines.length < 1) return [];

  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length === 0) continue;
    rows.push(values);
  }
  return rows;
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






