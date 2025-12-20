/**
 * CSV Parser for Estimate Data
 * Parses the "Estimate Test - Sheet1.csv" file
 */

/**
 * Parse CSV text into array of arrays
 * Handles quoted fields with commas properly
 * Returns array of arrays (not objects) for better compatibility
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    console.error('Invalid CSV text provided');
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
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
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

/**
 * Parse currency string to number
 * Handles formats like "$58,501.00" or "$58,501"
 */
export function parseCurrency(str) {
  if (!str) return 0;
  const cleaned = str.toString().replace(/[\$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse date string
 * Handles MM/DD/YYYY format from the CSV
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    // Handle MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  } catch (e) {
    return null;
  }
}

/**
 * Map status from CSV to our system
 * Maps various statuses to: won or lost (pending defaults to lost)
 * Only reads from "Status" column - does not use "Sales Pipeline Status"
 */
export function mapStatus(status) {
  // Only use Status field (not Sales Pipeline Status)
  const stat = (status || '').toLowerCase().trim();
  
  // Explicit Won statuses (check these first for accuracy)
  // Reading from CSV column: "Status" only
  if (
    stat === 'email contract award' ||
    stat === 'verbal contract award' ||
    stat === 'work complete' ||
    stat === 'work in progress' ||
    stat === 'billing complete' ||
    stat === 'contract signed' ||
    stat.includes('email contract award') ||
    stat.includes('verbal contract award') ||
    stat.includes('work complete') ||
    stat.includes('billing complete') ||
    stat.includes('contract signed')
  ) {
    return 'won';
  }
  
  // Explicit Lost statuses (check these first for accuracy)
  if (
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
    return 'lost';
  }
  
  // Default to lost (no pending option, no pattern matching)
  return 'lost';
}

/**
 * Process raw CSV data into estimate objects for the system
 */
export function processEstimateData(rawData) {
  const estimates = [];
  
  rawData.forEach((row, index) => {
    // Skip if no contact name (invalid row)
    if (!row['Contact Name'] || !row['Contact Name'].trim()) {
      return;
    }
    
    const status = mapStatus(row['Status']);
    const estimateDate = parseDate(row['Estimate Date']);
    const closeDate = parseDate(row['Estimate Close Date']);
    const totalPrice = parseCurrency(row['Total Price']);
    
    // Skip if no valid data
    if (!estimateDate || totalPrice === 0) {
      return;
    }
    
    estimates.push({
      id: row['Estimate ID'] || `est-${index}`,
      account_name: row['Contact Name'].trim(),
      estimate_number: row['Estimate ID'] || '',
      estimate_date: estimateDate.toISOString().split('T')[0],
      close_date: closeDate ? closeDate.toISOString().split('T')[0] : null,
      description: row['Project Name'] || 'No description',
      total_amount: totalPrice,
      status: status,
      won_date: status === 'won' && closeDate ? closeDate.toISOString().split('T')[0] : null,
      lost_date: status === 'lost' && closeDate ? closeDate.toISOString().split('T')[0] : null,
      salesperson: row['Salesperson'] || '',
      estimator: row['Estimator'] || '',
      division: row['Division'] || '',
      confidence_level: row['Confidence Level'] || '',
      raw_status: row['Status'] || ''
      // Note: Sales Pipeline Status column is no longer read or used for win/loss determination
    });
  });
  
  return estimates;
}














