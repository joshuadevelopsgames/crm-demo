/**
 * CSV Parser for Estimate Data
 * Parses the "Estimate Test - Sheet1.csv" file
 */

/**
 * Parse CSV text into array of arrays
 * Handles quoted fields with commas properly
 * Returns array of arrays (not objects) for better compatibility
 */
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

export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    console.error('Invalid CSV text provided');
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
 * LMN dates are always in UTC, so we parse them as UTC to avoid timezone conversion issues
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
      // Create date in UTC to avoid timezone shifts
      return new Date(Date.UTC(year, month - 1, day));
    }
    // Try parsing as ISO string or other format
    // If it's already YYYY-MM-DD, parse as UTC
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      return new Date(Date.UTC(year, month - 1, day));
    }
    // Try parsing as date string, but treat as UTC
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      // If it doesn't have timezone info, assume UTC
      if (!dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-')) {
        // Extract components and create UTC date
        const year = parsed.getUTCFullYear();
        const month = parsed.getUTCMonth();
        const day = parsed.getUTCDate();
        return new Date(Date.UTC(year, month, day));
      }
      return parsed;
    }
    return null;
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
    
    // Extract UTC date components to avoid timezone conversion when converting to string
    const formatUTCDate = (date) => {
      if (!date) return null;
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    estimates.push({
      id: row['Estimate ID'] || `est-${index}`,
      account_name: row['Contact Name'].trim(),
      estimate_number: row['Estimate ID'] || '',
      estimate_date: formatUTCDate(estimateDate),
      close_date: formatUTCDate(closeDate),
      description: row['Project Name'] || 'No description',
      total_amount: totalPrice,
      status: status,
      won_date: status === 'won' && closeDate ? formatUTCDate(closeDate) : null,
      lost_date: status === 'lost' && closeDate ? formatUTCDate(closeDate) : null,
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














